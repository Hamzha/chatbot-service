import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Build a fresh mock for sonner before each test so we can observe calls and
// reset between scenarios.
const toastMocks = vi.hoisted(() => {
  const success = vi.fn();
  const error = vi.fn();
  const loading = vi.fn(() => "loading-toast-id");
  const info = vi.fn();
  const warning = vi.fn();
  const dismiss = vi.fn();
  const promise = vi.fn();
  const base = Object.assign(
    vi.fn((msg: string) => info(msg)),
    { success, error, loading, info, warning, dismiss, promise },
  );
  return { base, success, error, loading, info, warning, dismiss, promise };
});

vi.mock("sonner", () => ({
  toast: toastMocks.base,
}));

describe("notifyMutation", () => {
  beforeEach(() => {
    toastMocks.success.mockClear();
    toastMocks.error.mockClear();
    toastMocks.loading.mockClear();
    toastMocks.info.mockClear();
    toastMocks.dismiss.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("shows a loading toast then replaces it with success", async () => {
    const { notifyMutation } = await import("./notifyMutation");
    const result = await notifyMutation(
      async () => ({ ok: true }),
      { entity: "Chatbot", verb: "create" },
    );

    expect(result).toEqual({ ok: true });
    expect(toastMocks.loading).toHaveBeenCalledWith("Creating chatbot…", undefined);
    expect(toastMocks.success).toHaveBeenCalledWith(
      "Chatbot created",
      { id: "loading-toast-id" },
    );
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("shows an error toast and re-throws when the action rejects", async () => {
    const { notifyMutation } = await import("./notifyMutation");
    const boom = new Error("boom");

    await expect(
      notifyMutation(async () => {
        throw boom;
      }, { entity: "Document", verb: "delete" }),
    ).rejects.toBe(boom);

    expect(toastMocks.error).toHaveBeenCalledWith(
      "boom",
      { id: "loading-toast-id" },
    );
    expect(toastMocks.success).not.toHaveBeenCalled();
  });

  it("accepts a function for successMessage that receives the result", async () => {
    const { notifyMutation } = await import("./notifyMutation");
    await notifyMutation(
      async () => ({ chunks: 12 }),
      {
        entity: "Page",
        verb: "create",
        successMessage: (r) => `Indexed ${r.chunks} chunks`,
      },
    );

    expect(toastMocks.success).toHaveBeenCalledWith(
      "Indexed 12 chunks",
      { id: "loading-toast-id" },
    );
  });

  it("skips the loading toast when showLoading is false", async () => {
    const { notifyMutation } = await import("./notifyMutation");
    await notifyMutation(async () => "ok", {
      entity: "Profile",
      verb: "update",
      showLoading: false,
    });

    expect(toastMocks.loading).not.toHaveBeenCalled();
    expect(toastMocks.success).toHaveBeenCalledWith("Profile updated", undefined);
  });

  it("falls back to generic messages when no entity/verb is provided", async () => {
    const { notifyMutation } = await import("./notifyMutation");
    await notifyMutation(async () => "ok");
    expect(toastMocks.loading).toHaveBeenCalledWith("Working…", undefined);
    expect(toastMocks.success).toHaveBeenCalledWith(
      "Done",
      { id: "loading-toast-id" },
    );
  });
});

describe("extractErrorMessage", () => {
  it("prefers Error.message over fallback", async () => {
    const { extractErrorMessage } = await import("./notifyMutation");
    expect(extractErrorMessage(new Error("oops"), "fallback")).toBe("oops");
  });

  it("reads a .message string from plain objects", async () => {
    const { extractErrorMessage } = await import("./notifyMutation");
    expect(
      extractErrorMessage({ message: "from-api" }, "fallback"),
    ).toBe("from-api");
  });

  it("reads a .error string when .message is missing", async () => {
    const { extractErrorMessage } = await import("./notifyMutation");
    expect(extractErrorMessage({ error: "api-code" }, "fallback")).toBe(
      "api-code",
    );
  });

  it("returns the fallback for truly unknown shapes", async () => {
    const { extractErrorMessage } = await import("./notifyMutation");
    expect(extractErrorMessage(null, "fallback")).toBe("fallback");
    expect(extractErrorMessage(undefined, "fallback")).toBe("fallback");
    expect(extractErrorMessage(42, "fallback")).toBe("fallback");
  });
});
