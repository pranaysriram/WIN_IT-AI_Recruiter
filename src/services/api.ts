import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Candidate = Tables<"candidates">;
export type Job = Tables<"jobs">;
export type CallSession = Tables<"call_sessions">;
export type CandidateResponse = Tables<"candidate_responses">;
export type Interview = Tables<"interview_schedules">;
export type Recruiter = Tables<"recruiters">;

export const QUESTION_LABELS: Record<string, string> = {
  current_salary: "Current salary",
  expected_salary: "Expected salary",
  notice_period: "Notice period",
  skills_confirmation: "Skills confirmation",
  location_preference: "Location",
  work_preference: "Work preference",
  interest_level: "Interest level",
  availability: "Availability",
};

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export const jobsQuery = {
  queryKey: ["jobs"],
  queryFn: async () =>
    unwrap(await supabase.from("jobs").select("*").order("created_at", { ascending: false })),
};

export const candidatesQuery = {
  queryKey: ["candidates"],
  queryFn: async () =>
    unwrap(await supabase.from("candidates").select("*").order("created_at", { ascending: false })),
};

export const callsQuery = {
  queryKey: ["calls"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("call_sessions")
        .select("*, candidates(full_name, phone_number), jobs(title, company_name)")
        .order("created_at", { ascending: false }),
    ),
};

export const interviewsQuery = {
  queryKey: ["interviews"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("interview_schedules")
        .select("*, candidates(full_name, email), jobs(title, company_name)")
        .order("interview_date", { ascending: true }),
    ),
};

export const recruitersQuery = {
  queryKey: ["recruiters"],
  queryFn: async () =>
    unwrap(await supabase.from("recruiters").select("*").order("full_name")),
};

export type CallDetail = CallSession & {
  candidates: Candidate | null;
  jobs: Job | null;
};

export const callDetailQuery = (callId: string) => ({
  queryKey: ["call", callId],
  queryFn: async () => {
    const res = await supabase
      .from("call_sessions")
      .select("*, candidates(*), jobs(*)")
      .eq("call_id", callId)
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);
    const call = res.data as unknown as CallDetail | null;
    const responses = unwrap(
      await supabase
        .from("candidate_responses")
        .select("*")
        .eq("call_id", callId)
        .order("created_at"),
    ) as CandidateResponse[];
    return { call, responses };
  },
});


export type TelephonySettings = Tables<"telephony_settings">;

export const telephonySettingsQuery = {
  queryKey: ["telephony-settings"],
  queryFn: async (): Promise<TelephonySettings | null> => {
    const res = await supabase
      .from("telephony_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return res.data;
  },
};

export type AtsSettings = Tables<"ats_settings">;

export const atsSettingsQuery = {
  queryKey: ["ats-settings"],
  queryFn: async (): Promise<AtsSettings | null> => {
    const res = await supabase
      .from("ats_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return res.data;
  },
};

export type CandidateDetail = {
  candidate: (Candidate & { jobs: Job | null }) | null;
  calls: CallSession[];
  responses: CandidateResponse[];
  interviews: Interview[];
};

export const candidateDetailQuery = (candidateId: string) => ({
  queryKey: ["candidate", candidateId],
  queryFn: async (): Promise<CandidateDetail> => {
    const res = await supabase
      .from("candidates")
      .select("*, jobs(*)")
      .eq("candidate_id", candidateId)
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);

    const calls = unwrap(
      await supabase
        .from("call_sessions")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false }),
    ) as CallSession[];

    const callIds = calls.map((c) => c.call_id);
    const responses = callIds.length
      ? ((
          await supabase
            .from("candidate_responses")
            .select("*")
            .in("call_id", callIds)
            .order("created_at", { ascending: false })
        ).data ?? [])
      : [];

    const interviews = unwrap(
      await supabase
        .from("interview_schedules")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("interview_date"),
    ) as Interview[];

    return {
      candidate: res.data as unknown as (Candidate & { jobs: Job | null }) | null,
      calls,
      responses: responses as CandidateResponse[],
      interviews,
    };
  },
});
