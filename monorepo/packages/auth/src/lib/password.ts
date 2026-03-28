import bcrypt from "bcryptjs";
import { getBcryptRounds } from "./env";

export async function hashPassword(password: string): Promise<string> {
    const rounds = getBcryptRounds();
    return bcrypt.hash(password, rounds);
}

export async function verifyPassword(
    password: string,
    passwordHash: string,
): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
}
