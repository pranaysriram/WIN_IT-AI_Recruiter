import type { DB } from "@/db/connection";
import { requireOAuthToken } from "@/services/oauthTokenService.server";

export type AtsCandidate = { externalId: string; fullName: string; email: string | null; phone: string | null; stage: string | null };
export interface AtsProvider {
  fetchCandidates(limit: number): Promise<{ candidates: AtsCandidate[]; error: string | null }>;
  fetchJobs(limit: number): Promise<{ jobs: Array<Record<string, unknown>>; error: string | null }>;
  updateCandidate(externalId: string, patch: { status: string; notes?: string }): Promise<{ synced: boolean; externalId: string; reason: string | null }>;
}

export function getAtsProvider(provider: string, db?: DB): AtsProvider | null {
  if (provider !== "zoho_recruit") return provider === "greenhouse" || provider === "lever" ? legacy(provider) : null;
  return zoho(db);
}
export function getConfiguredAtsProvider(): string { return process.env.ATS_PROVIDER ?? "greenhouse"; }

function legacy(provider: string): AtsProvider {
  return {
    async fetchCandidates(limit) { const { fetchAtsCandidates } = await import("@/services/atsService.server"); return fetchAtsCandidates({ provider, base_url: null, default_board_id: null, enabled: true }, limit); },
    async fetchJobs() { return { jobs: [], error: "Job import is not available for this provider" }; },
    async updateCandidate(externalId, patch) { const { updateAtsCandidate } = await import("@/services/atsService.server"); return updateAtsCandidate({ provider, base_url: null, default_board_id: null, enabled: true }, externalId, patch); },
  };
}

function zoho(db?: DB): AtsProvider {
  async function request(path: string, init?: RequestInit) {
    if (!db) throw new Error("Database is required for Zoho Recruit");
    const token = await requireOAuthToken(db, "zoho_recruit");
    const response = await fetch(`https://recruit.zoho.com/recruit/v2${path}`, { ...init, headers: { Authorization: `Zoho-oauthtoken ${token.accessToken}`, Accept: "application/json", "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Zoho Recruit request failed [${response.status}]`);
    return payload as Record<string, unknown>;
  }
  return {
    async fetchCandidates(limit) {
      try { const payload = await request(`/Candidates?per_page=${limit}`); const rows = (payload.data as Record<string, unknown>[] | undefined) ?? []; return { candidates: rows.map((row) => ({ externalId: String(row.id ?? ""), fullName: String(row.Full_Name ?? `${row.First_Name ?? ""} ${row.Last_Name ?? ""}`).trim(), email: typeof row.Email === "string" ? row.Email : null, phone: typeof row.Mobile === "string" ? row.Mobile : null, stage: typeof row.Candidate_Status === "string" ? row.Candidate_Status : null })).filter((candidate) => candidate.externalId), error: null }; } catch (error) { return { candidates: [], error: (error as Error).message }; }
    },
    async fetchJobs(limit) { try { const payload = await request(`/JobOpenings?per_page=${limit}`); return { jobs: (payload.data as Record<string, unknown>[] | undefined) ?? [], error: null }; } catch (error) { return { jobs: [], error: (error as Error).message }; } },
    async updateCandidate(externalId, patch) { try { await request(`/Candidates/${encodeURIComponent(externalId)}`, { method: "PUT", body: JSON.stringify({ data: [{ Candidate_Status: patch.status, Description: patch.notes ?? "" }] }) }); return { synced: true, externalId, reason: null }; } catch (error) { return { synced: false, externalId, reason: (error as Error).message }; } },
  };
}
