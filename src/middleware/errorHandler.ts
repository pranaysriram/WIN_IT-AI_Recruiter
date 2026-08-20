import { logger } from "@/utils/logger";

export function toMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

/** Logs server-side detail and returns a safe JSON error Response. */
export function jsonError(scope: string, error: unknown, status = 500): Response {
  logger.error(`${scope} failed`, toMessage(error));
  return Response.json({ error: toMessage(error) }, { status });
}

/** Wraps a handler so provider details never leak raw to the client. */
export async function guard<T>(scope: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.error(`${scope} failed`, toMessage(error));
    throw new Error(toMessage(error));
  }
}
