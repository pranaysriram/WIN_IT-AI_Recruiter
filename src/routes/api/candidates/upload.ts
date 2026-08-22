import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { HttpError } from "@/services/callApiService.server";
import { preflight, restRoute } from "@/services/restHandler.server";
import { isE164, normalizePhone } from "@/utils/validation";

const csvRow = z.object({
  full_name: z.string().min(1).max(160),
  phone_number: z.string().min(1).max(40),
  email: z.string().max(200).optional().nullable(),
  job_id: z.string().uuid().optional().nullable(),
});

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(value);
      value = "";
      continue;
    }

    value += char;
  }

  cells.push(value);
  return cells.map((cell) => cell.trim());
}

function getRowValue(row: Record<string, string>, key: string) {
  const match = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase());
  return match ? row[match] ?? "" : "";
}

export const Route = createFileRoute("/api/candidates/upload")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(request),

      POST: async ({ request }) =>
        restRoute(request, "candidates-upload", async ({ supabase }) => {
          const formData = await request.formData();
          const file = formData.get("file");

          if (!(file instanceof File)) {
            throw new HttpError(400, "Multipart form-data must include a CSV file field named 'file'.");
          }
          if (!file.name.toLowerCase().endsWith(".csv")) {
            throw new HttpError(400, "Only CSV files are supported.");
          }

          const text = await file.text();
          const rows = text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

          if (rows.length < 2) {
            throw new HttpError(400, "CSV file is empty or missing a header row.");
          }

          const header = parseCsvLine(rows[0]);
          const summary = {
            total: 0,
            succeeded: 0,
            failed: 0,
            rows: [] as Array<{ index: number; status: "success" | "failed"; name: string; reason?: string }>,
          };

          for (let i = 1; i < rows.length; i += 1) {
            const raw = parseCsvLine(rows[i]);
            if (raw.every((cell) => cell === "")) continue;

            const record: Record<string, string> = {};
            header.forEach((key, index) => {
              record[key] = raw[index] ?? "";
            });

            const index = i;
            const fullName = getRowValue(record, "full_name") || getRowValue(record, "name") || "";
            const phoneNumber = getRowValue(record, "phone_number") || getRowValue(record, "phone") || "";
            const email = getRowValue(record, "email") || null;
            const jobId = getRowValue(record, "job_id") || null;

            const candidatePayload = {
              full_name: fullName,
              phone_number: phoneNumber,
              email: email || null,
              job_id: jobId || null,
            };

            const validation = csvRow.safeParse(candidatePayload);
            if (!validation.success) {
              summary.failed += 1;
              summary.rows.push({
                index,
                status: "failed",
                name: fullName || `Row ${index}`,
                reason: validation.error.issues[0]?.message ?? "Missing required fields",
              });
              continue;
            }

            const normalizedPhone = normalizePhone(candidatePayload.phone_number);
            if (!normalizedPhone || !isE164(normalizedPhone)) {
              summary.failed += 1;
              summary.rows.push({
                index,
                status: "failed",
                name: fullName,
                reason: "Invalid phone number format.",
              });
              continue;
            }

            if (candidatePayload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidatePayload.email)) {
              summary.failed += 1;
              summary.rows.push({
                index,
                status: "failed",
                name: fullName,
                reason: "Invalid email format.",
              });
              continue;
            }

            const { error } = await supabase.from("candidates").insert({
              full_name: fullName,
              phone_number: normalizedPhone,
              email: candidatePayload.email || null,
              job_id: candidatePayload.job_id || null,
              source: "CSV Upload",
              status: "new",
              consent_given_at: new Date().toISOString(),
            });

            summary.total += 1;
            if (error) {
              summary.failed += 1;
              summary.rows.push({
                index,
                status: "failed",
                name: fullName,
                reason: error.message,
              });
              continue;
            }

            summary.succeeded += 1;
            summary.rows.push({
              index,
              status: "success",
              name: fullName,
            });
          }

          return Response.json({
            total: summary.total,
            succeeded: summary.succeeded,
            failed: summary.failed,
            rows: summary.rows,
          });
        }, { roles: ["admin", "recruiter"] }),
    },
  },
});
