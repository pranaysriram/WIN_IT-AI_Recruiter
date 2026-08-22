import { createFileRoute } from "@tanstack/react-router";
import { getAdminClient } from "@/db/connection";
import { flagCandidatesForRetentionReview } from "@/services/retentionService.server";

export const Route = createFileRoute("/api/cron/retention")({
  server: { handlers: { GET: async ({ request }) => {
    const expected = process.env.CRON_SECRET;
    if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json(await flagCandidatesForRetentionReview(await getAdminClient()));
  } } },
});