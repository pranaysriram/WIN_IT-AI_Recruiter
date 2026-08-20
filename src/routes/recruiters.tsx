import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Mail, Pencil, Phone, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { recruitersQuery } from "@/services/api";
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

export const Route = createFileRoute("/recruiters")({
  component: RecruitersPage,
  head: () => ({
    meta: [
      { title: "Recruiter Team Directory | Ava Recruit" },
      {
        name: "description",
        content:
          "Manage the recruiters who own screening calls and interviews: add teammates, update contact details, and keep the hiring desk in sync.",
      },
      { property: "og:title", content: "Recruiter Team Directory | Ava Recruit" },
      {
        property: "og:description",
        content: "Add and manage the recruiters running AI screening calls and interviews.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const EMPTY = { full_name: "", email: "", phone_number: "", company_name: "" };

function RecruitersPage() {
  const qc = useQueryClient();
  const recruiters = useQuery(recruitersQuery);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["recruiters"] });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone_number: form.phone_number.trim() || null,
        company_name: form.company_name.trim() || null,
      };
      if (!payload.full_name) throw new Error("Name is required");
      const res = editingId
        ? await supabase.from("recruiters").update(payload).eq("recruiter_id", editingId)
        : await supabase.from("recruiters").insert(payload);
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      toast.success(editingId ? "Recruiter updated" : "Recruiter added");
      setOpen(false);
      setEditingId(null);
      setForm(EMPTY);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recruiters").delete().eq("recruiter_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recruiter removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = recruiters.data ?? [];

  return (
    <AppShell
      title="Recruiters"
      subtitle="The hiring desk behind every screening call and interview invite."
      actions={
        <Button
          onClick={() => {
            setEditingId(null);
            setForm(EMPTY);
            setOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="size-4" /> Add recruiter
        </Button>
      }
    >


      {recruiters.isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading recruiters…</p>
      ) : list.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No recruiters yet. Add your first teammate to assign interviews.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => (
            <article
              key={r.recruiter_id}
              className="rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <UserRound className="size-4" />
                  </span>
                  <div>
                    <p className="font-medium">{r.full_name}</p>
                    {r.company_name ? (
                      <Badge variant="secondary" className="mt-1">
                        {r.company_name}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingId(r.recruiter_id);
                      setForm({
                        full_name: r.full_name,
                        email: r.email ?? "",
                        phone_number: r.phone_number ?? "",
                        company_name: r.company_name ?? "",
                      });
                      setOpen(true);
                    }}
                    aria-label={`Edit ${r.full_name}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove.mutate(r.recruiter_id)}
                    aria-label={`Delete ${r.full_name}`}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <dl className="mt-4 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="size-3.5" />
                  <span className="truncate">{r.email ?? "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="size-3.5" />
                  <span>{r.phone_number ?? "—"}</span>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit recruiter" : "Add recruiter"}</DialogTitle>
            <DialogDescription>
              Recruiters can be assigned as interviewers when booking a slot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rec-name">Full name</Label>
              <Input
                id="rec-name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Priya Sharma"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-email">Email</Label>
              <Input
                id="rec-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="priya@company.com"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rec-phone">Phone</Label>
                <Input
                  id="rec-phone"
                  value={form.phone_number}
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-company">Company</Label>
                <Input
                  id="rec-company"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  placeholder="Acme Talent"
                />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving…" : editingId ? "Save changes" : "Add recruiter"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
