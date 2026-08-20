import { createFileRoute } from "@tanstack/react-router";
import { handleCallWebhook } from "@/services/callWebhookService.server";

/**
 * Externally reachable alias of POST /api/calls/webhook.
 * Twilio and ElevenLabs post here; both payload shapes are verified inside.
 */
export const Route = createFileRoute("/api/public/calls/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handleCallWebhook(request),
    },
  },
});
