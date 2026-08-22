import { createFileRoute } from "@tanstack/react-router";
import { preflight, restRoute } from "@/services/restHandler.server";

function parseNumericValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/\d[\d,]*(?:\.\d+)?/);
  if (!match) return null;
  const normalized = Number(match[0].replace(/,/g, ""));
  return Number.isFinite(normalized) ? normalized : null;
}

export const Route = createFileRoute("/api/analytics/candidates")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(request),

      GET: async ({ request }) =>
        restRoute(request, "analytics-candidates", async ({ supabase }) => {
          const [{ data: candidates }, { data: responses }, { data: calls }] = await Promise.all([
            supabase.from("candidates").select("candidate_id"),
            supabase.from("candidate_responses").select("call_id, question_code, response_value"),
            supabase.from("call_sessions").select("call_id, candidate_id"),
          ]);

          const totalCandidates = candidates?.length ?? 0;
          const candidateByCallId = new Map((calls ?? []).map((call) => [call.call_id, call.candidate_id]));

          const candidateIdsWithResponses = new Set(
            (responses ?? [])
              .map((row) => candidateByCallId.get(row.call_id) ?? null)
              .filter((candidateId): candidateId is string => Boolean(candidateId)),
          );

          const interestByCandidate = new Map<string, number>();
          for (const row of responses ?? []) {
            if (row.question_code !== "interest_level") continue;
            const candidateId = candidateByCallId.get(row.call_id);
            if (!candidateId) continue;
            const value = row.response_value?.toLowerCase() ?? "";
            if (["high", "medium"].includes(value)) {
              interestByCandidate.set(candidateId, (interestByCandidate.get(candidateId) ?? 0) + 1);
            }
          }

          const interestCandidateIds = new Set(
            (responses ?? [])
              .filter((row) => row.question_code === "interest_level")
              .map((row) => candidateByCallId.get(row.call_id) ?? null)
              .filter((candidateId): candidateId is string => Boolean(candidateId)),
          );

          const expectedSalaries = (responses ?? [])
            .filter((row) => row.question_code === "expected_salary")
            .map((row) => parseNumericValue(row.response_value))
            .filter((value): value is number => value !== null && value > 0);

          return Response.json({
            total_candidates: totalCandidates,
            response_rate: totalCandidates ? (candidateIdsWithResponses.size / totalCandidates) * 100 : 0,
            interest_rate:
              interestCandidateIds.size > 0
                ? (Array.from(interestByCandidate.keys()).length / interestCandidateIds.size) * 100
                : 0,
            average_expected_salary: expectedSalaries.length
              ? expectedSalaries.reduce((sum, value) => sum + value, 0) / expectedSalaries.length
              : 0,
          });
        }),
    },
  },
});
