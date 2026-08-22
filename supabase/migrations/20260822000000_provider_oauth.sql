CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE CHECK (provider IN ('microsoft', 'zoho_recruit')),
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.oauth_tokens FROM anon, authenticated;
GRANT ALL ON public.oauth_tokens TO service_role;