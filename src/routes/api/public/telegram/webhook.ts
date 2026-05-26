import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'crypto';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-3-flash-preview';
const SYSTEM_PROMPT =
  'You are a helpful AI assistant chatting with a user on Telegram. Reply concisely in the same language the user writes in (Bangla or English). Use plain text — avoid heavy markdown since Telegram renders it differently.';
const HISTORY_LIMIT = 20;

function deriveSecret(apiKey: string) {
  return createHash('sha256').update(`telegram-webhook:${apiKey}`).digest('base64url');
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

let _sb: ReturnType<typeof createClient> | null = null;
function sb() {
  if (!_sb) {
    _sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _sb;
}

async function sendTelegram(chatId: number, text: string) {
  const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': process.env.TELEGRAM_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    console.error('Telegram sendMessage failed', res.status, await res.text());
  }
}

async function sendTyping(chatId: number) {
  await fetch(`${GATEWAY_URL}/sendChatAction`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': process.env.TELEGRAM_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  }).catch(() => {});
}

async function callAI(messages: Array<{ role: string; content: string }>) {
  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: {
      'Lovable-API-Key': process.env.LOVABLE_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    }),
  });
  if (res.status === 429) throw new Error('rate_limited');
  if (res.status === 402) throw new Error('credits_exhausted');
  if (!res.ok) throw new Error(`ai_failed_${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || '...';
}

export const Route = createFileRoute('/api/public/telegram/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const tgKey = process.env.TELEGRAM_API_KEY;
        if (!tgKey) return new Response('TELEGRAM_API_KEY missing', { status: 500 });

        const expected = deriveSecret(tgKey);
        const got = request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '';
        if (!safeEqual(got, expected)) {
          return new Response('Unauthorized', { status: 401 });
        }

        const update = (await request.json()) as any;
        const msg = update.message ?? update.edited_message;
        const chatId: number | undefined = msg?.chat?.id;
        const text: string | undefined = msg?.text;
        const updateId: number | undefined = update.update_id;

        if (!chatId || !text || typeof updateId !== 'number') {
          return Response.json({ ok: true, ignored: true });
        }

        // Handle /start and /reset commands
        if (text.trim() === '/start') {
          await sendTelegram(chatId, 'সালাম! আমি Lovable AI bot। যে কোনো প্রশ্ন লিখুন — উত্তর দেব। /reset দিয়ে কথোপকথন রিসেট করতে পারেন।');
          return Response.json({ ok: true });
        }
        if (text.trim() === '/reset') {
          await sb().from('telegram_chat_messages').delete().eq('chat_id', chatId);
          await sendTelegram(chatId, 'কথোপকথন রিসেট হয়েছে ✓');
          return Response.json({ ok: true });
        }

        // Idempotent insert of user message
        const { error: insErr } = await sb()
          .from('telegram_chat_messages')
          .insert({ chat_id: chatId, role: 'user', content: text, update_id: updateId });

        if (insErr && !String(insErr.message).includes('duplicate')) {
          console.error('insert user msg failed', insErr);
        }
        // If duplicate update_id, Telegram retried — don't re-reply.
        if (insErr && String(insErr.message).includes('duplicate')) {
          return Response.json({ ok: true, duplicate: true });
        }

        await sendTyping(chatId);

        // Load recent history
        const { data: history } = await sb()
          .from('telegram_chat_messages')
          .select('role, content')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: false })
          .limit(HISTORY_LIMIT);

        const messages = (history ?? [])
          .reverse()
          .map((m: any) => ({ role: m.role as string, content: m.content as string }));

        try {
          const reply = await callAI(messages);
          await sb().from('telegram_chat_messages').insert({
            chat_id: chatId,
            role: 'assistant',
            content: reply,
          });
          await sendTelegram(chatId, reply);
        } catch (e: any) {
          const msgText =
            e.message === 'rate_limited'
              ? '⏳ অনেক রিকোয়েস্ট — একটু পরে আবার চেষ্টা করুন।'
              : e.message === 'credits_exhausted'
                ? '⚠️ AI credit শেষ। Workspace settings থেকে credit যোগ করুন।'
                : '❌ উত্তর তৈরি করতে সমস্যা হয়েছে।';
          console.error('AI error', e);
          await sendTelegram(chatId, msgText);
        }

        return Response.json({ ok: true });
      },
    },
  },
});
