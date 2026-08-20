/**
 * ATS sync (Greenhouse / Lever / generic webhook).
 *
 * Credentials live in the server-only secret ATS_API_KEY; provider and base URL
 * come from the `ats_settings` row managed in Settings.
 */
import type { DB } from "@/db/connection";
import { logger } from "@/utils/logger";
import { fetchWithRetry } from "@/utils/retry";

export type AtsSettings = {
  provider: string;
  base_url: string | null;
  default_board_id: string | null;
  enabled: boolean;
};

export type AtsResult = { synced: boolean; externalId: string | null; reason: string | null };

export function atsApiKey(): string | null {
  return process.env["ATS_API_KEY"] ?? null;
}

export async function loadAtsSettings(supabase: DB): Promise<AtsSettings | null> {
  const { data } = await supabase
    .from("ats_settings")
    .select("provider, base_url, default_board_id, enabled")
    .eq("singleton", true)
    .maybeSingle();
  return data as AtsSettings | null;
}

type CandidatePayload = {
  candidate_id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  status: string;
  ats_external_id: string | null;
};

/** Pushes (or updates) one candidate in the configured ATS. */
export async function pushCandidate(
  settings: AtsSettings,
  candidate: CandidatePayload,
  screening: { question_code: string; response_value: string }[],
): Promise<AtsResult> {
  if (!settings.enabled) return { synced: false, externalId: null, reason: "ATS sync is turned off" };
  const key = atsApiKey();
  if (!key) {
    return {
      synced: false,
      externalId: null,
      reason: "ATS_API_KEY is not set. Add the key, then retry the sync.",
    };
  }

  const [firstName, ...rest] = candidate.full_name.split(" ");
  const notes = screening.map((s) => `${s.question_code}: ${s.response_value}`).join("\n");

  let url: string;
  let headers: Record<string, string>;
  let body: unknown;

  if (settings.provider === "greenhouse") {
    url = `${settings.base_url ?? "https://harvest.greenhouse.io/v1"}/candidates`;
    headers = {
      Authorization: `Basic ${btoa(`${key}:`)}`,
      "Content-Type": "application/json",
    };
    body = {
      first_name: firstName,
      last_name: rest.join(" ") || "-",
      email_addresses: candidate.email ? [{ value: candidate.email, type: "personal" }] : [],
      phone_numbers: candidate.phone_number
        ? [{ value: candidate.phone_number, type: "mobile" }]
        : [],
      notes,
      applications: settings.default_board_id ? [{ job_id: settings.default_board_id }] : [],
    };
  } else if (settings.provider === "lever") {
    url = `${settings.base_url ?? "https://api.lever.co/v1"}/opportunities`;
    headers = {
      Authorization: `Basic ${btoa(`${key}:`)}`,
      "Content-Type": "application/json",
    };
    body = {
      name: candidate.full_name,
      emails: candidate.email ? [candidate.email] : [],
      phones: candidate.phone_number ? [{ value: candidate.phone_number }] : [],
      stage: candidate.status,
      tags: ["ava-recruit"],
    };
  } else {
    if (!settings.base_url) {
      return { synced: false, externalId: null, reason: "Set the ATS endpoint URL in Settings" };
    }
    url = settings.base_url;
    headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    body = { candidate, screening };
  }

  const res = await fetchWithRetry(url, { method: "POST", headers, body: JSON.stringify(body) }, { scope: "ats.push", attempts: 3 });
  const text = await res.text();
  if (!res.ok) {
    logger.error(`ATS sync failed [${res.status}]`, text);
    return { synced: false, externalId: null, reason: `ATS responded ${res.status}: ${text.slice(0, 200)}` };
  }

  let externalId: string | null = null;
  try {
    const json = JSON.parse(text) as { id?: string | number; data?: { id?: string } };
    externalId = String(json.id ?? json.data?.id ?? "") || null;
  } catch {
    externalId = null;
  }
  return { synced: true, externalId, reason: null };
}

/* ------------------------------------------------------------------ *
 * Phase 8 — inbound: ATS → our system
 * ------------------------------------------------------------------ */

export type AtsCandidate = {
  externalId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  stage: string | null;
};

