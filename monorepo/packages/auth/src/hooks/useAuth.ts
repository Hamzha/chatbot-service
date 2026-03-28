"use client";

import { useCallback, useMemo, useState } from "react";
import type { LoginInput, SignupInput, SafeUser } from "../types";

type AuthState = {
    user: SafeUser | null;
    isLoading: boolean;
};

type AuthResult = {
    ok: boolean;
    error?: string;
};

type UseAuthOptions = {
    basePath?: string;
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
    return (await response.json()) as T;
}

export function useAuth({ basePath = "/api/auth" }: UseAuthOptions = {}) {
    const [state, setState] = useState<AuthState>({ user: null, isLoading: false });

    const refreshUser = useCallback(async () => {
        try {
            const response = await fetch(`${basePath}/me`, { method: "GET", credentials: "include" });
            if (!response.ok) {
                setState({ user: null, isLoading: false });
                return;
            }

            const data = await parseJsonResponse<{ user: SafeUser }>(response);
            setState({ user: data.user, isLoading: false });
        } catch {
            setState({ user: null, isLoading: false });
        }
    }, [basePath]);

    const login = useCallback(async (input: LoginInput): Promise<AuthResult> => {
        const response = await fetch(`${basePath}/login`, {
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
    }, [basePath]);

    const signup = useCallback(async (input: SignupInput): Promise<AuthResult> => {
        const response = await fetch(`${basePath}/signup`, {
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
    }, [basePath]);

    const logout = useCallback(async (): Promise<void> => {
        await fetch(`${basePath}/logout`, {
            method: "POST",
            credentials: "include",
        });

        setState({ user: null, isLoading: false });
    }, [basePath]);

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
