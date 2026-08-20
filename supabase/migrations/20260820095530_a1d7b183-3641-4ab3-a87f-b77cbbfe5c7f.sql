INSERT INTO public.telephony_settings (singleton, agent_id, agent_phone_number_id, caller_label, enabled, updated_at)
VALUES (true, 'agent_4201m0cd8ywxen48ha2emgpqt7hq', 'phnum_6801m0f90k68e6arz28dfejk5z1d', 'Ava - +1 350 250 4813', true, now())
ON CONFLICT (singleton) DO UPDATE SET
  agent_id = EXCLUDED.agent_id,
  agent_phone_number_id = EXCLUDED.agent_phone_number_id,
  caller_label = EXCLUDED.caller_label,
  enabled = EXCLUDED.enabled,
  updated_at = now();