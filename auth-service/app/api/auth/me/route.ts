import { NextResponse } from "next/server";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@/lib/auth/cookies";

export async function GET() {
    const token = await getSessionCookie();
    if (!token) {
        return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await getCurrentUserFromToken(token);
    if (!user) {
        return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user }, { status: 200 });
}
