import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/middleware/auth";
import { atsImportInput, atsPushInput } from "@/utils/validation";
import {
  fetchAtsCandidates,
  loadAtsSettings,
  updateAtsCandidate,
} from "@/services/atsService.server";
import { normalizePhone } from "@/utils/validation";
import { recordAudit } from "@/middleware/audit.server";

export type AtsImportResult = {
  fetched: number;
  imported: number;
  updated: number;
  skipped: number;
  error: string | null;
  rows: { name: string; externalId: string; action: "imported" | "updated" | "skipped" }[];
};

export type AtsPushResult = {
  pushed: number;
  failed: number;
  rows: { name: string; ok: boolean; reason: string | null }[];
};

/** ATS → our system: pull candidates and upsert them locally. */
export const importAtsCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => atsImportInput.parse(data))
  .handler(async ({ data, context }): Promise<AtsImportResult> => {
    const supabase = context.supabase;
    const settings = await loadAtsSettings(supabase);
    if (!settings) throw new Error("ATS settings are not initialised");

    const { candidates, error } = await fetchAtsCandidates(settings, data.limit ?? 25, supabase);
    const result: AtsImportResult = {
      fetched: candidates.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      error,
      rows: [],
    };
    if (error) return result;

    for (const c of candidates) {
      const { data: existing } = await supabase
        .from("candidates")
        .select("candidate_id")
        .eq("ats_external_id", c.externalId)
        .maybeSingle();

      const payload = {
        full_name: c.fullName,
        email: c.email,
        phone_number: normalizePhone(c.phone),
        source: settings.provider,
        ats_external_id: c.externalId,
        ats_id: c.externalId,
        ats_synced_at: new Date().toISOString(),
        consent_given_at: new Date().toISOString(),
      };

      if (existing) {
        const { error: upErr } = await supabase
          .from("candidates")
          .update(payload)
          .eq("candidate_id", existing.candidate_id);
        if (upErr) {
          result.skipped += 1;
          result.rows.push({ name: c.fullName, externalId: c.externalId, action: "skipped" });
        } else {
          result.updated += 1;
          result.rows.push({ name: c.fullName, externalId: c.externalId, action: "updated" });
        }
      } else {
        const { error: insErr } = await supabase.from("candidates").insert({
          ...payload,
          status: "new",
        });
        if (insErr) {
          result.skipped += 1;
          result.rows.push({ name: c.fullName, externalId: c.externalId, action: "skipped" });
        } else {
          result.imported += 1;
          result.rows.push({ name: c.fullName, externalId: c.externalId, action: "imported" });
        }
      }
    }

    await recordAudit({
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
      action: "ats.import",
      resourceType: "candidates",
      status: result.error ? "failure" : "success",
      details: {
        fetched: result.fetched,
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
      },
    });


    return result;
  });

/** Our system → ATS: push current status back for already-linked candidates. */
export const pushCandidateUpdates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => atsPushInput.parse(data))
  .handler(async ({ data, context }): Promise<AtsPushResult> => {
    const supabase = context.supabase;
    const settings = await loadAtsSettings(supabase);
    if (!settings) throw new Error("ATS settings are not initialised");

    let query = supabase
      .from("candidates")
      .select("candidate_id, full_name, status, ats_external_id")
      .not("ats_external_id", "is", null)
      .limit(50);
    if (data.candidateIds?.length) query = query.in("candidate_id", data.candidateIds);

    const { data: rows } = await query;
    const result: AtsPushResult = { pushed: 0, failed: 0, rows: [] };

    for (const row of rows ?? []) {
      const res = await updateAtsCandidate(settings, row.ats_external_id as string, {
        status: row.status,
        notes: "Updated by Ava Recruit AI screening",
      }, supabase);
      if (res.synced) {
        result.pushed += 1;
        await supabase
          .from("candidates")
          .update({ ats_synced_at: new Date().toISOString() })
          .eq("candidate_id", row.candidate_id);
      } else {
        result.failed += 1;
      }
      result.rows.push({ name: row.full_name, ok: res.synced, reason: res.reason });
    }

    await recordAudit({
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
      action: "ats.push",
      resourceType: "candidates",
      status: result.failed ? "failure" : "success",
      details: { pushed: result.pushed, failed: result.failed },
    });

    return result;
  });
