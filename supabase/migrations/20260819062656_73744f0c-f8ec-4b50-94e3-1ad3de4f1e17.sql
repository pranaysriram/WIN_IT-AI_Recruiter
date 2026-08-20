ALTER TABLE public.interview_schedules
  ADD COLUMN IF NOT EXISTS calendar_provider TEXT,
  ADD COLUMN IF NOT EXISTS calendar_event_url TEXT,
  ADD COLUMN IF NOT EXISTS calendar_uid TEXT,
  ADD COLUMN IF NOT EXISTS meeting_link TEXT,
  ADD COLUMN IF NOT EXISTS invite_sent BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER TABLE public.interview_schedules
  ADD COLUMN IF NOT EXISTS calendar_provider TEXT,
  ADD COLUMN IF NOT EXISTS calendar_event_url TEXT,
  ADD COLUMN IF NOT EXISTS calendar_uid TEXT,
  ADD COLUMN IF NOT EXISTS meeting_link TEXT,
  ADD COLUMN IF NOT EXISTS invite_sent BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS ats_external_id TEXT,
  ADD COLUMN IF NOT EXISTS ats_synced_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.ats_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  provider TEXT NOT NULL DEFAULT 'greenhouse',
  base_url TEXT,
  default_board_id TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_settings TO authenticated;
GRANT ALL ON public.ats_settings TO service_role;

ALTER TABLE public.ats_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage ATS settings"
  ON public.ats_settings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_ats_settings_updated_at
  BEFORE UPDATE ON public.ats_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ats_settings (singleton) VALUES (true) ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bucket_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bucket_key, window_start)
);

GRANT ALL ON public.api_rate_limits TO service_role;

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_api_rate_limits_updated_at
  BEFORE UPDATE ON public.api_rate_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();