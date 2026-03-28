import { z } from "zod";

const emailSchema = z
    .string({ error: "Email is required." })
    .trim()
    .email({ error: "Enter a valid email address." });

const passwordSchema = z
    .string({ error: "Password is required." })
    .min(8, "Password must be at least 8 characters long.")
    .max(128, "Password is too long.");

const nameSchema = z
    .string({ error: "Name is required." })
    .trim()
    .min(2, "Name must be at least 2 characters long.")
    .max(60, "Name is too long.");

export const signupSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    name: nameSchema,
});

export const loginSchema = z.object({
    email: emailSchema,
    password: z.string({ error: "Password is required." }),
});

export const forgotPasswordSchema = z.object({
    email: emailSchema,
});

export const resetPasswordSchema = z.object({
    token: z.string({ error: "Reset token is required." }).trim().min(1, "Reset token is required."),
    password: passwordSchema,
});
