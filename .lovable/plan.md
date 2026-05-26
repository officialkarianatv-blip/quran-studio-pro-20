
## প্রজেক্টের বর্তমান অবস্থা

**সর্বশেষ যা হয়েছে (পূর্ববর্তী সেশনগুলোতে):**
1. Cloud (Supabase) ডাটাবেজ সেট আপ, লাইভ ও প্রজেক্ট ইমপোর্ট সম্পন্ন।
2. Telegram bot ইন্টিগ্রেশন — `src/routes/api/public/telegram/webhook.ts` + `telegram_chat_messages` টেবিল; Lovable AI Gateway (Gemini) দিয়ে চ্যাট রেসপন্স।
3. Editor সাইডে paragraph-reflow ইঞ্জিন (`textReflow.ts`, `reflowScope.ts`, `typographyReflow.ts`) already wired:
   - `FabricLines.tsx` — ইনলাইন টেক্সট এডিট → `reflowFromAsync` / `backFillFrom` (scope+link aware, cross-page dialog সহ)।
   - `PropertiesPanel.tsx` → `useTypographyPatch` → `patchTypographyScoped` → প্রতিটি affected (page,row,layer)-এর জন্য `reflowLayerText`।

**পরবর্তী যা করা দরকার:**
এই desktop-class Quran editor-এর paragraph reflow আসলেই InDesign-এর মতো নির্ভরযোগ্যভাবে স্কোপ অনুযায়ী চলছে কিনা তা **systematically যাচাই** করতে হবে এবং যা ভাঙছে তা fix করতে হবে।

---

## লক্ষ্য

প্রতিটি (scope × layer × trigger) সমন্বয়ে paragraph reflow সঠিকভাবে চলে — কোনো সারি ক্লিপ হবে না, পরের সারিতে/পেজে অপ্রত্যাশিতভাবে spill করবে না, এবং link OFF অবস্থায় সম্পূর্ণ isolated থাকবে।

স্কোপ ম্যাট্রিক্স যাচাই (Arabic + Bangla আলাদাভাবে):

|             | general | page | surah | global |
|-------------|---------|------|-------|--------|
| টাইপ এডিট  | ?       | ?    | ?     | ?      |
| Enter কী    | ?       | ?    | ?     | ?      |
| Font px     | ?       | ?    | ?     | ?      |
| Leading/Tracking/hScale | ?  | ?  | ?  | ?  |
| Link OFF (ক্লিপ) | ?  | ?  | ?  | ?  |

---

## পরিকল্পনা

### Step 1 — Audit (read-only)

প্রতিটি কোডপাথ একবার পড়ে নিচের জানা ঝুঁকিগুলো চিহ্নিত করব:

- **A.** `patchTypographyScoped` প্রতিটি affected layer-key-এর জন্য `reflowLayerText` queue করে, কিন্তু প্রতিটি call নিজেই আবার full scope cascade চালাতে পারে → একই surah-এ N² কাজ ও পরস্পরবিরোধী লেখা হতে পারে।
- **B.** Typography reflow `reflowLayerText`-এ scope পাস করে কিন্তু কিছু পথে `useEditorStore.getState().scope` পুনরায় পড়ছে — দ্রুত scope পরিবর্তনে race।
- **C.** `FabricLines.checkOverflow` cascade চালানোর সময় `surahPageIds: eff.pageIds` ব্যবহার করছে; "page" scope-এ এটাই current page — সঠিক, কিন্তু "global" scope-এ পুরো বইয়ে সাধারণ টাইপিং পর্যন্ত spill হতে পারে — InDesign-এর paragraph behavior-এর সাথে কতটা মেলে তা confirm করা দরকার।
- **D.** Cross-page dialog (`CrossPageReflowDialog`) শুধু Enter পাথে fires; সাধারণ টাইপিং-এ overflow পেজ ক্রস করলে dialog ছাড়াই push হয় — InDesign-এ এটা স্বাভাবিক, কিন্তু "surah cross" এর সতর্কতা দরকার কিনা সিদ্ধান্ত নিতে হবে।
- **E.** `MASTER_DEFAULTS.arabicFontPx = 50` কিন্তু `typographyReflow.ts`-এ fallback `40` — inconsistency।
- **F.** Bangla layer-এর `splitToFitForLayer` Arabic-style word splitter ব্যবহার করছে কিনা যাচাই; ভুল splitter হলে Bangla overflow ভুলভাবে চলবে।
- **G.** Link OFF অবস্থায় typography change এখনো শুধু current row-এ ক্লিপ করছে কিনা (toast আসছে কিন্তু আসলে other rows-এ patch ফেলছে কিনা)।

### Step 2 — Live preview test grid

`PropertiesPanel` ও inline editor ব্যবহার করে preview-তে প্রতিটি ম্যাট্রিক্স ঘর hand-test করব এবং কোথায় ভাঙে noted করব।

### Step 3 — Fix (targeted, presentation-layer-first)

Audit-এ পাওয়া issues-এর জন্য minimal, surgical fix:

- **Fix A** — `patchTypographyScoped`-এ scope=general fan-out করে শুধু **start key থেকে একবার** `reflowLayerText` চালাব; বাকি keys-এর জন্য in-place font-size update যথেষ্ট (cascade duplicate করব না)।
- **Fix B** — `reflowLayerText`-এ scope সবসময় caller থেকে নেব, default-fallback সরাব।
- **Fix C/D** — "surah" cross করলে সাধারণ টাইপিং-এও confirmation dialog ট্রিগার করার অপশন (editor preference হিসেবে) — InDesign-parity।
- **Fix E** — `MASTER_DEFAULTS` কে single source of truth করে সব fallback সেখান থেকে পড়ব।
- **Fix F** — Bangla splitter আলাদা করা থাকলে নিশ্চিত করব; না থাকলে minimal Bangla-aware splitter যোগ করব।
- **Fix G** — link OFF guard আগে চেক, fan-out-এর আগেই reject।

### Step 4 — Regression check

- Editor খুলে প্রতিটি ম্যাট্রিক্স ঘর আবার চালিয়ে dev-server console clean রাখব।
- বড় cascade (surah/global) চালানোর সময় UI block না হয় তা নিশ্চিত করব (`isReflowing` flag + chunked rebuild ইতিমধ্যেই আছে)।

---

## কারিগরি বিস্তারিত (technical details)

- ফোকাস ফাইল: `src/lib/textReflow.ts`, `src/lib/typographyReflow.ts`, `src/lib/reflowScope.ts`, `src/components/studio/FabricLines.tsx`, `src/components/studio/PropertiesPanel.tsx`, `src/state/overridesStore.ts`, `src/hooks/useTypographyPatch.ts`।
- ডাটা স্কিমা/ব্যাকএন্ডে কোনো পরিবর্তন নেই — সম্পূর্ণ frontend/presentation-layer কাজ।
- Telegram webhook ও Supabase migrations অপরিবর্তিত থাকবে।

---

## প্রশ্ন (approve করার আগে নিশ্চিত করুন)

1. আমি কি **পুরো audit + fix** একসাথে চালাব, নাকি প্রথমে শুধু **Step 1+2 (audit রিপোর্ট)** দিয়ে আপনাকে দেখাব কোথায় ভাঙছে — তারপর fix-এ যাব?
2. "surah cross" warning dialog সাধারণ টাইপিং-এও চান, নাকি শুধু Enter/typography-এর মতো large change-এ?
