import { createFileRoute } from "@tanstack/react-router";
import { HttpError, preflight, restRoute } from "@/services/restHandler.server";
import { uuid } from "@/utils/validation";

export const Route = createFileRoute("/api/candidates/$id/export")({
  server: { handlers: {
    OPTIONS: async ({ request }) => preflight(request),
    GET: async ({ request, params }) => restRoute(request, "candidates-export", async ({ supabase }) => {
      const parsed = uuid.safeParse(params.id);
      if (!parsed.success) throw new HttpError(400, "Invalid candidate id");
      const candidateId = parsed.data;
      const { data: candidate, error } = await supabase.from("candidates").select("*, jobs(*)").eq("candidate_id", candidateId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!candidate) throw new HttpError(404, "Candidate not found");
      const [calls, responses, interviews] = await Promise.all([
        supabase.from("call_sessions").select("*").eq("candidate_id", candidateId),
        supabase.from("candidate_responses").select("*").in("call_id", (await supabase.from("call_sessions").select("call_id").eq("candidate_id", candidateId)).data?.map((row) => row.call_id) ?? ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("interview_schedules").select("*").eq("candidate_id", candidateId),
      ]);
      if (calls.error || responses.error || interviews.error) throw new Error(calls.error?.message ?? responses.error?.message ?? interviews.error?.message);
      return Response.json({ exported_at: new Date().toISOString(), candidate, calls: calls.data ?? [], responses: responses.data ?? [], interviews: interviews.data ?? [] });
    }),
  } },
});