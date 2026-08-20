import { createFileRoute } from "@tanstack/react-router";
import { auditRest, preflight, readJson, restRoute } from "@/services/restHandler.server";
import {
  createCandidate,
  listCandidates,
  parseListQuery,
} from "@/services/restResourceService.server";
import { candidateCreate } from "@/utils/validation";

export const Route = createFileRoute("/api/candidates/")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(request),

      GET: async ({ request }) =>
        restRoute(request, "candidates-list", async ({ supabase }) =>
          Response.json(await listCandidates(supabase, parseListQuery(request))),
        ),

      POST: async ({ request }) =>
        restRoute(request, "candidates-write", async ({ supabase }) => {
          const input = await readJson(request, (v) => candidateCreate.parse(v));
          const candidate = await createCandidate(supabase, input);
          await auditRest(request, {
            action: "candidate.create",
            resourceType: "candidate",
            resourceId: candidate.candidate_id,
          });
          return Response.json(candidate, { status: 201 });
        }),
    },
  },
});
