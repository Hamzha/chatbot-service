import { NextResponse } from "next/server";
import { login, mapAuthError } from "@/lib/auth/authService";
import { setSessionCookie } from "@repo/auth/lib/cookies";
import type { LoginInput } from "@repo/auth/types";

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as LoginInput;
        const { token, user } = await login(body);

        await setSessionCookie(token);

        return NextResponse.json({ user }, { status: 200 });
    } catch (error) {
        const mapped = mapAuthError(error);
        return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
}
