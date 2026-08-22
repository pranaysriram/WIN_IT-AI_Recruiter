import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/integrations/zoho/authorize")({
  server: { handlers: { GET: async ({ request }) => {
    const clientId = process.env.ZOHO_CLIENT_ID;
    if (!clientId) return Response.json({ error: "ZOHO_CLIENT_ID is not configured" }, { status: 503 });
    const redirectUri = new URL("/api/integrations/zoho/callback", request.url).toString();
    const url = new URL("https://accounts.zoho.com/oauth/v2/auth");
    const state = crypto.randomUUID();
    url.search = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: redirectUri, access_type: "offline", prompt: "consent", scope: "ZohoRecruit.modules.ALL,ZohoRecruit.settings.ALL", state }).toString();
    return new Response(null, { status: 302, headers: { Location: url.toString(), "Set-Cookie": `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api/integrations/zoho` } });
  } } },
});
