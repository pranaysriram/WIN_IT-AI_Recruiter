/**
 * Interview scheduling business logic.
 *
 * Single source of truth shared by the `scheduleInterview` / `cancelInterview`
 * server functions (used by the dashboard) and the `/api/interviews` REST
 * endpoints. Neither caller re-implements any of this.
 */
import { z } from "zod";
import type { DB } from "@/db/connection";
import { buildInvite } from "@/services/calendarService.server";
import { interviewInput } from "@/utils/validation";
import { logger } from "@/utils/logger";
import { getCalendarProvider, getConfiguredCalendarProvider } from "@/services/calendarProvider.server";

export type ScheduleInterviewInput = z.infer<typeof interviewInput>;

export async function createInterview(supabase: DB, data: ScheduleInterviewInput) {
  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("candidate_id, full_name, email, job_id")
    .eq("candidate_id", data.candidateId)
    .single();
  if (error || !candidate) throw new Error("Candidate not found");

  const jobId = data.jobId ?? candidate.job_id ?? null;
  const job = jobId
    ? (
        await supabase
          .from("jobs")
          .select("title, company_name")
          .eq("job_id", jobId)
          .maybeSingle()
      ).data
    : null;

  const durationMinutes = data.durationMinutes ?? 45;
  const invite = buildInvite({
    candidateName: candidate.full_name,
    candidateEmail: candidate.email,
    jobTitle: job?.title ?? null,
    companyName: job?.company_name ?? null,
    interviewerName: data.interviewerName ?? null,
    date: data.date,
    time: data.time,
    durationMinutes,
    meetingLink: data.meetingLink ?? null,
  });

  // Try the configured real calendar provider first; ICS stays as the fallback.
  const providerName = getConfiguredCalendarProvider();
  const gcal = await import("@/services/googleCalendarService.server");
  const timeZone = data.timeZone ?? "UTC";
  const calendarId = data.calendarId ?? "primary";
  let provider = "ics";
  let eventId = invite.uid;
  let eventUrl = invite.googleUrl;
  let meetingLink = data.meetingLink ?? null;
  let calendarWarning: string | null = null;
  let conflict: { start: string; end: string } | null = null;

  const providerConfigured = providerName === "google" ? gcal.isGoogleCalendarConfigured() : Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
  if (providerConfigured) {
    try {
      const startsAt = gcal.zonedToUtc(data.date, data.time, timeZone);
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

      const calendarProvider = getCalendarProvider(providerName, supabase);
      const busy = (await calendarProvider.checkAvailability({ date: data.date, timeZone, durationMinutes, calendarIds: [calendarId], dayStart: data.time, dayEnd: data.time })).busy;
      const clash = busy.find(
        (b) =>
          startsAt.getTime() < new Date(b.end).getTime() &&
          endsAt.getTime() > new Date(b.start).getTime(),
      );
      if (clash) {
        conflict = clash;
        throw new Error(
          `That slot is already busy on the calendar (${new Date(clash.start).toLocaleString()} – ${new Date(clash.end).toLocaleString()}). Pick another time.`,
        );
      }

      const created = await calendarProvider.createEvent({
        calendarId,
        summary: invite.title,
        description: invite.description,
        startsAt,
        endsAt,
        timeZone,
        attendeeEmails: candidate.email ? [candidate.email] : [],
        meetingLink: data.meetingLink ?? null,
        addMeet: data.addMeet ?? !data.meetingLink,
      });
      provider = providerName;
      eventId = created.id;
      eventUrl = created.htmlLink ?? invite.googleUrl;
      meetingLink = meetingLink ?? created.hangoutLink;
    } catch (e) {
      if (conflict) throw e;
      logger.error("Google Calendar event creation failed", e);
      calendarWarning = (e as Error).message;
    }
  } else {
    calendarWarning = `${providerName === "google" ? "Google Calendar" : "Microsoft Graph"} is not connected — saved an ICS invite instead.`;
  }

  const { data: row, error: insertErr } = await supabase
    .from("interview_schedules")
    .insert({
      candidate_id: candidate.candidate_id,
      job_id: jobId,
      interview_date: data.date,
      interview_time: data.time,
      interviewer_name: data.interviewerName ?? null,
      calendar_event_id: eventId,
      calendar_uid: provider === "google" ? eventId : invite.uid,
      calendar_provider: provider,
      calendar_event_url: eventUrl,
      meeting_link: meetingLink,
      invite_sent: provider === "google",
    })
    .select("schedule_id")
    .single();
  if (insertErr) throw new Error(insertErr.message);

  await supabase
    .from("candidates")
    .update({ status: "interview_scheduled" })
    .eq("candidate_id", candidate.candidate_id);

  return {
    schedule_id: row.schedule_id as string,
    provider,
    title: invite.title,
    eventUrl,
    meetingLink,
    googleUrl: invite.googleUrl,
    outlookUrl: invite.outlookUrl,
    ics: invite.ics,
    calendarWarning,
  };
}

export async function cancelInterviewById(
  supabase: DB,
  input: { scheduleId: string; calendarId?: string | undefined },
) {
  const { data: row, error } = await supabase
    .from("interview_schedules")
    .select("schedule_id, calendar_event_id, calendar_provider")
    .eq("schedule_id", input.scheduleId)
    .single();
  if (error || !row) throw new Error("Interview not found");

  let calendarWarning: string | null = null;
  if (row.calendar_provider === "google" && row.calendar_event_id) {
    try {
      const gcal = await import("@/services/googleCalendarService.server");
      await gcal.cancelInterviewEvent(input.calendarId ?? "primary", row.calendar_event_id);
    } catch (e) {
      calendarWarning = (e as Error).message;
    }
  }

  const { error: updErr } = await supabase
    .from("interview_schedules")
    .update({ status: "cancelled" })
    .eq("schedule_id", input.scheduleId);
  if (updErr) throw new Error(updErr.message);

  return { ok: true, calendarWarning };
}
