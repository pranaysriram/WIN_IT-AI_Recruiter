import { z } from "zod";

/** Loose E.164 normaliser: strips spaces/dashes/parens and keeps a leading +. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

export function isE164(value: string | null | undefined): boolean {
  return !!value && /^\+[1-9]\d{7,14}$/.test(value);
}

export const uuid = z.string().uuid();

export const candidateInput = z.object({
  full_name: z.string().min(1).max(160),
  phone_number: z.string().max(40).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  job_id: uuid.nullable().optional(),
});

export const callInput = z.object({
  candidateId: uuid,
  jobId: uuid.nullable().optional(),
  instruction: z.string().max(500).optional(),
});

export const interviewInput = z.object({
  candidateId: uuid,
  jobId: uuid.nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int().min(15).max(240).optional(),
  interviewerName: z.string().max(160).nullable().optional(),
  meetingLink: z.string().max(500).nullable().optional(),
  timeZone: z.string().max(64).optional(),
  calendarId: z.string().max(200).optional(),
  addMeet: z.boolean().optional(),
});

export const availabilityInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.number().int().min(15).max(240).optional(),
  timeZone: z.string().max(64).optional(),
  calendarIds: z.array(z.string().max(200)).max(10).optional(),
  dayStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  dayEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const atsSyncInput = z.object({ candidateId: uuid });

export const atsImportInput = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});

export const auditQueryInput = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  action: z.string().max(80).optional(),
  status: z.enum(["success", "failure", "denied"]).optional(),
});

export const atsPushInput = z.object({
  candidateIds: z.array(uuid).max(50).optional(),
});

export const QUESTION_CODES = [
  "current_salary",
  "expected_salary",
  "notice_period",
  "skills_confirmation",
  "location_preference",
  "work_preference",
  "interest_level",
  "availability",
] as const;

export type QuestionCode = (typeof QUESTION_CODES)[number];

/* ---------------- REST resource schemas (/api/candidates, /api/jobs, /api/interviews) --------- */

export const candidateCreate = candidateInput.extend({
  source: z.string().max(50).nullable().optional(),
  status: z.string().max(30).optional(),
});
export const candidateUpdate = candidateCreate.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "Provide at least one field to update" },
);

export const jobCreate = z.object({
  title: z.string().min(1).max(150),
  company_name: z.string().max(150).nullable().optional(),
  location: z.string().max(150).nullable().optional(),
  employment_type: z.string().max(50).nullable().optional(),
  salary_range: z.string().max(50).nullable().optional(),
  jd_text: z.string().max(20000).nullable().optional(),
});
export const jobUpdate = jobCreate.partial().refine((v) => Object.keys(v).length > 0, {
  message: "Provide at least one field to update",
});

export const interviewUpdate = z
  .object({
    interview_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    interview_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    interviewer_name: z.string().max(150).nullable().optional(),
    meeting_link: z.string().max(500).nullable().optional(),
    status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update" });

/** Shared list query: ?limit=&offset=&status=&job_id=&q= */
export const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().max(40).optional(),
  job_id: uuid.optional(),
  candidate_id: uuid.optional(),
  q: z.string().max(120).optional(),
});
