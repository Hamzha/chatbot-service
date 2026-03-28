const DEV_FALLBACK_SECRET = "dev-only-secret-change-in-production";

export const authEnv = {
    jwtSecret:
        process.env.JWT_SECRET ||
        (process.env.NODE_ENV === "production" ? "" : DEV_FALLBACK_SECRET),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN_SECONDS || "3600",
    bcryptRounds: process.env.BCRYPT_SALT_ROUNDS || "10",
    mongodbUri: process.env.MONGODB_URI || "",
};

export function getJwtSecret(): string {
    if (!authEnv.jwtSecret) {
        throw new Error("Missing JWT_SECRET environment variable.");
    }

    return authEnv.jwtSecret;
}

export function getJwtTtlSeconds(): number {
    const parsed = Number.parseInt(authEnv.jwtExpiresIn, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 3600;
    }

    return parsed;
}

export function getBcryptRounds(): number {
    const parsed = Number.parseInt(authEnv.bcryptRounds, 10);
    if (!Number.isFinite(parsed) || parsed < 8 || parsed > 15) {
        return 10;
    }

    return parsed;
}

export function getMongoDbUri(): string {
    if (!authEnv.mongodbUri) {
        throw new Error("Missing MONGODB_URI environment variable.");
    }

    return authEnv.mongodbUri;
}
