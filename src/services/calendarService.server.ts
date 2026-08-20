/**
 * Calendar invites without a second server.
 *
 * Produces a real RFC-5545 ICS payload (openable by Google Calendar, Outlook,
 * Apple Calendar) plus one-click "add to calendar" URLs for Google and Outlook.
 */

export type InviteInput = {
  candidateName: string;
  candidateEmail: string | null;
  jobTitle: string | null;
  companyName: string | null;
  interviewerName: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (local/naive)
  durationMinutes: number;
  meetingLink: string | null;
};

export type Invite = {
  uid: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  ics: string;
  googleUrl: string;
  outlookUrl: string;
};

function stamp(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildInvite(input: InviteInput): Invite {
  const startsAt = new Date(`${input.date}T${input.time}:00`);
  if (Number.isNaN(startsAt.getTime())) throw new Error("Invalid interview date or time");
  const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);

  const role = input.jobTitle ?? "the role";
  const company = input.companyName ?? "our team";
  const title = `Interview: ${input.candidateName} · ${role}`;
  const description = [
    `Interview with ${input.candidateName} for ${role} at ${company}.`,
    input.interviewerName ? `Interviewer: ${input.interviewerName}.` : null,
    input.meetingLink ? `Join: ${input.meetingLink}` : null,
    "Scheduled automatically by Ava Recruit after the AI screening call.",
  ]
    .filter(Boolean)
    .join("\n");

  const uid = `${crypto.randomUUID()}@ava-recruit`;
  const location = input.meetingLink ?? "Phone / video";

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ava Recruit//Interview Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(startsAt)}`,
    `DTEND:${stamp(endsAt)}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(location)}`,
    input.candidateEmail
      ? `ATTENDEE;CN=${escapeIcs(input.candidateName)};RSVP=TRUE:mailto:${input.candidateEmail}`
      : null,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  const googleUrl =
    "https://calendar.google.com/calendar/render?" +
    new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      details: description,
      location,
      dates: `${stamp(startsAt)}/${stamp(endsAt)}`,
      ...(input.candidateEmail ? { add: input.candidateEmail } : {}),
    }).toString();

  const outlookUrl =
    "https://outlook.office.com/calendar/0/deeplink/compose?" +
    new URLSearchParams({
      path: "/calendar/action/compose",
      rru: "addevent",
      subject: title,
      body: description,
      location,
      startdt: startsAt.toISOString(),
      enddt: endsAt.toISOString(),
      ...(input.candidateEmail ? { to: input.candidateEmail } : {}),
    }).toString();

  return { uid, title, description, startsAt, endsAt, ics, googleUrl, outlookUrl };
}
