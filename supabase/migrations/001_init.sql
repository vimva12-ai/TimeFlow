-- ============================================================
-- TimeFlow — 001_init.sql
-- ============================================================

-- ── users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id         uuid PRIMARY KEY,               -- Supabase Auth uid
  email      text NOT NULL,
  timezone   text NOT NULL DEFAULT 'Asia/Seoul',
  created_at timestamptz DEFAULT now()
);

-- Auth 사용자 생성 시 users 테이블에 자동 삽입하는 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── daily_plans ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_plans (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

-- ── time_slots ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.time_slots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id    uuid NOT NULL REFERENCES public.daily_plans(id) ON DELETE CASCADE,
  title      text NOT NULL,
  start_at   timestamptz NOT NULL,
  end_at     timestamptz NOT NULL,
  status     text NOT NULL DEFAULT 'planned'
             CHECK (status IN ('planned', 'done', 'partial', 'skipped')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ── actual_logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.actual_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id      uuid NOT NULL REFERENCES public.time_slots(id) ON DELETE CASCADE,
  actual_start timestamptz,
  actual_end   timestamptz,
  note         text,
  created_at   timestamptz DEFAULT now()
);

-- ── templates ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  slots_json jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actual_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates   ENABLE ROW LEVEL SECURITY;

-- users 정책
CREATE POLICY "users: select own"  ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY "users: insert own"  ON public.users FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "users: update own"  ON public.users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "users: delete own"  ON public.users FOR DELETE USING (id = auth.uid());

-- daily_plans 정책
CREATE POLICY "daily_plans: select own"  ON public.daily_plans FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "daily_plans: insert own"  ON public.daily_plans FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "daily_plans: update own"  ON public.daily_plans FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "daily_plans: delete own"  ON public.daily_plans FOR DELETE USING (user_id = auth.uid());

-- time_slots 정책 (JOIN으로 user_id 검증)
CREATE POLICY "time_slots: select own" ON public.time_slots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.daily_plans dp
    WHERE dp.id = plan_id AND dp.user_id = auth.uid()
  ));
CREATE POLICY "time_slots: insert own" ON public.time_slots FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.daily_plans dp
    WHERE dp.id = plan_id AND dp.user_id = auth.uid()
  ));
CREATE POLICY "time_slots: update own" ON public.time_slots FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.daily_plans dp
    WHERE dp.id = plan_id AND dp.user_id = auth.uid()
  ));
CREATE POLICY "time_slots: delete own" ON public.time_slots FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.daily_plans dp
    WHERE dp.id = plan_id AND dp.user_id = auth.uid()
  ));

-- actual_logs 정책 (2단계 JOIN으로 user_id 검증)
CREATE POLICY "actual_logs: select own" ON public.actual_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.time_slots ts
    JOIN public.daily_plans dp ON dp.id = ts.plan_id
    WHERE ts.id = slot_id AND dp.user_id = auth.uid()
  ));
CREATE POLICY "actual_logs: insert own" ON public.actual_logs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.time_slots ts
    JOIN public.daily_plans dp ON dp.id = ts.plan_id
    WHERE ts.id = slot_id AND dp.user_id = auth.uid()
  ));
CREATE POLICY "actual_logs: update own" ON public.actual_logs FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.time_slots ts
    JOIN public.daily_plans dp ON dp.id = ts.plan_id
    WHERE ts.id = slot_id AND dp.user_id = auth.uid()
  ));
CREATE POLICY "actual_logs: delete own" ON public.actual_logs FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.time_slots ts
    JOIN public.daily_plans dp ON dp.id = ts.plan_id
    WHERE ts.id = slot_id AND dp.user_id = auth.uid()
  ));

-- templates 정책
CREATE POLICY "templates: select own"  ON public.templates FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "templates: insert own"  ON public.templates FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "templates: update own"  ON public.templates FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "templates: delete own"  ON public.templates FOR DELETE USING (user_id = auth.uid());
