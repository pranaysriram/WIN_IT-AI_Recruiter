import type { DB } from "@/db/connection";

export async function flagCandidatesForRetentionReview(db: DB): Promise<{ flagged: number; retentionDays: number }> {
  const retentionDays = Math.max(1, Number(process.env.GDPR_RETENTION_DAYS ?? 730));
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  const { data, error } = await db
    .from("candidates")
    .update({ status: "retention_review" })
    .lt("consent_given_at", cutoff)
    .not("status", "in", "(retention_review,deleted)")
    .select("candidate_id");
  if (error) throw new Error(error.message);
  return { flagged: data?.length ?? 0, retentionDays };
}