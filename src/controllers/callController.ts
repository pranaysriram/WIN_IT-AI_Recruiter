import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/middleware/auth";
import { callInput } from "@/utils/validation";
import { placeOutboundCall } from "@/services/elevenLabsService.server";
import { toDialableNumber } from "@/services/twilioService.server";

export const startLiveCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => callInput.omit({ instruction: true }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: settings } = await supabase
      .from("telephony_settings")
      .select("agent_id, agent_phone_number_id, enabled")
      .eq("singleton", true)
      .maybeSingle();

    if (!settings?.enabled || !settings.agent_id || !settings.agent_phone_number_id) {
      throw new Error("Live calling is not configured yet. Add your voice agent in Settings.");
    }

    const { data: candidate, error } = await supabase
      .from("candidates")
      .select("candidate_id, full_name, phone_number, job_id")
      .eq("candidate_id", data.candidateId)
      .single();
    if (error || !candidate) throw new Error("Candidate not found");
    if (!candidate.phone_number) throw new Error("This candidate has no phone number");
    const toNumber = toDialableNumber(candidate.phone_number);

    const jobId = data.jobId ?? candidate.job_id ?? null;
    const job = jobId
      ? (
          await supabase
            .from("jobs")
            .select("title, company_name, location, salary_range, jd_text")
            .eq("job_id", jobId)
            .maybeSingle()
        ).data
      : null;

    const { data: call, error: callErr } = await supabase
      .from("call_sessions")
      .insert({
        candidate_id: candidate.candidate_id,
        job_id: jobId,
        call_status: "dialing",
        provider: "elevenlabs_twilio",
        call_start_time: new Date().toISOString(),
      })
      .select("call_id")
      .single();
    if (callErr) throw new Error(callErr.message);

    try {
      const result = await placeOutboundCall({
        agentId: settings.agent_id,
        agentPhoneNumberId: settings.agent_phone_number_id,
        toNumber,
        dynamicVariables: {
          candidate_name: candidate.full_name,
          job_title: job?.title ?? "an open role",
          company_name: job?.company_name ?? "our client",
          job_location: job?.location ?? "",
          salary_range: job?.salary_range ?? "",
          job_description: (job?.jd_text ?? "").slice(0, 1500),
          call_id: call.call_id,
        },
      });

      await supabase
        .from("call_sessions")
        .update({ external_call_id: result.conversation_id, call_status: "in_progress" })
        .eq("call_id", call.call_id);

      return { call_id: call.call_id as string, conversation_id: result.conversation_id };
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Call failed";
      let message = raw;
      if (/unverified|Trial accounts may only make calls/i.test(raw)) {
        message = `Twilio trial account: ${toNumber} is not a verified number. Verify it in Twilio (Phone Numbers → Verified Caller IDs) or upgrade the Twilio account to call any number.`;
      } else if (/do-not-originate|DNO|caller ID\) must be valid/i.test(raw)) {
        message =
          "Twilio rejected the caller ID: this number can't be used to originate outbound calls (Indian mobile numbers are blocked for outbound voice / are on the do-not-originate list). Buy a Twilio voice-enabled number that supports outbound calling (e.g. a US number), import it into ElevenLabs, and paste its phone number ID in Settings.";
      }

      await supabase
        .from("call_sessions")
        .update({ call_status: "failed", error_message: message.slice(0, 500) })
        .eq("call_id", call.call_id);
      throw new Error(message);
    }
  });
