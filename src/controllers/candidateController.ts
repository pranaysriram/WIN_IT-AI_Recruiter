import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/middleware/auth";
import { atsSyncInput } from "@/utils/validation";
import { loadAtsSettings, pushCandidate } from "@/services/atsService.server";

export const syncCandidateToAts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => atsSyncInput.parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const settings = await loadAtsSettings(supabase);
    if (!settings) throw new Error("ATS settings are not initialised");

    const { data: candidate, error } = await supabase
      .from("candidates")
      .select("candidate_id, full_name, email, phone_number, status, ats_external_id")
      .eq("candidate_id", data.candidateId)
      .single();
    if (error || !candidate) throw new Error("Candidate not found");

    const { data: calls } = await supabase
      .from("call_sessions")
      .select("call_id")
      .eq("candidate_id", candidate.candidate_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const latestCallId = calls?.[0]?.call_id;
    const rawScreening = latestCallId
      ? ((
          await supabase
            .from("candidate_responses")
            .select("question_code, response_value")
            .eq("call_id", latestCallId)
        ).data ?? [])
      : [];
    const screening = rawScreening.map((r) => ({
      question_code: r.question_code,
      response_value: r.response_value ?? "",
    }));

    const result = await pushCandidate(settings, candidate, screening, supabase);

    if (result.synced) {
      await supabase
        .from("candidates")
        .update({
          ats_external_id: result.externalId ?? candidate.ats_external_id,
          ats_synced_at: new Date().toISOString(),
        })
        .eq("candidate_id", candidate.candidate_id);
    }

    return result;
  });
