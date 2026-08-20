import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/middleware/auth";
import { auditQueryInput } from "@/utils/validation";

export type AuditRow = {
  id: string;
  actor_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  status: string;
  details: string | null;
  ip_address: string | null;
  created_at: string;
};

/** Authenticated read of the audit trail (writes are service-role only). */
export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => auditQueryInput.parse(data))
  .handler(async ({ data, context }): Promise<AuditRow[]> => {
    let query = context.supabase
      .from("audit_logs")
      .select(
        "id, actor_email, action, resource_type, resource_id, status, details, ip_address, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);

    if (data.action) query = query.eq("action", data.action);
    if (data.status) query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) => ({
      id: row.id,
      actor_email: row.actor_email,
      action: row.action,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      status: row.status,
      details: row.details ? JSON.stringify(row.details) : null,
      ip_address: row.ip_address,
      created_at: row.created_at,
    }));
  });
