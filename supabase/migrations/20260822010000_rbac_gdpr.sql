ALTER TABLE public.recruiters
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'recruiter'
  CHECK (role IN ('admin', 'recruiter'));

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS consent_given_at timestamptz;

CREATE INDEX IF NOT EXISTS candidates_consent_given_at_idx
  ON public.candidates (consent_given_at);