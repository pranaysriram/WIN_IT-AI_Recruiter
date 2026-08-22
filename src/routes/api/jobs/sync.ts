import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createJob, updateJob } from "@/services/restResourceService.server";
import { preflight, readJson, restRoute } from "@/services/restHandler.server";

const jobInput = z.object({
  title: z.string().min(1).max(150),
  company_name: z.string().max(150).nullable().optional(),
  location: z.string().max(150).nullable().optional(),
  employment_type: z.string().max(50).nullable().optional(),
  salary_range: z.string().max(50).nullable().optional(),
  jd_text: z.string().max(20000).nullable().optional(),
});

const payloadSchema = z.object({
  jobs: z.array(jobInput).optional(),
});

export const Route = createFileRoute("/api/jobs/sync")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(request),

      POST: async ({ request }) =>
        restRoute(request, "jobs-sync", async ({ supabase }) => {
          let incoming = { jobs: [] as Array<z.infer<typeof jobInput>> };

          try {
            const contentType = request.headers.get("content-type") ?? "";
            if (contentType.includes("application/json")) {
              incoming = await readJson(request, (value) => payloadSchema.parse(value));
            }
          } catch {
            incoming = { jobs: [] };
          }

          const jobs = incoming.jobs ?? [];
          const summary = {
            total: jobs.length,
            added: 0,
            updated: 0,
            skipped: 0,
            rows: [] as Array<{ title: string; company_name?: string | null; action: "added" | "updated" | "skipped" }>,
          };

          for (const job of jobs) {
            try {
              const rows = await supabase
                .from("jobs")
                .select("job_id")
                .ilike("title", job.title)
                .eq("company_name", job.company_name ?? "")
                .limit(1);

              if (rows.data && rows.data.length > 0) {
                const target = rows.data[0];
                await updateJob(supabase, target.job_id, job);
                summary.updated += 1;
                summary.rows.push({ title: job.title, company_name: job.company_name, action: "updated" });
              } else {
                await createJob(supabase, job);
                summary.added += 1;
                summary.rows.push({ title: job.title, company_name: job.company_name, action: "added" });
              }
            } catch {
              summary.skipped += 1;
              summary.rows.push({ title: job.title, company_name: job.company_name, action: "skipped" });
            }
          }

          return Response.json(summary);
        }),
    },
  },
});
