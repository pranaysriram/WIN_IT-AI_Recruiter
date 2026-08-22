import { createFileRoute } from "@tanstack/react-router";
import { preflight, restRoute } from "@/services/restHandler.server";

export const Route = createFileRoute("/api/analytics/calls")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(request),

      GET: async ({ request }) =>
        restRoute(request, "analytics-calls", async ({ supabase }) => {
          const { data: calls } = await supabase
            .from("call_sessions")
            .select("call_id, call_status, call_start_time, call_end_time, error_message");

          const totalCalls = calls?.length ?? 0;
          const successfulCalls = (calls ?? []).filter((call) => call.call_status === "completed").length;

          const durations = (calls ?? [])
            .filter((call) => call.call_start_time && call.call_end_time)
            .map((call) => {
              const start = new Date(call.call_start_time as string).getTime();
              const end = new Date(call.call_end_time as string).getTime();
              return Math.max(0, (end - start) / 1000);
            });

          const failureReasons = (calls ?? [])
            .filter((call) => call.call_status === "failed" || call.call_status === "no_answer")
            .reduce<Record<string, number>>((acc, call) => {
              const reason = (call.error_message ?? call.call_status ?? "unknown").trim();
              acc[reason] = (acc[reason] ?? 0) + 1;
              return acc;
            }, {});

          return Response.json({
            total_calls: totalCalls,
            success_rate: totalCalls ? (successfulCalls / totalCalls) * 100 : 0,
            average_duration_seconds: durations.length
              ? durations.reduce((sum, value) => sum + value, 0) / durations.length
              : 0,
            failure_reasons: failureReasons,
          });
        }),
    },
  },
});
