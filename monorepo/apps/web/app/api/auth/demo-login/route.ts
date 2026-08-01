import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureRbacSeeded } from "@/lib/db/rbacSeed";
import { ensureDemoUsers, getResolvedDemoCredentials } from "@/lib/db/demoUsers";
import { login, mapAuthError } from "@/lib/auth/authService";
import { parseJsonBody } from "@/lib/api/routeValidation";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { requireRateLimitByIp } from "@/lib/rateLimit/requireRateLimit";
import { setSessionCookie } from "@repo/auth/lib/cookies";

type Preset = "admin" | "user";
const demoLoginSchema = z.object({
    preset: z.enum(["admin", "user"], { message: "preset must be \"admin\" or \"user\"" }),
});

async function postDemoLogin(request: Request) {
    const limited = await requireRateLimitByIp(request, "auth:demo-login", { limit: 5, windowSec: 900 });
    if (limited) return limited;

    if (process.env.ALLOW_DEMO_LOGIN !== "true") {
        return NextResponse.json({ error: "Demo login is disabled." }, { status: 404 });
    }

    const parsed = await parseJsonBody(request, demoLoginSchema);
    if (!parsed.ok) return parsed.response;
    const preset = parsed.data.preset;

    const c = getResolvedDemoCredentials();
    if (!c) {
        return NextResponse.json({ error: "Demo login is not configured." }, { status: 503 });
    }

    const email = preset === "admin" ? c.adminEmail : c.userEmail;
    const password = preset === "admin" ? c.adminPassword : c.userPassword;

    try {
        await ensureRbacSeeded();
        await ensureDemoUsers();
        const { token, user } = await login({ email, password });
        await setSessionCookie(token);
        return NextResponse.json({ user, preset: preset as Preset }, { status: 200 });
    } catch (error) {
        const mapped = mapAuthError(error);
        return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
}

export const POST = withApiLogging(postDemoLogin);
