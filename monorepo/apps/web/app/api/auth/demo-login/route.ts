import { NextResponse } from "next/server";
import { ensureRbacSeeded } from "@/lib/db/rbacSeed";
import { ensureDemoUsers, getResolvedDemoCredentials } from "@/lib/db/demoUsers";
import { login, mapAuthError } from "@/lib/auth/authService";
import { setSessionCookie } from "@repo/auth/lib/cookies";

type Preset = "admin" | "user";

export async function POST(request: Request) {
    if (process.env.ALLOW_DEMO_LOGIN !== "true") {
        return NextResponse.json({ error: "Demo login is disabled." }, { status: 404 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const preset = (body as { preset?: string }).preset;
    if (preset !== "admin" && preset !== "user") {
        return NextResponse.json({ error: "preset must be \"admin\" or \"user\"" }, { status: 400 });
    }

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
