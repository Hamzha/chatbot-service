/** Human-readable message from JSON error bodies (Next routes + FastAPI). */
export function formatApiErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (typeof o.error === "string") {
      const base = o.error;
      if (typeof o.detail === "string" && o.detail.trim()) {
        return `${base} (${o.detail})`;
      }
      return base;
    }
    if (typeof o.detail === "string") return o.detail;
  }
  return `Request failed (${status})`;
}

/**
 * Read fetch Response as text and parse JSON; throw clear errors on empty/invalid bodies.
 */
export async function parseJsonResponse<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`Empty response from server (HTTP ${res.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Invalid JSON from server (HTTP ${res.status}): ${text.slice(0, 240)}${text.length > 240 ? "…" : ""}`,
    );
  }
}

/** After parseJsonResponse, throw if the HTTP status indicates failure. */
export function assertOkJson(res: Response, data: unknown): void {
  if (res.ok) return;
  throw new Error(formatApiErrorMessage(data, res.status));
}
