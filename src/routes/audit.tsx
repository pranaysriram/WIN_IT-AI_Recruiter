import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { listAuditLogs, type AuditRow } from "@/controllers/auditController";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/audit")({
  component: AuditPage,
  head: () => ({
    meta: [
      { title: "Audit Log | Ava Recruit" },
      {
        name: "description",
        content:
          "Tamper-resistant audit trail of every call, ATS sync and configuration change made in Ava Recruit.",
      },
      { property: "og:title", content: "Audit Log | Ava Recruit" },
      {
        property: "og:description",
        content: "Who did what, when, and from where across your recruitment workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const STATUS_FILTERS = ["all", "success", "failure", "denied"] as const;

function AuditPage() {
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const fetchLogs = useServerFn(listAuditLogs);

  const { data, isLoading } = useQuery<AuditRow[]>({
    queryKey: ["audit-logs", status],
    queryFn: () =>
      fetchLogs({ data: { limit: 150, ...(status === "all" ? {} : { status }) } }),
    refetchInterval: 30_000,
  });

  return (
    <AppShell
      title="Audit log"
      subtitle="Every privileged action is recorded server-side and is read-only in the app."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          {STATUS_FILTERS.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "default" : "outline"}
              onClick={() => setStatus(s)}
              className="capitalize"
            >
              {s}
            </Button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading audit trail…
            </div>
          ) : !data?.length ? (
            <p className="p-6 text-sm text-muted-foreground">No audit entries yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Actor</th>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Resource</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id} className="border-t border-border/60">
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-2">
                      {row.actor_email ?? "system"}
                    </td>
                    <td className="px-4 py-2 font-medium">{row.action}</td>
                    <td className="max-w-[220px] truncate px-4 py-2 text-muted-foreground">
                      {row.resource_type ? `${row.resource_type}:${row.resource_id ?? "-"}` : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        className={
                          row.status === "success"
                            ? "bg-primary/15 text-primary"
                            : "bg-destructive/15 text-destructive"
                        }
                      >
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{row.ip_address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
