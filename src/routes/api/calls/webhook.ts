import { createFileRoute } from "@tanstack/react-router";
import { handleCallWebhook } from "@/services/callWebhookService.server";

export const Route = createFileRoute("/api/calls/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handleCallWebhook(request),
    },
  },
});
