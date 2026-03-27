import { jwtVerify, SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret-key-min-32-chars");

export interface EmailTokenPayload {
    type: "email_verification" | "password_reset";
    email: string;
    userId?: string;
    iat: number;
}

/**
 * Generate email verification token (24 hour expiry)
 */
export async function generateEmailToken(
    email: string,
    userId?: string,
    type: "email_verification" | "password_reset" = "email_verification",
    expiresIn: string = "24h",
): Promise<string> {
    const payload = {
        type,
        email,
        userId,
    };

    if (userId) {
        payload.userId = userId;
    }

    const token = await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime(expiresIn)
        .sign(secret);

    return token;
}

/**
 * Verify and decode email token
 */
export async function verifyEmailToken(token: string): Promise<EmailTokenPayload | null> {
    try {
        const verified = await jwtVerify(token, secret);
        const payload = verified.payload;

        if (
            (payload.type !== "email_verification" && payload.type !== "password_reset") ||
            typeof payload.email !== "string"
        ) {
            return null;
        }

        return {
            type: payload.type,
            email: payload.email,
            userId: typeof payload.userId === "string" ? payload.userId : undefined,
            iat: typeof payload.iat === "number" ? payload.iat : 0,
        };
    } catch {
        return null;
    }
}
