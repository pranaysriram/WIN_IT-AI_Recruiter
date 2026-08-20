/**
 * CORS + security headers for the `/api/*` HTTP surface.
 *
 * Allowed origins come from ALLOWED_ORIGINS (comma separated). When unset we
 * fall back to same-origin only, so the API is never wildcard-open by default.
 */

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Resource-Policy": "same-site",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Cache-Control": "no-store",
};

function allowedOrigins(): string[] {
  return (process.env["ALLOWED_ORIGINS"] ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Max-Age": "86400",
  };
  if (!origin) return headers;

  const sameOrigin = new URL(request.url).origin === origin;
  if (sameOrigin || allowedOrigins().includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

/** Copies CORS + hardening headers onto an existing Response. */
export function withSecurityHeaders(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...corsHeaders(request) })) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Standard preflight reply for `/api/*` routes. */
export function preflight(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: { ...SECURITY_HEADERS, ...corsHeaders(request) },
  });
}
