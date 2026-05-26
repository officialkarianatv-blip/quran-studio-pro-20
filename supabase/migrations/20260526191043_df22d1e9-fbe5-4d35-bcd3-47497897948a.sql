CREATE TABLE public.telegram_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  update_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tgcm_chat_id_created ON public.telegram_chat_messages (chat_id, created_at);
CREATE UNIQUE INDEX idx_tgcm_update_id ON public.telegram_chat_messages (update_id) WHERE update_id IS NOT NULL;

GRANT ALL ON public.telegram_chat_messages TO service_role;

ALTER TABLE public.telegram_chat_messages ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: table accessed only by service_role from server.