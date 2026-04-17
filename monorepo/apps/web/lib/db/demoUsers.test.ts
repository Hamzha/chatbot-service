import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    DEFAULT_DEMO_ADMIN_EMAIL,
    DEFAULT_DEMO_USER_EMAIL,
    getDemoLoginEnv,
    getResolvedDemoCredentials,
} from "@/lib/db/demoUsers";

describe("demoUsers env resolution", () => {
    const original = { ...process.env };

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...original };
    });

    afterEach(() => {
        process.env = { ...original };
    });

    it("returns null when ALLOW_DEMO_LOGIN is not true", () => {
        delete process.env.ALLOW_DEMO_LOGIN;
        expect(getResolvedDemoCredentials()).toBeNull();
        expect(getDemoLoginEnv().enabled).toBe(false);
    });

    it("returns defaults when ALLOW_DEMO_LOGIN is true", () => {
        process.env.ALLOW_DEMO_LOGIN = "true";
        delete process.env.DEMO_ADMIN_EMAIL;
        delete process.env.DEMO_USER_EMAIL;
        delete process.env.DEMO_ADMIN_PASSWORD;
        delete process.env.DEMO_USER_PASSWORD;
        const c = getResolvedDemoCredentials();
        expect(c).not.toBeNull();
        expect(c!.adminEmail).toBe(DEFAULT_DEMO_ADMIN_EMAIL);
        expect(c!.userEmail).toBe(DEFAULT_DEMO_USER_EMAIL);
        expect(c!.adminPassword.length).toBeGreaterThan(0);
        expect(getDemoLoginEnv().enabled).toBe(true);
    });

    it("returns null when admin and user emails would collide", () => {
        process.env.ALLOW_DEMO_LOGIN = "true";
        process.env.DEMO_ADMIN_EMAIL = "same@test.local";
        process.env.DEMO_USER_EMAIL = "same@test.local";
        process.env.DEMO_ADMIN_PASSWORD = "a";
        process.env.DEMO_USER_PASSWORD = "b";
        expect(getResolvedDemoCredentials()).toBeNull();
        expect(getDemoLoginEnv().enabled).toBe(false);
    });
});
