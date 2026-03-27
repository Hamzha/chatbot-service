import { NextResponse } from "next/server";
import { mapAuthError, requestPasswordReset } from "@/lib/auth/authService";

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as { email: string };
        await requestPasswordReset({ email: body.email });

        // Always return the same response to avoid account enumeration.
        return NextResponse.json(
            { message: "If an account exists for that email, a reset link has been sent." },
            { status: 200 },
        );
    } catch (error) {
        const mapped = mapAuthError(error);
        return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
}