type Fetched = { candidates: AtsCandidate[]; error: string | null };

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Pulls the candidate list from the configured ATS. */
export async function fetchAtsCandidates(
  settings: AtsSettings,
  limit = 50,
): Promise<Fetched> {
  if (!settings.enabled) return { candidates: [], error: "ATS sync is turned off" };
  const key = atsApiKey();
  if (!key) return { candidates: [], error: "ATS_API_KEY is not set. Add the key, then retry." };

  let url: string;
  let headers: Record<string, string>;

  if (settings.provider === "greenhouse") {
    const base = settings.base_url ?? "https://harvest.greenhouse.io/v1";
    url = `${base}/candidates?per_page=${limit}`;
    headers = { Authorization: `Basic ${btoa(`${key}:`)}` };
  } else if (settings.provider === "lever") {
    const base = settings.base_url ?? "https://api.lever.co/v1";
    url = `${base}/opportunities?limit=${limit}`;
    headers = { Authorization: `Basic ${btoa(`${key}:`)}` };
  } else {
    if (!settings.base_url) return { candidates: [], error: "Set the ATS endpoint URL in Settings" };
    url = `${settings.base_url}?limit=${limit}`;
    headers = { Authorization: `Bearer ${key}` };
  }

  let res: Response;
  try {
    res = await fetchWithRetry(url, { headers: { ...headers, Accept: "application/json" } }, { scope: "ats.fetch", attempts: 3 });
  } catch (err) {
    return { candidates: [], error: `ATS unreachable: ${(err as Error).message}` };
  }
  const text = await res.text();
  if (!res.ok) {
    logger.error(`ATS fetch failed [${res.status}]`, text);
    return { candidates: [], error: `ATS responded ${res.status}: ${text.slice(0, 200)}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { candidates: [], error: "ATS returned a non-JSON body" };
  }

  const rows: Record<string, unknown>[] = Array.isArray(parsed)
    ? (parsed as Record<string, unknown>[])
    : ((parsed as { data?: unknown; candidates?: unknown }).data as Record<string, unknown>[]) ??
      ((parsed as { candidates?: unknown }).candidates as Record<string, unknown>[]) ??
      [];

  const candidates = rows.slice(0, limit).map((row) => {
    const emails = row["emails"] as string[] | undefined;
    const emailObjs = row["email_addresses"] as { value?: string }[] | undefined;
    const phoneObjs = (row["phone_numbers"] ?? row["phones"]) as { value?: string }[] | undefined;
    const contact = row["contact"] as Record<string, unknown> | undefined;
    const first = asString(row["first_name"]);
    const last = asString(row["last_name"]);
    const stageObj = row["stage"] as { text?: string } | string | undefined;

    return {
      externalId: String(row["id"] ?? row["opportunityId"] ?? row["externalId"] ?? ""),
      fullName:
        asString(row["name"]) ??
        [first, last].filter(Boolean).join(" ") ??
        asString(contact?.["name"]) ??
        "Unnamed candidate",
      email:
        asString(row["email"]) ??
        asString(emails?.[0]) ??
        asString(emailObjs?.[0]?.value) ??
        null,
      phone: asString(row["phone"]) ?? asString(phoneObjs?.[0]?.value) ?? null,
      stage:
        typeof stageObj === "string"
          ? stageObj
          : asString(stageObj?.text) ?? asString(row["status"]) ?? null,
    } satisfies AtsCandidate;
  });

  return { candidates: candidates.filter((c) => c.externalId), error: null };
}

/** Pushes a status/stage change for a candidate that already exists in the ATS. */
export async function updateAtsCandidate(
  settings: AtsSettings,
  externalId: string,
  patch: { status: string; notes?: string },
): Promise<AtsResult> {
  if (!settings.enabled) return { synced: false, externalId, reason: "ATS sync is turned off" };
  const key = atsApiKey();
  if (!key) return { synced: false, externalId, reason: "ATS_API_KEY is not set." };

  let url: string;
  let method = "PATCH";
  let headers: Record<string, string>;
  let body: unknown;

  if (settings.provider === "greenhouse") {
    url = `${settings.base_url ?? "https://harvest.greenhouse.io/v1"}/candidates/${externalId}`;
    headers = { Authorization: `Basic ${btoa(`${key}:`)}`, "Content-Type": "application/json" };
    body = { tags: [patch.status], notes: patch.notes ?? "" };
  } else if (settings.provider === "lever") {
    url = `${settings.base_url ?? "https://api.lever.co/v1"}/opportunities/${externalId}/stage`;
    method = "PUT";
    headers = { Authorization: `Basic ${btoa(`${key}:`)}`, "Content-Type": "application/json" };
    body = { stage: patch.status };
  } else {
    if (!settings.base_url) return { synced: false, externalId, reason: "Set the ATS endpoint URL in Settings" };
    url = `${settings.base_url}/${externalId}`;
    headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    body = { status: patch.status, notes: patch.notes ?? "" };
  }

  const res = await fetchWithRetry(url, { method, headers, body: JSON.stringify(body) }, { scope: "ats.update", attempts: 3 });
  const text = await res.text();
  if (!res.ok) {
    logger.error(`ATS update failed [${res.status}]`, text);
    return { synced: false, externalId, reason: `ATS responded ${res.status}: ${text.slice(0, 200)}` };
  }
  return { synced: true, externalId, reason: null };
}
