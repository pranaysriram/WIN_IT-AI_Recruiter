ALTER TABLE public.telephony_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage telephony settings"
ON public.telephony_settings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telephony_settings TO authenticated;
GRANT ALL ON public.telephony_settings TO service_role;