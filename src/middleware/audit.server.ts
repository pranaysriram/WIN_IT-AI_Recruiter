/**
 * Audit trail. Every privileged or state-changing action is written to
 * `audit_logs` through the service-role client so entries cannot be forged or
 * deleted by an app user (the table is read-only for `authenticated`).
 */
import { getAdminClient } from "@/db/connection";
import { logger } from "@/utils/logger";

export type AuditEntry = {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  status?: "success" | "failure" | "denied";
  details?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
};

/** Extracts caller metadata without ever logging credentials. */
export function requestMeta(request: Request): { ip: string | null; userAgent: string | null } {
  return {
    ip:
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null,
    userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
  };
}

/** Never throws: an audit write must not break the user-facing action. */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = await getAdminClient();
    const { error } = await supabase.from("audit_logs").insert({
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      resource_type: entry.resourceType ?? null,
      resource_id: entry.resourceId ?? null,
      status: entry.status ?? "success",
      details: (entry.details ?? {}) as never,
      ip_address: entry.ip ?? null,
      user_agent: entry.userAgent ?? null,
    });
    if (error) logger.warn("audit write failed", error.message);
  } catch (error) {
    logger.warn("audit write failed", error);
  }
}
