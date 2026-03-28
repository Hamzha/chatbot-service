import { jwtVerify, SignJWT } from "jose";
import { getJwtSecret } from "./env";

const encoder = new TextEncoder();

function getSecretKey() {
    return encoder.encode(getJwtSecret());
}

export interface EmailTokenPayload {
    type: "email_verification" | "password_reset";
    email: string;
    userId?: string;
    iat: number;
}

export async function generateEmailToken(
    email: string,
    userId?: string,
    type: "email_verification" | "password_reset" = "email_verification",
    expiresIn: string = "24h",
): Promise<string> {
    const payload: Record<string, unknown> = {
        type,
        email,
    };

    if (userId) {
        payload.userId = userId;
    }

    const token = await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime(expiresIn)
        .sign(getSecretKey());

    return token;
}

export async function verifyEmailToken(token: string): Promise<EmailTokenPayload | null> {
    try {
        const verified = await jwtVerify(token, getSecretKey());
        const payload = verified.payload;

        if (
            (payload.type !== "email_verification" && payload.type !== "password_reset") ||
            typeof payload.email !== "string"
        ) {
            return null;
        }

        return {
            type: payload.type as "email_verification" | "password_reset",
            email: payload.email as string,
            userId: typeof payload.userId === "string" ? payload.userId : undefined,
            iat: typeof payload.iat === "number" ? payload.iat : 0,
        };
    } catch {
        return null;
    }
}
