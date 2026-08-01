import { NextResponse } from "next/server";
import { withApiLogging } from "@/lib/api/withApiLogging";
import { clearSessionCookie } from "@repo/auth/lib/cookies";

async function postLogout() {
    await clearSessionCookie();
    return NextResponse.json({ ok: true }, { status: 200 });
}

export const POST = withApiLogging(postLogout);
