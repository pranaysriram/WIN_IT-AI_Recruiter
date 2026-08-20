ALTER TABLE public.call_sessions
  ADD COLUMN IF NOT EXISTS extraction_json jsonb,
  ADD COLUMN IF NOT EXISTS extraction_model text,
  ADD COLUMN IF NOT EXISTS extracted_at timestamptz;