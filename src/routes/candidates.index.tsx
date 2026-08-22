import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Pencil, PhoneOutgoing, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { candidatesQuery, jobsQuery } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/candidates/")({
  component: CandidatesPage,
  head: () => ({
    meta: [
      { title: "Candidate Pipeline | Ava Recruit" },
      {
        name: "description",
        content:
          "Import candidates from CSV or ATS, map them to open roles and trigger AI screening calls in one click.",
      },
      { property: "og:title", content: "Candidate Pipeline | Ava Recruit" },
      {
        property: "og:description",
        content: "Manage shortlisted candidates and launch AI screening calls.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function CandidatesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const candidates = useQuery(candidatesQuery);
  const jobs = useQuery(jobsQuery);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", phone_number: "", email: "", job_id: "" });
  const [callingId, setCallingId] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("candidates-live-calls")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_sessions" },
        () => {
          qc.invalidateQueries({ queryKey: ["calls"] });
          qc.invalidateQueries({ queryKey: ["candidates"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const saveCandidate = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: form.full_name,
        phone_number: form.phone_number || null,
        email: form.email || null,
        job_id: form.job_id || null,
      };
      const { error } = editingId
        ? await supabase.from("candidates").update(payload).eq("candidate_id", editingId)
        : await supabase.from("candidates").insert({ ...payload, source: "manual" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(editingId ? "Candidate updated" : "Candidate added");
      setForm({ full_name: "", phone_number: "", email: "", job_id: "" });
      setEditingId(null);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCandidate = useMutation({
    mutationFn: async (candidateId: string) => {
      const { error } = await supabase
        .from("candidates")
        .delete()
        .eq("candidate_id", candidateId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Candidate deleted");
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("foreign key")
          ? "This candidate has call history and cannot be deleted."
          : e.message,
      ),
  });

  const startCall = useMutation({
    mutationFn: async (candidateId: string) => {
      setCallingId(candidateId);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session is no longer valid. Please sign in again.");

      const response = await fetch("/api/calls/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ candidateId }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; call_id?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Call initiation failed");
      }

      return payload as { call_id: string };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["calls"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      navigate({ to: "/calls/$callId", params: { callId: res.call_id } });
      toast.success("Dialing candidate", {
        description: "The transcript appears here automatically when the call ends.",
      });
    },
    onError: (e: Error) => toast.error(e.message || "Call failed"),
    onSettled: () => setCallingId(null),
  });

  async function onCsv(file: File) {
    const text = await file.text();
    const [header, ...lines] = text.trim().split(/\r?\n/);
    const cols = (header ?? "").split(",").map((c) => c.trim().toLowerCase());
    const rows = lines
      .filter(Boolean)
      .map((line) => {
        const cells = line.split(",").map((c) => c.trim());
        const get = (k: string) => cells[cols.indexOf(k)] ?? null;
        return {
          full_name: get("full_name") ?? get("name") ?? "Unknown",
          phone_number: get("phone_number") ?? get("phone"),
          email: get("email"),
          ats_id: get("ats_id"),
          source: "CSV Upload",
        };
      })
      .filter((r) => r.full_name !== "Unknown");
    if (!rows.length) {
      toast.error("No rows found. Expected headers: full_name, phone_number, email");
      return;
    }
    const { error } = await supabase.from("candidates").insert(rows);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${rows.length} candidates imported`);
    qc.invalidateQueries({ queryKey: ["candidates"] });
  }


  return (
    <AppShell
      title="Candidates"
      subtitle="Shortlist, import and dial. Every call is transcribed and parsed automatically."
      actions={
        <>
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload className="size-4" /> Import CSV
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onCsv(f);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          <Button
            onClick={() => {
              setEditingId(null);
              setForm({ full_name: "", phone_number: "", email: "", job_id: "" });
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> Add candidate
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit candidate" : "Add candidate"}</DialogTitle>
                <DialogDescription>
                  Added candidates become immediately callable by the AI assistant.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={form.phone_number}
                      onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mail">Email</Label>
                    <Input
                      id="mail"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={form.job_id}
                    onValueChange={(v) => setForm({ ...form, job_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an open role" />
                    </SelectTrigger>
                    <SelectContent>
                      {(jobs.data ?? []).map((j) => (
                        <SelectItem key={j.job_id} value={j.job_id}>
                          {j.title} — {j.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  disabled={!form.full_name || saveCandidate.isPending}
                  onClick={() => saveCandidate.mutate()}
                >
                  {editingId ? "Save changes" : "Save candidate"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

        </>
      }
    >
      <div className="panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidate</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(candidates.data ?? []).map((c) => {
              const job = jobs.data?.find((j) => j.job_id === c.job_id);
              return (
                <TableRow key={c.candidate_id}>
                  <TableCell>
                    <Link
                      to="/candidates/$candidateId"
                      params={{ candidateId: c.candidate_id }}
                      className="font-medium hover:text-primary"
                    >
                      {c.full_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{c.email ?? "—"}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.phone_number ?? "—"}</TableCell>
                  <TableCell className="text-sm">{job?.title ?? "Unassigned"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{c.source ?? "manual"}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.status.replace("_", " ")}
                  </TableCell>
                  <TableCell className="space-x-2 text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={startCall.isPending || !c.phone_number}
                      onClick={() => startCall.mutate(c.candidate_id)}
                    >
                      {callingId === c.candidate_id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <PhoneOutgoing className="size-4" />
                      )}
                      {callingId === c.candidate_id ? "Calling…" : "Call"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit ${c.full_name}`}
                      onClick={() => {
                        setEditingId(c.candidate_id);
                        setForm({
                          full_name: c.full_name,
                          phone_number: c.phone_number ?? "",
                          email: c.email ?? "",
                          job_id: c.job_id ?? "",
                        });
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      aria-label={`Delete ${c.full_name}`}
                      disabled={deleteCandidate.isPending}
                      onClick={() => {
                        if (confirm(`Delete ${c.full_name}?`))
                          deleteCandidate.mutate(c.candidate_id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
