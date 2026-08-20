import { createFileRoute } from "@tanstack/react-router";
import {
  auditRest,
  HttpError,
  preflight,
  readJson,
  restRoute,
} from "@/services/restHandler.server";
import { deleteJob, getJob, updateJob } from "@/services/restResourceService.server";
import { jobUpdate, uuid } from "@/utils/validation";

function jobId(raw: string): string {
  const parsed = uuid.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "Invalid job id");
  return parsed.data;
}

export const Route = createFileRoute("/api/jobs/$id")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(request),

      GET: async ({ request, params }) =>
        restRoute(request, "jobs-read", async ({ supabase }) =>
          Response.json(await getJob(supabase, jobId(params.id))),
        ),

      PUT: async ({ request, params }) =>
        restRoute(request, "jobs-write", async ({ supabase }) => {
          const id = jobId(params.id);
          const input = await readJson(request, (v) => jobUpdate.parse(v));
          const job = await updateJob(supabase, id, input);
          await auditRest(request, {
            action: "job.update",
            resourceType: "job",
            resourceId: id,
            details: { fields: Object.keys(input) },
          });
          return Response.json(job);
        }),

      DELETE: async ({ request, params }) =>
        restRoute(request, "jobs-write", async ({ supabase }) => {
          const id = jobId(params.id);
          const result = await deleteJob(supabase, id);
          await auditRest(request, { action: "job.delete", resourceType: "job", resourceId: id });
          return Response.json(result);
        }),
    },
  },
});
