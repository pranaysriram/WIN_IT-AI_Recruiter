
CREATE TABLE public.recruiters (
  recruiter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(150) NOT NULL,
  phone_number VARCHAR(20),
  email VARCHAR(150),
  company_name VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruiters TO authenticated;
GRANT ALL ON public.recruiters TO service_role;
ALTER TABLE public.recruiters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can manage recruiters" ON public.recruiters FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(150) NOT NULL,
  company_name VARCHAR(150),
  location VARCHAR(150),
  employment_type VARCHAR(50),
  salary_range VARCHAR(50),
  jd_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can manage jobs" ON public.jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.candidates (
  candidate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(150) NOT NULL,
  phone_number VARCHAR(20),
  email VARCHAR(150),
  source VARCHAR(50) DEFAULT 'manual',
  ats_id VARCHAR(50),
  job_id UUID REFERENCES public.jobs(job_id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can manage candidates" ON public.candidates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.call_sessions (
  call_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(candidate_id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(job_id) ON DELETE SET NULL,
  call_start_time TIMESTAMPTZ,
  call_end_time TIMESTAMPTZ,
  call_status VARCHAR(20) NOT NULL DEFAULT 'queued',
  recording_url TEXT,
  transcript_text TEXT,
  ai_confidence DECIMAL(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_sessions TO authenticated;
GRANT ALL ON public.call_sessions TO service_role;
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can manage call sessions" ON public.call_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.candidate_responses (
  response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.call_sessions(call_id) ON DELETE CASCADE,
  question_code VARCHAR(50) NOT NULL,
  response_text TEXT,
  response_value VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_responses TO authenticated;
GRANT ALL ON public.candidate_responses TO service_role;
ALTER TABLE public.candidate_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can manage responses" ON public.candidate_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.interview_schedules (
  schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(candidate_id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(job_id) ON DELETE SET NULL,
  interview_date DATE NOT NULL,
  interview_time TIME NOT NULL,
  interviewer_name VARCHAR(150),
  calendar_event_id VARCHAR(150),
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_schedules TO authenticated;
GRANT ALL ON public.interview_schedules TO service_role;
ALTER TABLE public.interview_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can manage interviews" ON public.interview_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.recruiters (recruiter_id, full_name, phone_number, email, company_name) VALUES
 ('11111111-1111-4111-8111-111111111101','Priya Menon','+91 98450 22110','priya.menon@northbridge.io','Northbridge Talent'),
 ('11111111-1111-4111-8111-111111111102','Daniel Okafor','+1 415 555 0198','daniel.okafor@northbridge.io','Northbridge Talent');

INSERT INTO public.jobs (job_id, title, company_name, location, employment_type, salary_range, jd_text) VALUES
 ('22222222-2222-4222-8222-222222222201','Senior Backend Engineer','Corvex Systems','Bengaluru, India (Hybrid)','Full-time','₹32L - ₹45L','Own and scale Node.js and PostgreSQL services powering a high-volume telephony platform. You will design event-driven pipelines, tune queries, and mentor mid-level engineers. Requirements: 5+ years backend, strong SQL, experience with queues and observability.'),
 ('22222222-2222-4222-8222-222222222202','AI Voice Engineer','Corvex Systems','Remote (EU timezones)','Full-time','€75k - €95k','Build real-time speech pipelines combining STT, LLM reasoning and TTS. Experience with streaming audio, WebRTC or SIP, and latency optimisation is essential.'),
 ('22222222-2222-4222-8222-222222222203','Talent Operations Analyst','Northbridge Talent','New York, NY (Onsite)','Contract','$70k - $85k','Support recruiting operations: pipeline reporting, ATS hygiene, interview coordination and vendor management. Strong spreadsheet and dashboard skills required.');

INSERT INTO public.candidates (candidate_id, full_name, phone_number, email, source, ats_id, job_id, status) VALUES
 ('33333333-3333-4333-8333-333333333301','Aarav Sharma','+91 98111 40021','aarav.sharma@example.com','ATS','GH-10231','22222222-2222-4222-8222-222222222201','screened'),
 ('33333333-3333-4333-8333-333333333302','Lena Fischer','+49 151 2233 4455','lena.fischer@example.com','ATS','GH-10244','22222222-2222-4222-8222-222222222202','interview_scheduled'),
 ('33333333-3333-4333-8333-333333333303','Marcus Bell','+1 646 555 0142','marcus.bell@example.com','CSV Upload','CSV-0007','22222222-2222-4222-8222-222222222203','new'),
 ('33333333-3333-4333-8333-333333333304','Sofia Ramirez','+34 611 223 344','sofia.ramirez@example.com','manual',NULL,'22222222-2222-4222-8222-222222222202','new'),
 ('33333333-3333-4333-8333-333333333305','Tanvi Rao','+91 99000 71234','tanvi.rao@example.com','ATS','GH-10250','22222222-2222-4222-8222-222222222201','no_answer');

INSERT INTO public.call_sessions (call_id, candidate_id, job_id, call_start_time, call_end_time, call_status, recording_url, transcript_text, ai_confidence) VALUES
 ('44444444-4444-4444-8444-444444444401','33333333-3333-4333-8333-333333333301','22222222-2222-4222-8222-222222222201', now() - interval '2 days', now() - interval '2 days' + interval '6 minutes','completed','https://recordings.example.com/RE1029.mp3','AI: Hi Aarav, this is Ava calling from Northbridge Talent about the Senior Backend Engineer role at Corvex Systems. Is now a good time?\nCandidate: Yes, go ahead.\nAI: Great. Could you share your current annual salary?\nCandidate: I am at 28 lakhs fixed right now.\nAI: And what are you expecting?\nCandidate: Looking for around 38 lakhs.\nAI: What is your notice period?\nCandidate: 60 days, but I can try to negotiate to 45.\nAI: The role is hybrid in Bengaluru, three days onsite. Does that work?\nCandidate: Yes, I live in Whitefield so that is fine.\nAI: Wonderful, I will share interview slots by email.',92.40),
 ('44444444-4444-4444-8444-444444444402','33333333-3333-4333-8333-333333333302','22222222-2222-4222-8222-222222222202', now() - interval '1 day', now() - interval '1 day' + interval '8 minutes','completed','https://recordings.example.com/RE1035.mp3','AI: Hello Lena, calling about the AI Voice Engineer position at Corvex Systems.\nCandidate: Hi, yes I applied last week.\nAI: What is your current compensation?\nCandidate: 82 thousand euros.\nAI: Expected?\nCandidate: Around 92 thousand.\nAI: Notice period?\nCandidate: One month.\nAI: The role is fully remote within EU timezones.\nCandidate: Perfect, I am based in Berlin.\nAI: I can book a first interview Thursday at 3pm CET.\nCandidate: That works.',95.10),
 ('44444444-4444-4444-8444-444444444403','33333333-3333-4333-8333-333333333305','22222222-2222-4222-8222-222222222201', now() - interval '5 hours', now() - interval '5 hours' + interval '35 seconds','no_answer',NULL,NULL,NULL);

INSERT INTO public.candidate_responses (call_id, question_code, response_text, response_value) VALUES
 ('44444444-4444-4444-8444-444444444401','current_salary','I am at 28 lakhs fixed right now.','2800000 INR'),
 ('44444444-4444-4444-8444-444444444401','expected_salary','Looking for around 38 lakhs.','3800000 INR'),
 ('44444444-4444-4444-8444-444444444401','notice_period','60 days, but I can try to negotiate to 45.','60 days'),
 ('44444444-4444-4444-8444-444444444401','location_preference','Yes, I live in Whitefield so that is fine.','Bengaluru - hybrid OK'),
 ('44444444-4444-4444-8444-444444444401','interest_level','Wonderful, I will share interview slots by email.','high'),
 ('44444444-4444-4444-8444-444444444402','current_salary','82 thousand euros.','82000 EUR'),
 ('44444444-4444-4444-8444-444444444402','expected_salary','Around 92 thousand.','92000 EUR'),
 ('44444444-4444-4444-8444-444444444402','notice_period','One month.','30 days'),
 ('44444444-4444-4444-8444-444444444402','work_preference','Perfect, I am based in Berlin.','remote EU'),
 ('44444444-4444-4444-8444-444444444402','interest_level','That works.','high');

INSERT INTO public.interview_schedules (candidate_id, job_id, interview_date, interview_time, interviewer_name, calendar_event_id, status) VALUES
 ('33333333-3333-4333-8333-333333333302','22222222-2222-4222-8222-222222222202', CURRENT_DATE + 2, '15:00', 'Daniel Okafor','gcal_evt_8821','scheduled'),
 ('33333333-3333-4333-8333-333333333301','22222222-2222-4222-8222-222222222201', CURRENT_DATE + 4, '11:30', 'Priya Menon','gcal_evt_8830','scheduled');
