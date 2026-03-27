import { ZodError } from "zod";
import {
    forgotPasswordSchema,
    loginSchema,
    resetPasswordSchema,
    signupSchema,
} from "@/lib/auth/validators";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signSessionToken, verifySessionToken } from "@/lib/auth/jwt";
import {
    createUser,
    findUserByEmail,
    findUserById,
    toSafeUser,
    updateUserPassword,
} from "@/lib/db/userRepo";
import { generateEmailToken, verifyEmailToken } from "@/lib/email/tokens";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email/resend";
import type { LoginInput, SessionPayload, SignupInput } from "@/types/auth";
import type { SafeUser } from "@/types/user";

function getValidationError(error: ZodError): string {
    const firstIssue = error.issues[0];
    return firstIssue?.message || "Invalid request payload.";
}

export async function signup(input: SignupInput): Promise<{ user: SafeUser }> {
    const parsed = signupSchema.parse(input);

    const existingUser = await findUserByEmail(parsed.email);
    if (existingUser) {
        throw new Error("An account with this email already exists.");
    }

    const passwordHash = await hashPassword(parsed.password);
    const createdUser = await createUser({
        email: parsed.email,
        name: parsed.name,
        passwordHash,
    });

    // Send verification email
    try {
        const verificationToken = await generateEmailToken(createdUser.email, createdUser.id, "email_verification");
        await sendVerificationEmail(createdUser.email, verificationToken);
    } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Don't fail signup if email fails, but log it
    }

    return { user: toSafeUser(createdUser) };
}

export async function login(input: LoginInput): Promise<{ token: string; user: SafeUser }> {
    const parsed = loginSchema.parse(input);
    const existingUser = await findUserByEmail(parsed.email);

    if (!existingUser) {
        throw new Error("Invalid email or password.");
    }

    const isMatch = await verifyPassword(parsed.password, existingUser.passwordHash);
    if (!isMatch) {
        throw new Error("Invalid email or password.");
    }

    if (!existingUser.emailVerified) {
        throw new Error("Please verify your email before logging in.");
    }

    const payload: SessionPayload = {
        sub: existingUser.id,
    };

    const token = await signSessionToken(payload);
    return { token, user: toSafeUser(existingUser) };
}

export async function getCurrentUserFromToken(token: string): Promise<SafeUser | null> {
    try {
        const payload = await verifySessionToken(token);
        const user = await findUserById(payload.sub);
        return user ? toSafeUser(user) : null;
    } catch {
        return null;
    }
}

export async function requestPasswordReset(input: { email: string }): Promise<void> {
    const parsed = forgotPasswordSchema.parse(input);
    const user = await findUserByEmail(parsed.email);

    // Do not reveal whether an account exists for this email.
    if (!user) {
        return;
    }

    const resetToken = await generateEmailToken(user.email, user.id, "password_reset", "1h");
    await sendPasswordResetEmail(user.email, resetToken);
}

export async function resetPassword(input: { token: string; password: string }): Promise<void> {
    const parsed = resetPasswordSchema.parse(input);
    const payload = await verifyEmailToken(parsed.token);

    if (!payload || payload.type !== "password_reset" || !payload.userId) {
        throw new Error("Invalid or expired reset token.");
    }

    const user = await findUserById(payload.userId);

    if (!user || user.email.toLowerCase() !== payload.email.toLowerCase()) {
        throw new Error("Invalid or expired reset token.");
    }

    const nextPasswordHash = await hashPassword(parsed.password);
    const updated = await updateUserPassword(user.id, nextPasswordHash);

    if (!updated) {
        throw new Error("Unable to reset password.");
    }
}

export function mapAuthError(error: unknown): { message: string; status: number } {
    if (error instanceof ZodError) {
        return { message: getValidationError(error), status: 400 };
    }

    if (error instanceof Error) {
        if (error.message.includes("already exists")) {
            return { message: error.message, status: 409 };
        }

        if (error.message.includes("Invalid email or password")) {
            return { message: error.message, status: 401 };
        }

        if (error.message.includes("Please verify your email before logging in")) {
            return { message: error.message, status: 403 };
        }

        if (error.message.includes("Invalid or expired reset token")) {
            return { message: error.message, status: 400 };
        }

        return { message: error.message, status: 400 };
    }

    return { message: "Something went wrong.", status: 500 };
}
