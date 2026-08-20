import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { atsSettingsQuery, candidatesQuery } from "@/services/api";
import {
  importAtsCandidates,
  pushCandidateUpdates,
  type AtsImportResult,
  type AtsPushResult,
} from "@/controllers/atsController";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/ats")({
  component: AtsPage,
  head: () => ({
    meta: [
      { title: "ATS Sync | Ava Recruit" },
      {
        name: "description",
        content:
          "Two-way ATS sync: pull candidates from Greenhouse or Lever into Ava Recruit and push screening outcomes back.",
      },
      { property: "og:title", content: "ATS Sync | Ava Recruit" },
      {
        property: "og:description",
        content: "Fetch candidates from your ATS, screen them with AI, push results back.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function AtsPage() {
  const qc = useQueryClient();
  const { data: settings } = useQuery(atsSettingsQuery);
  const { data: candidates } = useQuery(candidatesQuery);
  const [importResult, setImportResult] = useState<AtsImportResult | null>(null);
  const [pushResult, setPushResult] = useState<AtsPushResult | null>(null);

  const runImport = useServerFn(importAtsCandidates);
  const runPush = useServerFn(pushCandidateUpdates);

  const importMutation = useMutation({
    mutationFn: () => runImport({ data: { limit: 25 } }),
    onSuccess: (res) => {
      setImportResult(res);
      qc.invalidateQueries({ queryKey: ["candidates"] });
      if (res.error) toast.error(res.error);
      else toast.success(`${res.imported} imported, ${res.updated} updated`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pushMutation = useMutation({
    mutationFn: () => runPush({ data: {} }),
    onSuccess: (res) => {
      setPushResult(res);
      qc.invalidateQueries({ queryKey: ["candidates"] });
      toast.success(`${res.pushed} pushed to ATS${res.failed ? `, ${res.failed} failed` : ""}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linked = (candidates ?? []).filter((c) => c.ats_external_id).length;

  return (
    <AppShell
      title="ATS sync"
      subtitle="ATS → fetch candidates → screen in Ava Recruit → push updates back to the ATS."
    >
      <div className="space-y-6">

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Plug className="size-4 text-primary" />
          <span className="text-sm">
            Provider <strong className="capitalize">{settings?.provider ?? "not set"}</strong>
          </span>
          <Badge className={settings?.enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}>
            {settings?.enabled ? "Sync enabled" : "Sync off"}
          </Badge>
          <span className="text-sm text-muted-foreground">{linked} candidates linked to ATS records</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold">
              <ArrowDownToLine className="size-4 text-primary" /> Fetch from ATS
            </h2>
            <p className="text-sm text-muted-foreground">
              Pulls the latest candidates and upserts them locally by their ATS ID.
            </p>
            <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
              {importMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Import candidates
            </Button>
            {importResult ? (
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  {importResult.fetched} fetched · {importResult.imported} new ·{" "}
                  {importResult.updated} updated · {importResult.skipped} skipped
                </p>
                {importResult.error ? (
                  <p className="text-destructive">{importResult.error}</p>
                ) : null}
                <ul className="max-h-52 space-y-1 overflow-auto">
                  {importResult.rows.map((r) => (
                    <li key={r.externalId} className="flex justify-between gap-2">
                      <span className="truncate">{r.name}</span>
                      <span className="text-xs text-muted-foreground">{r.action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold">
              <ArrowUpFromLine className="size-4 text-primary" /> Push updates back
            </h2>
            <p className="text-sm text-muted-foreground">
              Sends the current screening status of every linked candidate to the ATS.
            </p>
            <Button
              variant="secondary"
              onClick={() => pushMutation.mutate()}
              disabled={pushMutation.isPending}
            >
              {pushMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Push candidate updates
            </Button>
            {pushResult ? (
              <ul className="max-h-52 space-y-1 overflow-auto text-sm">
                {pushResult.rows.map((r, i) => (
                  <li key={`${r.name}-${i}`} className="flex justify-between gap-2">
                    <span className="truncate">{r.name}</span>
                    <span
                      className={
                        r.ok ? "text-xs text-primary" : "text-xs text-destructive truncate max-w-[50%]"
                      }
                    >
                      {r.ok ? "synced" : (r.reason ?? "failed")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
