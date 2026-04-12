import { describe, expect, it } from "vitest";

import { resolveSelectedDocumentsFromLibrary } from "./resolveSessionSelectedDocuments";

describe("resolveSelectedDocumentsFromLibrary", () => {
  it("maps rag keys to display names in session order", () => {
    const rows = [
      { id: "a1", source: "alpha.pdf", ragSourceKey: "key-alpha" },
      { id: "b2", source: "beta.pdf", ragSourceKey: "key-beta" },
    ];
    const result = resolveSelectedDocumentsFromLibrary(rows, ["key-beta", "key-alpha"]);
    expect(result).toEqual([
      {
        ragSourceKey: "key-beta",
        displayName: "beta.pdf",
        documentId: "b2",
        inLibrary: true,
      },
      {
        ragSourceKey: "key-alpha",
        displayName: "alpha.pdf",
        documentId: "a1",
        inLibrary: true,
      },
    ]);
  });

  it("marks missing keys as not in library", () => {
    const rows = [{ id: "a1", source: "only.pdf", ragSourceKey: "key-only" }];
    const result = resolveSelectedDocumentsFromLibrary(rows, ["key-only", "ghost-key"]);
    expect(result[0].inLibrary).toBe(true);
    expect(result[1]).toEqual({
      ragSourceKey: "ghost-key",
      displayName: "Document no longer in library",
      documentId: null,
      inLibrary: false,
    });
  });

  it("handles empty library", () => {
    const result = resolveSelectedDocumentsFromLibrary([], ["k1", "k2"]);
    expect(result.every((r) => !r.inLibrary)).toBe(true);
    expect(result.map((r) => r.displayName).every((n) => n === "Document no longer in library")).toBe(true);
  });

  it("uses last row when duplicate ragSourceKey in library (defensive)", () => {
    const rows = [
      { id: "old", source: "old.pdf", ragSourceKey: "dup" },
      { id: "new", source: "new.pdf", ragSourceKey: "dup" },
    ];
    const result = resolveSelectedDocumentsFromLibrary(rows, ["dup"]);
    expect(result[0].documentId).toBe("new");
    expect(result[0].displayName).toBe("new.pdf");
  });
});
