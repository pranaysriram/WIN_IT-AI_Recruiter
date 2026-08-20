import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PhoneCall, Users, CalendarClock, Gauge } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { callsQuery, candidatesQuery, interviewsQuery, jobsQuery } from "@/services/api";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Call Dashboard | Ava Recruit AI Calling Assistant" },
      {
        name: "description",
        content:
          "Monitor AI outbound recruitment calls, screening answers, transcripts and interview scheduling from one live dashboard.",
      },
      { property: "og:title", content: "Ava Recruit — AI Recruitment Calling Assistant" },
      {
        property: "og:description",
        content: "Automated AI screening calls, structured answers and interview scheduling.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function statusTone(status: string) {
  if (status === "completed") return "bg-success/15 text-success";
  if (status === "no_answer" || status === "failed") return "bg-destructive/15 text-destructive";
  if (status === "declined") return "bg-warning/15 text-warning";
  return "bg-muted text-muted-foreground";
}

function Dashboard() {
  const calls = useQuery(callsQuery);
  const candidates = useQuery(candidatesQuery);
  const interviews = useQuery(interviewsQuery);
  const jobs = useQuery(jobsQuery);

  const callRows = calls.data ?? [];
  const completed = callRows.filter((c) => c.call_status === "completed");
  const connectRate = callRows.length
    ? Math.round((completed.length / callRows.length) * 100)
    : 0;
  const avgConfidence = completed.length
    ? Math.round(
        (completed.reduce((sum, c) => sum + Number(c.ai_confidence ?? 0), 0) / completed.length) *
          10,
      ) / 10
    : 0;

  const stats = [
    { label: "Calls placed", value: callRows.length, icon: PhoneCall },
    { label: "Candidates", value: candidates.data?.length ?? 0, icon: Users },
    { label: "Interviews booked", value: interviews.data?.length ?? 0, icon: CalendarClock },
    { label: "Connect rate", value: `${connectRate}%`, icon: Gauge },
  ];

  return (
    <AppShell
      title="Call operations"
      subtitle={`${jobs.data?.length ?? 0} open roles · avg extraction confidence ${avgConfidence}%`}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="panel p-5">
            <div className="flex items-center justify-between">
              <span className="text-eyebrow">{label}</span>
              <Icon className="size-4 text-primary" />
            </div>
            <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="panel p-5">
          <h2 className="text-sm font-semibold">Recent calls</h2>
          <div className="mt-4 divide-y divide-border">
            {callRows.slice(0, 6).map((call) => (
              <Link
                key={call.call_id}
                to="/calls/$callId"
                params={{ callId: call.call_id }}
                className="flex items-center justify-between gap-4 py-3 transition-colors hover:text-primary"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {call.candidates?.full_name ?? "Unknown candidate"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {call.jobs?.title ?? "No role"} ·{" "}
                    {new Date(call.created_at).toLocaleString()}
                  </p>
                </div>
                <Badge className={statusTone(call.call_status)} variant="secondary">
                  {call.call_status.replace("_", " ")}
                </Badge>
              </Link>
            ))}
            {!callRows.length ? (
              <p className="py-6 text-sm text-muted-foreground">
                No calls yet — start one from the Candidates page.
              </p>
            ) : null}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-sm font-semibold">Upcoming interviews</h2>
          <div className="mt-4 space-y-3">
            {(interviews.data ?? []).slice(0, 5).map((i) => (
              <div key={i.schedule_id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{i.candidates?.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {i.jobs?.title} · {i.interview_date} at {i.interview_time.slice(0, 5)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Interviewer: {i.interviewer_name ?? "TBD"}
                </p>
              </div>
            ))}
            {!interviews.data?.length ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
