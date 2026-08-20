/**
 * Data access for the REST resource endpoints.
 *
 * Every query runs through the caller's RLS-scoped Supabase client, so the
 * REST surface enforces exactly the same access rules as the dashboard.
 * Scheduling, calling, transcription and extraction logic is NOT duplicated
 * here — those endpoints delegate to the existing services/controllers.
 */
import type { z } from "zod";
import type { DB } from "@/db/connection";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { HttpError } from "@/services/callApiService.server";
import {
  candidateCreate,
  candidateUpdate,
  jobCreate,
  jobUpdate,
  interviewUpdate,
  listQuery,
} from "@/utils/validation";

export type ListQuery = z.infer<typeof listQuery>;

export function parseListQuery(request: Request): ListQuery {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = listQuery.safeParse(params);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid query");
  return parsed.data;
}

function ok<T>(result: { data: T | null; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new HttpError(400, result.error.message);
  if (result.data == null) throw new HttpError(404, "Resource not found");
  return result.data as NonNullable<T>;
}

/** Like `ok`, but a missing row is a valid outcome (`maybeSingle`). */
function maybe<T>(result: { data: T | null; error: { message: string } | null }): T | null {
  if (result.error) throw new HttpError(400, result.error.message);
  return result.data ?? null;
}

function found<T>(row: T | null | undefined, label: string): NonNullable<T> {
  if (row == null) throw new HttpError(404, `${label} not found`);
  return row as NonNullable<T>;
}

/** Drops `undefined` keys so partial updates satisfy exactOptionalPropertyTypes. */
function compact<T>(input: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as T;
}

/* ------------------------------- candidates ------------------------------- */

export async function listCandidates(supabase: DB, q: ListQuery) {
  let query = supabase
    .from("candidates")
    .select("*, jobs(job_id, title, company_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(q.offset, q.offset + q.limit - 1);
  if (q.status) query = query.eq("status", q.status);
  if (q.job_id) query = query.eq("job_id", q.job_id);
  if (q.q) query = query.or(`full_name.ilike.%${q.q}%,email.ilike.%${q.q}%`);

  const res = await query;
  if (res.error) throw new HttpError(400, res.error.message);
  return { data: res.data, total: res.count ?? res.data.length, limit: q.limit, offset: q.offset };
}

export async function getCandidate(supabase: DB, id: string) {
  const candidate = found(
    maybe(await supabase.from("candidates").select("*, jobs(*)").eq("candidate_id", id).maybeSingle()),
    "Candidate",
  );
  const calls = ok(
    await supabase
      .from("call_sessions")
      .select("*")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false }),
  );
  const interviews = ok(
    await supabase
      .from("interview_schedules")
      .select("*")
      .eq("candidate_id", id)
      .order("interview_date"),
  );
  return { candidate, calls, interviews };
}

export async function createCandidate(supabase: DB, input: z.infer<typeof candidateCreate>) {
  return found(
    maybe<Tables<"candidates">>(await supabase.from("candidates").insert(compact<TablesInsert<"candidates">>(input)).select("*").single()), "Candidate");
}

export async function updateCandidate(
  supabase: DB,
  id: string,
  input: z.infer<typeof candidateUpdate>,
) {
  return found(
    maybe(
      await supabase
        .from("candidates")
        .update(compact<TablesUpdate<"candidates">>(input))
        .eq("candidate_id", id)
        .select("*")
        .maybeSingle(),
    ),
    "Candidate",
  );
}

export async function deleteCandidate(supabase: DB, id: string) {
  // 404 before delete so the caller gets a meaningful status.
  found(
    maybe(await supabase.from("candidates").select("candidate_id").eq("candidate_id", id).maybeSingle()),
    "Candidate",
  );
  const res = await supabase.from("candidates").delete().eq("candidate_id", id);
  if (res.error) throw new HttpError(400, res.error.message);
  return { deleted: id };
}

/* ---------------------------------- jobs ---------------------------------- */

