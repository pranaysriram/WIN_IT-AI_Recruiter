import { createFileRoute } from "@tanstack/react-router";
import { getAdminClient } from "@/db/connection";
import { saveOAuthToken } from "@/services/oauthTokenService.server";

export const Route = createFileRoute("/api/integrations/microsoft/callback")({
  server: { handlers: { GET: async ({ request }) => {
    const code = new URL(request.url).searchParams.get("code");
    const state = new URL(request.url).searchParams.get("state");
    const expectedState = request.headers.get("cookie")?.match(/(?:^|;\s*)oauth_state=([^;]+)/)?.[1];
    if (!code) return Response.json({ error: "Missing OAuth code" }, { status: 400 });
    if (!state || state !== expectedState) return Response.json({ error: "Invalid OAuth state" }, { status: 400 });
    const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.MICROSOFT_CLIENT_ID ?? "", client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "", code, redirect_uri: new URL("/api/integrations/microsoft/callback", request.url).toString(), grant_type: "authorization_code", scope: "offline_access User.Read Calendars.ReadWrite" }) });
    const payload = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
    if (!response.ok || !payload.access_token || !payload.refresh_token) return Response.json({ error: payload.error ?? "Microsoft OAuth failed" }, { status: 502 });
    await saveOAuthToken(await getAdminClient(), "microsoft", { accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 });
    return new Response("Microsoft Calendar connected. You can close this window.", { headers: { "content-type": "text/plain" } });
  } } },
});
