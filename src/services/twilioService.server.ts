/**
 * Twilio-facing helpers.
 *
 * The live audio leg is owned by ElevenLabs' Twilio integration (a serverless
 * runtime cannot hold Twilio's long-lived Media Stream socket), so this module
 * covers number hygiene and optional Twilio REST calls (SMS follow-ups) placed
 * through the Lovable connector gateway.
 */
import { isE164, normalizePhone } from "@/utils/validation";
import { logger } from "@/utils/logger";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

export function toDialableNumber(raw: string | null | undefined): string {
  const normalized = normalizePhone(raw);
  if (!isE164(normalized)) {
    throw new Error(
      "The candidate's phone number is not in international format (e.g. +14155550142).",
    );
  }
  return normalized as string;
}

export function isTwilioSmsConfigured(): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env["TWILIO_API_KEY"]);
}

/** Optional SMS follow-up (interview confirmations). No-ops when not connected. */
export async function sendSms(input: { to: string; from: string; body: string }) {
  if (!isTwilioSmsConfigured()) {
    return { sent: false, reason: "Twilio is not connected to this project" };
  }

  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
      "X-Connection-Api-Key": process.env["TWILIO_API_KEY"] as string,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: toDialableNumber(input.to),
      From: input.from,
      Body: input.body.slice(0, 1500),
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    logger.error(`Twilio SMS failed [${res.status}]`, text);
    return { sent: false, reason: `Twilio error ${res.status}` };
  }
  return { sent: true, reason: null };
}
