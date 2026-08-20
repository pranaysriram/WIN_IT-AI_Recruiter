import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { jobsQuery } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/jobs")({
  component: JobsPage,
  head: () => ({
    meta: [
      { title: "Open Roles & Job Briefs | Ava Recruit" },
      {
        name: "description",
        content:
          "Maintain the job descriptions the AI assistant uses to pitch roles and answer candidate questions on every call.",
      },
      { property: "og:title", content: "Open Roles & Job Briefs | Ava Recruit" },
      {
        property: "og:description",
        content: "Job briefs that power the AI recruiter's pitch and FAQ answers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const EMPTY = {
  title: "",
  company_name: "",
  location: "",
  employment_type: "Full-time",
  salary_range: "",
  jd_text: "",
};

function JobsPage() {
  const qc = useQueryClient();
  const jobs = useQuery(jobsQuery);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  function openNew() {
    setEditingId(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(job: {
    job_id: string;
    title: string;
    company_name: string | null;
    location: string | null;
    employment_type: string | null;
    salary_range: string | null;
    jd_text: string | null;
  }) {
    setEditingId(job.job_id);
    setForm({
      title: job.title,
      company_name: job.company_name ?? "",
      location: job.location ?? "",
      employment_type: job.employment_type ?? "Full-time",
      salary_range: job.salary_range ?? "",
      jd_text: job.jd_text ?? "",
    });
    setOpen(true);
  }

  const saveJob = useMutation({
    mutationFn: async () => {
      const { error } = editingId
        ? await supabase.from("jobs").update(form).eq("job_id", editingId)
        : await supabase.from("jobs").insert(form);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(editingId ? "Role updated" : "Role added");
      setForm(EMPTY);
      setEditingId(null);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteJob = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase.from("jobs").delete().eq("job_id", jobId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Role deleted");
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Open roles"
      subtitle="The AI reads these briefs aloud and answers candidate FAQs from them."
      actions={
        <Button onClick={openNew}>
          <Plus className="size-4" /> New role
        </Button>
      }
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit role" : "New role"}</DialogTitle>
            <DialogDescription>
              Job description text is used verbatim by the calling assistant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(
              [
                ["title", "Job title"],
                ["company_name", "Company"],
                ["location", "Location"],
                ["employment_type", "Employment type"],
                ["salary_range", "Salary range"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="jd">Job description</Label>
              <Textarea
                id="jd"
                rows={6}
                value={form.jd_text}
                onChange={(e) => setForm({ ...form, jd_text: e.target.value })}
              />
            </div>
            <Button
              className="w-full"
              disabled={!form.title || saveJob.isPending}
              onClick={() => saveJob.mutate()}
            >
              {editingId ? "Save changes" : "Save role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(jobs.data ?? []).map((job) => (
          <article key={job.job_id} className="panel flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{job.title}</h2>
                <p className="text-xs text-muted-foreground">{job.company_name}</p>
              </div>
              <Badge variant="secondary">{job.employment_type}</Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{job.location}</p>
            <p className="mt-1 text-sm font-medium text-primary">{job.salary_range}</p>
            <p className="mt-4 line-clamp-5 text-sm text-muted-foreground">{job.jd_text}</p>
            <div className="mt-4 flex gap-2 border-t border-border/60 pt-4">
              <Button size="sm" variant="secondary" onClick={() => openEdit(job)}>
                <Pencil className="size-4" /> Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={deleteJob.isPending}
                onClick={() => {
                  if (confirm(`Delete "${job.title}"?`)) deleteJob.mutate(job.job_id);
                }}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}