export async function listJobs(supabase: DB, q: ListQuery) {
  let query = supabase
    .from("jobs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(q.offset, q.offset + q.limit - 1);
  if (q.q) query = query.ilike("title", `%${q.q}%`);

  const res = await query;
  if (res.error) throw new HttpError(400, res.error.message);
  return { data: res.data, total: res.count ?? res.data.length, limit: q.limit, offset: q.offset };
}

export async function getJob(supabase: DB, id: string) {
  const job = found(
    maybe(await supabase.from("jobs").select("*").eq("job_id", id).maybeSingle()),
    "Job",
  );
  const candidates = ok(
    await supabase.from("candidates").select("candidate_id, full_name, status").eq("job_id", id),
  );
  return { job, candidates };
}

export async function createJob(supabase: DB, input: z.infer<typeof jobCreate>) {
  return found(
    maybe<Tables<"jobs">>(await supabase.from("jobs").insert(compact<TablesInsert<"jobs">>(input)).select("*").single()), "Job");
}

export async function updateJob(supabase: DB, id: string, input: z.infer<typeof jobUpdate>) {
  return found(
    maybe(await supabase.from("jobs").update(compact<TablesUpdate<"jobs">>(input)).eq("job_id", id).select("*").maybeSingle()),
    "Job",
  );
}

export async function deleteJob(supabase: DB, id: string) {
  found(
    maybe(await supabase.from("jobs").select("job_id").eq("job_id", id).maybeSingle()), "Job");
  const res = await supabase.from("jobs").delete().eq("job_id", id);
  if (res.error) throw new HttpError(400, res.error.message);
  return { deleted: id };
}

/* -------------------------------- interviews ------------------------------- */

export async function listInterviews(supabase: DB, q: ListQuery) {
  let query = supabase
    .from("interview_schedules")
    .select("*, candidates(full_name, email), jobs(title, company_name)", { count: "exact" })
    .order("interview_date", { ascending: true })
    .range(q.offset, q.offset + q.limit - 1);
  if (q.status) query = query.eq("status", q.status);
  if (q.job_id) query = query.eq("job_id", q.job_id);
  if (q.candidate_id) query = query.eq("candidate_id", q.candidate_id);

  const res = await query;
  if (res.error) throw new HttpError(400, res.error.message);
  return { data: res.data, total: res.count ?? res.data.length, limit: q.limit, offset: q.offset };
}

export async function getInterview(supabase: DB, id: string) {
  return found(
    maybe(
      await supabase
        .from("interview_schedules")
        .select("*, candidates(full_name, email), jobs(title, company_name)")
        .eq("schedule_id", id)
        .maybeSingle(),
    ),
    "Interview",
  );
}

export async function updateInterview(
  supabase: DB,
  id: string,
  input: z.infer<typeof interviewUpdate>,
) {
  return found(
    maybe(
      await supabase
        .from("interview_schedules")
        .update(compact<TablesUpdate<"interview_schedules">>(input))
        .eq("schedule_id", id)
        .select("*")
        .maybeSingle(),
    ),
    "Interview",
  );
}

/* -------------------------------- analytics -------------------------------- */

export async function getAnalytics(supabase: DB) {
  const candidates = ok(await supabase.from("candidates").select("status"));
  const calls = ok(
    await supabase
      .from("call_sessions")
      .select("call_status, ai_confidence, call_start_time, call_end_time"),
  );
  const interviews = ok(await supabase.from("interview_schedules").select("status"));
  const jobs = ok(await supabase.from("jobs").select("job_id"));

  const tally = (rows: Array<{ [k: string]: unknown }>, key: string) =>
    rows.reduce<Record<string, number>>((acc, row) => {
      const value = String(row[key] ?? "unknown");
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    }, {});

  const durations = calls
    .filter((c) => c.call_start_time && c.call_end_time)
    .map(
      (c) =>
        (new Date(c.call_end_time as string).getTime() -
          new Date(c.call_start_time as string).getTime()) /
        1000,
    )
    .filter((d) => d >= 0);

  const confidences = calls
    .map((c) => Number(c.ai_confidence))
    .filter((n) => Number.isFinite(n)) as number[];

  const completed = calls.filter((c) => c.call_status === "completed").length;

  return {
    totals: {
      jobs: jobs.length,
      candidates: candidates.length,
      calls: calls.length,
      interviews: interviews.length,
    },
    candidates_by_status: tally(candidates, "status"),
    calls_by_status: tally(calls, "call_status"),
    interviews_by_status: tally(interviews, "status"),
    call_metrics: {
      completion_rate: calls.length ? Math.round((completed / calls.length) * 100) : 0,
      avg_duration_seconds: durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0,
      avg_ai_confidence: confidences.length
        ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
        : null,
    },
  };
}

/* --------------------------- transcripts / reports -------------------------- */

export async function getCallTranscript(supabase: DB, callId: string) {
  const call = found(
    maybe(
      await supabase
        .from("call_sessions")
        .select(
          "call_id, candidate_id, job_id, call_status, transcript_text, call_start_time, call_end_time, ai_confidence, candidates(full_name), jobs(title)",
        )
        .eq("call_id", callId)
        .maybeSingle(),
    ),
    "Call",
  );
  const responses = ok(
    await supabase
      .from("candidate_responses")
      .select("question_code, response_text, response_value")
      .eq("call_id", callId)
      .order("created_at"),
  );
  return { call, responses };
}

export async function getTranscriptReport(supabase: DB, q: ListQuery) {
  let query = supabase
    .from("call_sessions")
    .select(
      "call_id, candidate_id, job_id, call_status, ai_confidence, call_start_time, transcript_text, candidates(full_name), jobs(title, company_name)",
      { count: "exact" },
    )
    .not("transcript_text", "is", null)
    .order("call_start_time", { ascending: false })
    .range(q.offset, q.offset + q.limit - 1);
  if (q.candidate_id) query = query.eq("candidate_id", q.candidate_id);
  if (q.job_id) query = query.eq("job_id", q.job_id);
  if (q.status) query = query.eq("call_status", q.status);

  const res = await query;
  if (res.error) throw new HttpError(400, res.error.message);

  return {
    generated_at: new Date().toISOString(),
    total: res.count ?? res.data.length,
    limit: q.limit,
    offset: q.offset,
    transcripts: res.data.map((row) => ({
      ...row,
      transcript_text: row.transcript_text,
      characters: row.transcript_text?.length ?? 0,
    })),
  };
}
