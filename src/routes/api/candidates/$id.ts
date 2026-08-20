import { createFileRoute } from "@tanstack/react-router";
import {
  auditRest,
  HttpError,
  preflight,
  readJson,
  restRoute,
} from "@/services/restHandler.server";
import {
  deleteCandidate,
  getCandidate,
  updateCandidate,
} from "@/services/restResourceService.server";
import { candidateUpdate, uuid } from "@/utils/validation";

function candidateId(raw: string): string {
  const parsed = uuid.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "Invalid candidate id");
  return parsed.data;
}

export const Route = createFileRoute("/api/candidates/$id")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(request),

      GET: async ({ request, params }) =>
        restRoute(request, "candidates-read", async ({ supabase }) =>
          Response.json(await getCandidate(supabase, candidateId(params.id))),
        ),

      PUT: async ({ request, params }) =>
        restRoute(request, "candidates-write", async ({ supabase }) => {
          const id = candidateId(params.id);
          const input = await readJson(request, (v) => candidateUpdate.parse(v));
          const candidate = await updateCandidate(supabase, id, input);
          await auditRest(request, {
            action: "candidate.update",
            resourceType: "candidate",
            resourceId: id,
            details: { fields: Object.keys(input) },
          });
          return Response.json(candidate);
        }),

      DELETE: async ({ request, params }) =>
        restRoute(request, "candidates-write", async ({ supabase }) => {
          const id = candidateId(params.id);
          const result = await deleteCandidate(supabase, id);
          await auditRest(request, {
            action: "candidate.delete",
            resourceType: "candidate",
            resourceId: id,
          });
          return Response.json(result);
        }),
    },
  },
});
