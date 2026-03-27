import { NextResponse } from "next/server";
import { mapAuthError, signup } from "@/lib/auth/authService";
import type { SignupInput } from "@/types/auth";

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as SignupInput;
        const { user } = await signup(body);

        return NextResponse.json({ user }, { status: 201 });
    } catch (error) {
        const mapped = mapAuthError(error);
        return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
}
