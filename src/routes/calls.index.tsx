import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { callsQuery } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/calls/")({
  component: CallsPage,
  head: () => ({
    meta: [
      { title: "Call Log & Transcripts | Ava Recruit" },
      {
        name: "description",
        content:
          "Browse every AI recruitment call with status, duration, extraction confidence, recording and full transcript.",
      },
      { property: "og:title", content: "Call Log & Transcripts | Ava Recruit" },
      {
        property: "og:description",
        content: "Every AI screening call with transcript, recording and structured answers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function duration(start: string | null, end: string | null) {
  if (!start || !end) return "—";
  const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function CallsPage() {
  const calls = useQuery(callsQuery);
  const rows = calls.data ?? [];

  return (
    <AppShell title="Call log" subtitle={`${rows.length} calls recorded and transcribed`}>
      <div className="panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidate</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.call_id} className="cursor-pointer">
                <TableCell>
                  <Link
                    to="/calls/$callId"
                    params={{ callId: c.call_id }}
                    className="font-medium hover:text-primary"
                  >
                    {c.candidates?.full_name ?? "Unknown"}
                  </Link>
                  <p className="font-mono text-xs text-muted-foreground">
                    {c.candidates?.phone_number ?? "—"}
                  </p>
                </TableCell>
                <TableCell className="text-sm">{c.jobs?.title ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c.call_start_time ? new Date(c.call_start_time).toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {duration(c.call_start_time, c.call_end_time)}
                </TableCell>
                <TableCell className="text-xs">
                  {c.ai_confidence ? `${c.ai_confidence}%` : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{c.call_status.replace("_", " ")}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!rows.length ? (
          <p className="p-6 text-sm text-muted-foreground">No calls yet.</p>
        ) : null}
      </div>
    </AppShell>
  );
}
