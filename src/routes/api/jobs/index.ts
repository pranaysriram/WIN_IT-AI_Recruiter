import { createFileRoute } from "@tanstack/react-router";
import { auditRest, preflight, readJson, restRoute } from "@/services/restHandler.server";
import { createJob, listJobs, parseListQuery } from "@/services/restResourceService.server";
import { jobCreate } from "@/utils/validation";

export const Route = createFileRoute("/api/jobs/")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(request),

      GET: async ({ request }) =>
        restRoute(request, "jobs-list", async ({ supabase }) =>
          Response.json(await listJobs(supabase, parseListQuery(request))),
        ),

      POST: async ({ request }) =>
        restRoute(request, "jobs-write", async ({ supabase }) => {
          const input = await readJson(request, (v) => jobCreate.parse(v));
          const job = await createJob(supabase, input);
          await auditRest(request, {
            action: "job.create",
            resourceType: "job",
            resourceId: job.job_id,
          });
          return Response.json(job, { status: 201 });
        }),
    },
  },
});
