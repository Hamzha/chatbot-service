import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  conflictError,
  errorMessage,
  internalServerError,
  notFoundError,
  parseJsonBody,
  validationError,
} from "./routeValidation";

describe("parseJsonBody", () => {
  it("returns parsed payload for valid JSON", async () => {
    const schema = z.object({ name: z.string().min(1) });
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "demo" }),
    });

    const result = await parseJsonBody(request, schema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("demo");
    }
  });

  it("returns 400 for invalid JSON", async () => {
    const schema = z.object({ name: z.string() });
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bad",
    });

    const result = await parseJsonBody(request, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  it("returns first zod issue message when schema validation fails", async () => {
    const schema = z.object({
      age: z.number().int().min(18, "age must be at least 18"),
    });
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ age: 12 }),
    });

    const result = await parseJsonBody(request, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const payload = (await result.response.json()) as { error: string };
      expect(payload.error).toBe("age must be at least 18");
    }
  });
});

describe("error helpers", () => {
  it("extracts message from Error objects", () => {
    expect(errorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("falls back when unknown error shape is provided", () => {
    expect(errorMessage({ bad: true }, "fallback")).toBe("fallback");
  });

  it("builds a 500 response with a normalized error shape", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = internalServerError(new Error("debug"), "Server unavailable");
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Server unavailable");
    spy.mockRestore();
  });

  it("returns standard status codes for validation/conflict/not-found helpers", async () => {
    const bad = validationError("Invalid payload");
    const conflict = conflictError("Duplicate");
    const missing = notFoundError();
    expect(bad.status).toBe(400);
    expect(conflict.status).toBe(409);
    expect(missing.status).toBe(404);
    const missingBody = (await missing.json()) as { error: string };
    expect(missingBody.error).toBe("Not found");
  });
});
