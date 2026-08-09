import { ZodError } from "zod";
import {
    forgotPasswordSchema,
    loginSchema,
    resetPasswordSchema,
    signupSchema,
} from "@repo/auth/validators";
import { hashPassword, verifyPassword } from "@repo/auth/lib/password";
import { signSessionToken, verifySessionToken } from "@repo/auth/lib/jwt";
import {
    createGoogleUser,
    createUser,
    findUserByEmail,
    findUserByGoogleId,
    findUserById,
    isGoogleOnlyUser,
    linkGoogleAccount,
    toSafeUser,
    updateUserPassword,
} from "@/lib/db/userRepo";
import { ensureRbacSeeded } from "@/lib/db/rbacSeed";
import { addRoleSlugsToUser } from "@/lib/db/roleRepo";
import { generateEmailToken, verifyEmailToken } from "@repo/auth/lib/tokens";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email/resend";
import type { LoginInput, SessionPayload, SignupInput } from "@repo/auth/types";
import type { SafeUser } from "@repo/auth/types";
import type { GoogleUserProfile } from "@/lib/auth/googleOAuth";

export const GOOGLE_SIGN_IN_MESSAGE =
    "This account was created with Google. Please sign in with Google.";

function getValidationError(error: ZodError): string {
    const firstIssue = error.issues[0];
    return firstIssue?.message || "Invalid request payload.";
}

export async function signup(input: SignupInput): Promise<{ user: SafeUser }> {
    const parsed = signupSchema.parse(input);

    const existingUser = await findUserByEmail(parsed.email);
    if (existingUser) {
        if (isGoogleOnlyUser(existingUser)) {
            throw new Error(GOOGLE_SIGN_IN_MESSAGE);
        }
        throw new Error("An account with this email already exists.");
    }

    const passwordHash = await hashPassword(parsed.password);
    const createdUser = await createUser({
        email: parsed.email,
        name: parsed.name,
        passwordHash,
    });

    await ensureRbacSeeded();
    await addRoleSlugsToUser(createdUser.id, ["user"]);

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
    await ensureRbacSeeded();
    const existingUser = await findUserByEmail(parsed.email);

    if (!existingUser) {
        throw new Error("Invalid email or password.");
    }

    if (isGoogleOnlyUser(existingUser)) {
        throw new Error(GOOGLE_SIGN_IN_MESSAGE);
    }

    if (!existingUser.passwordHash) {
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

export async function loginOrSignupWithGoogle(
    profile: GoogleUserProfile,
): Promise<{ token: string; user: SafeUser }> {
    if (!profile.emailVerified) {
        throw new Error("Google account email is not verified.");
    }

    await ensureRbacSeeded();

    let user = await findUserByGoogleId(profile.googleId);

    if (!user) {
        const byEmail = await findUserByEmail(profile.email);
        if (byEmail) {
            const linked = await linkGoogleAccount(byEmail.id, {
                googleId: profile.googleId,
                image: profile.picture,
                name: profile.name,
            });
            if (!linked) {
                throw new Error("Unable to link Google account.");
            }
            user = linked;
        } else {
            user = await createGoogleUser({
                email: profile.email,
                name: profile.name,
                googleId: profile.googleId,
                image: profile.picture,
            });
            await addRoleSlugsToUser(user.id, ["user"]);
        }
    }

    const token = await signSessionToken({ sub: user.id });
    return { token, user: toSafeUser(user) };
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

export type PasswordResetRequestResult =
    | { kind: "sent" }
    | { kind: "google_only" }
    | { kind: "noop" };

export async function requestPasswordReset(input: { email: string }): Promise<PasswordResetRequestResult> {
    const parsed = forgotPasswordSchema.parse(input);
    const user = await findUserByEmail(parsed.email);

    // Do not reveal whether a normal account exists for this email.
    if (!user) {
        return { kind: "noop" };
    }

    // Google-only accounts have no password — tell the user to use Google sign-in.
    if (isGoogleOnlyUser(user)) {
        return { kind: "google_only" };
    }

    if (!user.passwordHash) {
        return { kind: "noop" };
    }

    const resetToken = await generateEmailToken(user.email, user.id, "password_reset", "1h");
    await sendPasswordResetEmail(user.email, resetToken);
    return { kind: "sent" };
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

        if (error.message === GOOGLE_SIGN_IN_MESSAGE) {
            return { message: error.message, status: 400 };
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
