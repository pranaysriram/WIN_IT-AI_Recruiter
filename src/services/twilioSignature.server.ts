/**
 * Twilio webhook signature validation (X-Twilio-Signature).
 *
 * Twilio signs: the full request URL, followed by every POST body parameter
 * sorted by key and concatenated as `key + value`, HMAC-SHA1'd with the account
 * auth token and base64 encoded.
 *
 * The auth token is read from `process.env` inside server-only code and is
 * never sent to the browser.
 */

/** Rebuilds the public URL Twilio used, honouring proxy forwarding headers. */
export function twilioRequestUrl(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (proto) url.protocol = `${proto.split(",")[0]!.trim()}:`;
  if (host) {
    const value = host.split(",")[0]!.trim();
    url.host = value;
    if (!value.includes(":")) url.port = "";
  }
  return url.toString();
}



function base64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  // btoa exists in the Worker runtime and in Node >= 16
  return btoa(bin);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Computes the expected Twilio signature for a URL + form-encoded body. */
export async function computeTwilioSignature(
  authToken: string,
  url: string,
  params: URLSearchParams,
): Promise<string> {
  const keys = [...new Set([...params.keys()])].sort();
  let data = url;
  for (const key of keys) {
    for (const value of params.getAll(key)) data += key + value;
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  return base64(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** Constant-time verification of the `X-Twilio-Signature` header. */
export async function verifyTwilioSignature(input: {
  authToken: string;
  url: string;
  params: URLSearchParams;
  signature: string | null | undefined;
}): Promise<boolean> {
  if (!input.authToken || !input.signature) return false;
  const expected = await computeTwilioSignature(input.authToken, input.url, input.params);
  return timingSafeEqual(input.signature, expected);
}
