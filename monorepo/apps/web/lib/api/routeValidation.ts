import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export type JsonError = { error: string };

export function jsonError(message: string, status: number): NextResponse<JsonError> {
  return NextResponse.json({ error: message }, { status });
}

export function validationError(message: string): NextResponse<JsonError> {
  return jsonError(message, 400);
}

export function conflictError(message: string): NextResponse<JsonError> {
  return jsonError(message, 409);
}

export function notFoundError(message = "Not found"): NextResponse<JsonError> {
  return jsonError(message, 404);
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

export function internalServerError(error: unknown, fallback: string): NextResponse<JsonError> {
  console.error(error);
  return jsonError(fallback, 500);
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse<JsonError> }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: validationError("Invalid JSON body") };
  }

  try {
    const data = schema.parse(raw);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues[0]?.message ?? "Invalid request body";
      return { ok: false, response: validationError(message) };
    }
    return { ok: false, response: validationError("Invalid request body") };
  }
}
