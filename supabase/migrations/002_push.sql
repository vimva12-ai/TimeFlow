-- ============================================================
-- TimeFlow — 002_push.sql
-- Push subscriptions 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions: select own"
  ON public.push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "push_subscriptions: insert own"
  ON public.push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_subscriptions: delete own"
  ON public.push_subscriptions FOR DELETE USING (user_id = auth.uid());
