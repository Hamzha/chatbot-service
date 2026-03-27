import { SignJWT, jwtVerify } from "jose";
import { getJwtSecret, getJwtTtlSeconds } from "@/lib/auth/env";
import type { SessionPayload } from "@/types/auth";

const encoder = new TextEncoder();

function getSecretKey() {
    return encoder.encode(getJwtSecret());
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
    const ttlSeconds = getJwtTtlSeconds();

    return new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(payload.sub)
        .setIssuedAt()
        .setExpirationTime(`${ttlSeconds}s`)
        .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload> {
    const { payload } = await jwtVerify(token, getSecretKey(), {
        algorithms: ["HS256"],
    });

    if (!payload.sub) {
        throw new Error("Invalid session payload.");
    }

    return {
        sub: payload.sub,
    };
}
