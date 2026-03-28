import { NextResponse } from "next/server";
import { clearSessionCookie } from "@repo/auth/lib/cookies";

export async function POST() {
    await clearSessionCookie();
    return NextResponse.json({ ok: true }, { status: 200 });
}
