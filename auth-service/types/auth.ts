import type { SafeUser } from "@/types/user";

export type LoginInput = {
    email: string;
    password: string;
};

export type SignupInput = {
    email: string;
    name: string;
    password: string;
};

export type AuthResponse = {
    user: SafeUser;
};

export type AuthErrorResponse = {
    error: string;
};

export type SessionPayload = {
    sub: string;
};
