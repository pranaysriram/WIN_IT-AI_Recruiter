GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_rate_limits TO authenticated;
GRANT ALL ON public.api_rate_limits TO service_role;

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Server-only rate limit data"
ON public.api_rate_limits
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);