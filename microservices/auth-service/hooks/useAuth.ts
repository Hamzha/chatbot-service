"use client";

import { useCallback, useMemo, useState } from "react";
import type { LoginInput, SignupInput } from "@/types/auth";
import type { SafeUser } from "@/types/user";

type AuthState = {
    user: SafeUser | null;
    isLoading: boolean;
};

type AuthResult = {
    ok: boolean;
    error?: string;
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
    return (await response.json()) as T;
}

export function useAuth() {
    const [state, setState] = useState<AuthState>({ user: null, isLoading: false });

    const refreshUser = useCallback(async () => {
        try {
            const response = await fetch("/api/auth/me", { method: "GET", credentials: "include" });
            if (!response.ok) {
                setState({ user: null, isLoading: false });
                return;
            }

            const data = await parseJsonResponse<{ user: SafeUser }>(response);
            setState({ user: data.user, isLoading: false });
        } catch {
            setState({ user: null, isLoading: false });
        }
    }, []);

    const login = useCallback(async (input: LoginInput): Promise<AuthResult> => {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(input),
        });

        const data = await parseJsonResponse<{ user?: SafeUser; error?: string }>(response);

        if (!response.ok || !data.user) {
            return { ok: false, error: data.error || "Unable to sign in." };
        }

        setState({ user: data.user, isLoading: false });
        return { ok: true };
    }, []);

    const signup = useCallback(async (input: SignupInput): Promise<AuthResult> => {
        const response = await fetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(input),
        });

        const data = await parseJsonResponse<{ user?: SafeUser; error?: string }>(response);

        if (!response.ok || !data.user) {
            return { ok: false, error: data.error || "Unable to create account." };
        }

        setState((prev) => ({ ...prev, user: null, isLoading: false }));
        return { ok: true };
    }, []);

    const logout = useCallback(async (): Promise<void> => {
        await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include",
        });

        setState({ user: null, isLoading: false });
    }, []);

    return useMemo(
        () => ({
            user: state.user,
            isLoading: state.isLoading,
            isAuthenticated: Boolean(state.user),
            login,
            signup,
            logout,
            refreshUser,
        }),
        [state.user, state.isLoading, login, signup, logout, refreshUser],
    );
}
