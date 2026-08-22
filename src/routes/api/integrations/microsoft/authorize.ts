import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/integrations/microsoft/authorize")({
  server: { handlers: { GET: async ({ request }) => {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    if (!clientId) return Response.json({ error: "MICROSOFT_CLIENT_ID is not configured" }, { status: 503 });
    const redirectUri = new URL("/api/integrations/microsoft/callback", request.url).toString();
    const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    const state = crypto.randomUUID();
    url.search = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: redirectUri, response_mode: "query", scope: "offline_access User.Read Calendars.ReadWrite", state }).toString();
    return new Response(null, { status: 302, headers: { Location: url.toString(), "Set-Cookie": `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api/integrations/microsoft` } });
  } } },
});
