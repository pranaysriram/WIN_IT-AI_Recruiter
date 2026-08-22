UPDATE public.call_sessions
SET recording_url = NULL
WHERE recording_url LIKE 'https://recordings.example.com/%';
