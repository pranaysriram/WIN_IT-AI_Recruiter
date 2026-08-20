import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { telephonySettingsQuery, atsSettingsQuery } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Telephony Settings | Ava Recruit" },
      {
        name: "description",
        content:
          "Connect your ElevenLabs voice agent and Twilio number to place real outbound screening calls from Ava Recruit.",
      },
      { property: "og:title", content: "Telephony Settings | Ava Recruit" },
      {
        property: "og:description",
        content: "Configure live AI phone screening with ElevenLabs and Twilio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery(telephonySettingsQuery);
  const [form, setForm] = useState({
    agent_id: "",
    agent_phone_number_id: "",
    caller_label: "",
    enabled: false,
  });

  useEffect(() => {
    if (settings.data) {
      setForm({
        agent_id: settings.data.agent_id ?? "",
        agent_phone_number_id: settings.data.agent_phone_number_id ?? "",
        caller_label: settings.data.caller_label ?? "",
        enabled: settings.data.enabled,
      });
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("telephony_settings")
        .update({
          agent_id: form.agent_id.trim() || null,
          agent_phone_number_id: form.agent_phone_number_id.trim() || null,
          caller_label: form.caller_label.trim() || null,
          enabled: form.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("singleton", true);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Telephony settings saved");
      qc.invalidateQueries({ queryKey: ["telephony-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stableUrls = {
    production: "https://project--3c359b94-f9c4-4ada-afbf-798473ebecc6.lovable.app/api/public/elevenlabs-call",
    preview: "https://project--3c359b94-f9c4-4ada-afbf-798473ebecc6-dev.lovable.app/api/public/elevenlabs-call",
  };


  return (
    <AppShell
      title="Settings"
      subtitle="Connect a real phone line so Ava dials candidates instead of simulating the conversation."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="panel space-y-6 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Live calling</h2>
              <p className="text-sm text-muted-foreground">
                Uses your ElevenLabs conversational agent with its Twilio number.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={form.enabled ? "default" : "secondary"}>
                {form.enabled ? "Enabled" : "Off"}
              </Badge>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="agent">Agent ID</Label>
              <Input
                id="agent"
                placeholder="agent_xxxxxxxxxxxxxxxx"
                value={form.agent_id}
                onChange={(e) => setForm({ ...form, agent_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Agent phone number ID</Label>
              <Input
                id="phone"
                placeholder="phnum_xxxxxxxxxxxxxxxx"
                value={form.agent_phone_number_id}
                onChange={(e) => setForm({ ...form, agent_phone_number_id: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="label">Caller label (shown to your team)</Label>
              <Input
                id="label"
                placeholder="Ava — +1 415 555 0142"
                value={form.caller_label}
                onChange={(e) => setForm({ ...form, caller_label: e.target.value })}
              />
            </div>
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Save settings
          </Button>

          <div className="border-t border-border pt-6">
            <AtsSettingsSection />
          </div>
        </div>

        <aside className="panel space-y-4 p-6 text-sm">
          <h3 className="font-semibold">Setup checklist</h3>
          <ol className="list-decimal space-y-3 pl-4 text-muted-foreground">
            <li>Import your Twilio number into ElevenLabs (Agents → Phone numbers).</li>
            <li>
              Build the screening agent and add data-collection fields named{" "}
              <code className="font-mono text-xs">current_salary</code>,{" "}
              <code className="font-mono text-xs">expected_salary</code>,{" "}
              <code className="font-mono text-xs">notice_period</code>,{" "}
              <code className="font-mono text-xs">skills_confirmation</code>,{" "}
              <code className="font-mono text-xs">location_preference</code>,{" "}
              <code className="font-mono text-xs">work_preference</code>,{" "}
              <code className="font-mono text-xs">interest_level</code>,{" "}
              <code className="font-mono text-xs">availability</code>.
            </li>
            <li>
              Use dynamic variables in the prompt:{" "}
              <code className="font-mono text-xs">
                {"{{candidate_name}} {{job_title}} {{company_name}} {{salary_range}}"}
              </code>
              .
            </li>
            <li>
              Add a post-call transcription webhook pointing at:
              <div className="mt-2 space-y-2">
                <div>
                  <span className="text-xs font-medium text-foreground">Production (recommended)</span>
                  <span className="block break-all rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">
                    {stableUrls.production}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-medium text-foreground">Preview</span>
                  <span className="block break-all rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">
                    {stableUrls.preview}
                  </span>
                </div>
              </div>
            </li>

            <li>Paste the webhook signing secret into this project when prompted.</li>
            <li>Save the agent and phone number IDs here, then flip live calling on.</li>
          </ol>
        </aside>
      </div>
    </AppShell>
  );
}

function AtsSettingsSection() {
  const qc = useQueryClient();
  const ats = useQuery(atsSettingsQuery);
  const [form, setForm] = useState({
    provider: "greenhouse",
    base_url: "",
    default_board_id: "",
    enabled: false,
  });

  useEffect(() => {
    if (ats.data) {
      setForm({
        provider: ats.data.provider ?? "greenhouse",
        base_url: ats.data.base_url ?? "",
        default_board_id: ats.data.default_board_id ?? "",
        enabled: ats.data.enabled,
      });
    }
  }, [ats.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("ats_settings")
        .update({
          provider: form.provider,
          base_url: form.base_url.trim() || null,
          default_board_id: form.default_board_id.trim() || null,
          enabled: form.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("singleton", true);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("ATS settings saved");
      qc.invalidateQueries({ queryKey: ["ats-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">ATS sync</h2>
          <p className="text-sm text-muted-foreground">
            Push screened candidates and their answers into Greenhouse, Lever or your own endpoint.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={form.enabled ? "default" : "secondary"}>
            {form.enabled ? "Enabled" : "Off"}
          </Badge>
          <Switch
            checked={form.enabled}
            onCheckedChange={(v) => setForm({ ...form, enabled: v })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ats-provider">Provider</Label>
          <select
            id="ats-provider"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value })}
          >
            <option value="greenhouse">Greenhouse</option>
            <option value="lever">Lever</option>
            <option value="custom">Custom webhook</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ats-board">Default job / board ID</Label>
          <Input
            id="ats-board"
            value={form.default_board_id}
            onChange={(e) => setForm({ ...form, default_board_id: e.target.value })}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ats-url">API base URL</Label>
          <Input
            id="ats-url"
            value={form.base_url}
            onChange={(e) => setForm({ ...form, base_url: e.target.value })}
            placeholder="https://harvest.greenhouse.io/v1"
          />
          <p className="text-xs text-muted-foreground">
            The ATS API key is stored as a server secret (ATS_API_KEY) and never exposed to the browser.
          </p>
        </div>
      </div>

      <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>
        Save ATS settings
      </Button>
    </div>
  );
}
