ALTER TABLE public.call_sessions
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'simulated',
  ADD COLUMN IF NOT EXISTS external_call_id text,
  ADD COLUMN IF NOT EXISTS error_message text;

CREATE UNIQUE INDEX IF NOT EXISTS call_sessions_external_call_id_key
  ON public.call_sessions (external_call_id) WHERE external_call_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.telephony_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  agent_id text,
  agent_phone_number_id text,
  caller_label text,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telephony_settings TO authenticated;
GRANT ALL ON public.telephony_settings TO service_role;

ALTER TABLE public.telephony_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members manage telephony settings" ON public.telephony_settings;
CREATE POLICY "Team members manage telephony settings"
  ON public.telephony_settings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

INSERT INTO public.telephony_settings (singleton) VALUES (true)
  ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.call_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;