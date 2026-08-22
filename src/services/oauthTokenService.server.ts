import type { DB } from "@/db/connection";

export type OAuthProvider = "microsoft" | "zoho_recruit";
export type OAuthToken = { accessToken: string; refreshToken: string; expiresAt: number };

type TokenRow = { access_token: string; refresh_token: string; expires_at: string };

export async function loadOAuthToken(db: DB, provider: OAuthProvider): Promise<OAuthToken | null> {
  const { data, error } = await db
    .from("oauth_tokens" as never)
    .select("access_token, refresh_token, expires_at")
    .eq("provider", provider)
    .maybeSingle() as { data: TokenRow | null; error: { message: string } | null };
  if (error) throw new Error(error.message);
  return data
    ? { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.parse(data.expires_at) }
    : null;
}

export async function saveOAuthToken(db: DB, provider: OAuthProvider, token: OAuthToken): Promise<void> {
  const { error } = await db.from("oauth_tokens" as never).upsert({
    provider,
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expires_at: new Date(token.expiresAt).toISOString(),
    updated_at: new Date().toISOString(),
  } as never, { onConflict: "provider" });
  if (error) throw new Error(error.message);
}

export async function requireOAuthToken(db: DB, provider: OAuthProvider): Promise<OAuthToken> {
  const token = await loadOAuthToken(db, provider);
  if (!token) throw new Error(`${provider} is not connected. Complete OAuth setup first.`);
  if (token.expiresAt > Date.now() + 60_000) return token;

  const config = provider === "microsoft"
    ? { tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token", clientId: process.env.MICROSOFT_CLIENT_ID, clientSecret: process.env.MICROSOFT_CLIENT_SECRET }
    : { tokenUrl: "https://accounts.zoho.com/oauth/v2/token", clientId: process.env.ZOHO_CLIENT_ID, clientSecret: process.env.ZOHO_CLIENT_SECRET };
  if (!config.clientId || !config.clientSecret) throw new Error(`${provider} OAuth credentials are not configured.`);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: token.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const response = await fetch(config.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const payload = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !payload.access_token) throw new Error(`${provider} token refresh failed: ${payload.error ?? response.statusText}`);
  const refreshed = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? token.refreshToken,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };
  await saveOAuthToken(db, provider, refreshed);
  return refreshed;
}
