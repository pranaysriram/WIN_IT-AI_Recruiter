import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, PhoneCall, RefreshCw, Download } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CallStatus } from "@/components/CallStatus";
import { InterviewCard } from "@/components/InterviewCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { candidateDetailQuery, QUESTION_LABELS } from "@/services/api";
import { syncCandidateToAts } from "@/controllers/candidateController";

export const Route = createFileRoute("/candidates/$candidateId")({
  head: () => ({
    meta: [
      { title: "Candidate profile — Ava Recruit" },
      {
        name: "description",
        content:
          "Full screening history for a candidate: every AI call, extracted answers, interviews and ATS sync status.",
      },
      { property: "og:title", content: "Candidate profile — Ava Recruit" },
      {
        property: "og:description",
        content: "Screening history, transcripts and interview schedule for one candidate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CandidateDetailsPage,
});

function CandidateDetailsPage() {
  const { candidateId } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(candidateDetailQuery(candidateId));
  const syncAts = useServerFn(syncCandidateToAts);
  const [syncing, setSyncing] = useState(false);

  const candidate = data?.candidate;

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await syncAts({ data: { candidateId } });
      if (res.synced) {
        toast.success("Candidate pushed to your ATS");
        void qc.invalidateQueries({ queryKey: ["candidate", candidateId] });
      } else {
        toast.error(res.reason ?? "ATS sync did not run");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ATS sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <AppShell
      title={candidate?.full_name ?? "Candidate"}
      subtitle="Every screening call, answer and interview for this person."
      actions={
        <>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/candidates">
              <ArrowLeft className="size-4" /> Pipeline
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} /> Sync to ATS
          </Button>
        </>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      ) : !candidate ? (
        <p className="text-sm text-muted-foreground">This candidate no longer exists.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <Card className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-eyebrow">Profile</p>
                <Badge variant="secondary" className="capitalize">
                  {(candidate.status ?? "new").replace(/_/g, " ")}
                </Badge>
              </div>
              <dl className="space-y-2 text-sm">
                <Row label="Phone" value={candidate.phone_number} />
                <Row label="Email" value={candidate.email} />
                <Row label="Role" value={candidate.jobs?.title ?? null} />
                <Row label="Company" value={candidate.jobs?.company_name ?? null} />
                <Row label="ATS id" value={candidate.ats_external_id} />
                <Row
                  label="ATS synced"
                  value={
                    candidate.ats_synced_at
                      ? new Date(candidate.ats_synced_at).toLocaleString()
                      : "Never"
                  }
                />
              </dl>
            </Card>

            <Card className="space-y-3 p-5">
              <p className="text-eyebrow">Interviews</p>
              {data.interviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing booked yet.</p>
              ) : (
                data.interviews.map((i) => (
                  <InterviewCard
                    key={i.schedule_id}
                    date={i.interview_date}
                    time={i.interview_time}
                    interviewer={i.interviewer_name}
                    meetingLink={i.meeting_link}
                    candidateName={candidate.full_name}
                    actions={
                      i.calendar_event_url ? (
                        <Button size="sm" variant="outline" asChild>
                          <a href={i.calendar_event_url} target="_blank" rel="noreferrer">
                            <Download className="size-4" /> Add to calendar
                          </a>
                        </Button>
                      ) : null
                    }
                  />
                ))
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <p className="text-eyebrow mb-3">Screening answers</p>
              {data.responses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No answers captured yet.</p>
              ) : (
                <dl className="grid gap-3 sm:grid-cols-2">
                  {data.responses.map((r) => (
                    <div key={r.response_id} className="rounded-lg border border-border p-3">
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {QUESTION_LABELS[r.question_code] ?? r.question_code}
                      </dt>
                      <dd className="mt-1 text-sm">{r.response_value ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>

            <Card className="p-5">
              <p className="text-eyebrow mb-3">Call history</p>
              {data.calls.length === 0 ? (
                <p className="text-sm text-muted-foreground">No calls placed yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.calls.map((c) => (
                    <Link
                      key={c.call_id}
                      to="/calls/$callId"
                      params={{ callId: c.call_id }}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary/40"
                    >
                      <span className="flex items-center gap-2">
                        <PhoneCall className="size-3.5 text-muted-foreground" />
                        {c.call_start_time
                          ? new Date(c.call_start_time).toLocaleString()
                          : "Not started"}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {c.provider === "simulated" ? "Simulated" : "Live"}
                        </span>
                        <CallStatus status={c.call_status} />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm">{value ?? "—"}</dd>
    </div>
  );
}
