import { describe, expect, it } from "vitest";
import { expandRagKeysWithLibrary } from "./expandSessionRagKeys";

const upload = (key: string) => ({ ragSourceKey: key, kind: "upload" as const, pages: [] });
const site = (key: string, pages: string[]) => ({
    ragSourceKey: key,
    kind: "site" as const,
    pages: pages.map((k) => ({ key: k, chunks: 1 })),
});

describe("expandRagKeysWithLibrary", () => {
    it("passes upload keys through unchanged", () => {
        const rows = [upload("cv.pdf"), upload("lor.pdf")];
        expect(expandRagKeysWithLibrary(["cv.pdf", "lor.pdf"], rows)).toEqual([
            "cv.pdf",
            "lor.pdf",
        ]);
    });

    it("expands a site key to every page key", () => {
        const rows = [
            site("https://example.com", [
                "https://example.com/a",
                "https://example.com/b",
                "https://example.com/c",
            ]),
        ];
        expect(expandRagKeysWithLibrary(["https://example.com"], rows)).toEqual([
            "https://example.com/a",
            "https://example.com/b",
            "https://example.com/c",
        ]);
    });

    it("mixes uploads and sites; dedupes across selections", () => {
        const rows = [
            upload("cv.pdf"),
            site("https://a.com", ["https://a.com/x", "https://a.com/y"]),
            site("https://b.com", ["https://b.com/z"]),
        ];
        expect(
            expandRagKeysWithLibrary(
                ["cv.pdf", "https://a.com", "https://b.com", "https://a.com"],
                rows,
            ),
        ).toEqual([
            "cv.pdf",
            "https://a.com/x",
            "https://a.com/y",
            "https://b.com/z",
        ]);
    });

    it("passes unknown keys through unchanged (legacy sessions still work)", () => {
        // A session created before the site-grouping migration referenced a per-page URL key
        // directly. If the library no longer has that exact row, we should still send the key
        // to Chroma — Chroma will just return no matches, rather than us dropping the key.
        expect(expandRagKeysWithLibrary(["https://legacy.com/p1"], [])).toEqual([
            "https://legacy.com/p1",
        ]);
    });

    it("falls back to ragSourceKey for a site row that has no pages yet", () => {
        const rows = [site("https://empty.com", [])];
        expect(expandRagKeysWithLibrary(["https://empty.com"], rows)).toEqual([
            "https://empty.com",
        ]);
    });
});
