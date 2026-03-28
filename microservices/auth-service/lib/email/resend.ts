import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
    console.warn("⚠️  RESEND_API_KEY not configured. Email sending will not work.");
}

const resend = new Resend(apiKey);

export const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@resend.dev";

export async function sendVerificationEmail(email: string, token: string) {
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/verify-email?token=${token}`;

    try {
        const result = await resend.emails.send({
            from: EMAIL_FROM,
            to: email,
            subject: "Verify your email address",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Verify Your Email</h2>
                    <p>Thank you for signing up! Please verify your email address by clicking the button below.</p>
                    <a href="${verificationUrl}" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
                        Verify Email
                    </a>
                    <p style="color: #666; font-size: 12px;">
                        Or copy and paste this link: <br/>
                        ${verificationUrl}
                    </p>
                    <p style="color: #999; font-size: 12px;">
                        This link expires in 24 hours.
                    </p>
                </div>
            `,
        });

        return result;
    } catch (error) {
        console.error("Failed to send verification email:", error);
        throw error;
    }
}

export async function sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;

    try {
        const result = await resend.emails.send({
            from: EMAIL_FROM,
            to: email,
            subject: "Reset your password",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Password Reset</h2>
                    <p>We received a request to reset your password. Click the button below to create a new password.</p>
                    <a href="${resetUrl}" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
                        Reset Password
                    </a>
                    <p style="color: #666; font-size: 12px;">
                        Or copy and paste this link: <br/>
                        ${resetUrl}
                    </p>
                    <p style="color: #999; font-size: 12px;">
                        This link expires in 1 hour. If you didn't request this, ignore this email.
                    </p>
                </div>
            `,
        });

        return result;
    } catch (error) {
        console.error("Failed to send password reset email:", error);
        throw error;
    }
}
