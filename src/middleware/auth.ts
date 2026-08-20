/**
 * Auth middleware for server functions.
 * Attaches an RLS-scoped `supabase` client plus `userId` / `claims` to context.
 */
export { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
