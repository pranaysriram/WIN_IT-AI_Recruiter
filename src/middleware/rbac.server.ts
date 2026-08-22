import type { DB } from "@/db/connection";

export type UserRole = "admin" | "recruiter";

export async function getUserRole(db: DB): Promise<UserRole> {
  const { data: user } = await db.auth.getUser();
  const metadataRole = user.user?.app_metadata?.role ?? user.user?.user_metadata?.role;
  if (metadataRole === "admin" || metadataRole === "recruiter") return metadataRole;
  if (!user.user) throw new Error("Unauthorized");

  const { data } = await db.from("recruiters").select("role").eq("email", user.user.email ?? "").maybeSingle();
  return data?.role === "admin" ? "admin" : "recruiter";
}

export async function requireRole(db: DB, allowed: UserRole[]): Promise<UserRole> {
  const role = await getUserRole(db);
  if (!allowed.includes(role)) throw new Error("Forbidden: insufficient role");
  return role;
}
