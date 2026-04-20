/**
 * Unit tests for the tiny pure helpers exported from the jobs POST route.
 * Heavier integration-style tests (auth, Mongo, worker kick-off) live in
 * `app/api/rbacRouteHandlers.http.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { normalizeBoundedInt } from "./route";

describe("normalizeBoundedInt", () => {
    it("returns fallback for non-numeric values", () => {
        expect(normalizeBoundedInt("abc", 5, 1, 10)).toBe(5);
        expect(normalizeBoundedInt(undefined, 5, 1, 10)).toBe(5);
        expect(normalizeBoundedInt({}, 5, 1, 10)).toBe(5);
    });

    it("coerces null to 0 (Number(null) === 0) and clamps to min", () => {
        // Note: Number(null) === 0, so this documents the current behaviour
        // rather than treating null as missing.
        expect(normalizeBoundedInt(null, 5, 1, 10)).toBe(1);
    });

    it("returns fallback for NaN and Infinity", () => {
        expect(normalizeBoundedInt(NaN, 5, 1, 10)).toBe(5);
        expect(normalizeBoundedInt(Infinity, 5, 1, 10)).toBe(5);
        expect(normalizeBoundedInt(-Infinity, 5, 1, 10)).toBe(5);
    });

    it("clamps to the min bound when value is below the range", () => {
        expect(normalizeBoundedInt(-10, 5, 1, 10)).toBe(1);
        expect(normalizeBoundedInt(0, 5, 1, 10)).toBe(1);
    });

    it("clamps to the max bound when value is above the range", () => {
        expect(normalizeBoundedInt(999, 5, 1, 10)).toBe(10);
    });

    it("returns the integer inside the range untouched", () => {
        expect(normalizeBoundedInt(7, 5, 1, 10)).toBe(7);
    });

    it("floors fractional input", () => {
        expect(normalizeBoundedInt(3.9, 5, 1, 10)).toBe(3);
    });

    it("parses numeric strings", () => {
        expect(normalizeBoundedInt("7", 5, 1, 10)).toBe(7);
    });

    it("uses fallback for empty string (Number('') is 0 → clamped to min)", () => {
        // Number("") === 0, which is below min=1, so clamps to 1.
        expect(normalizeBoundedInt("", 5, 1, 10)).toBe(1);
    });
});
