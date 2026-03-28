"use client";

import { useRouter } from "next/navigation";
import { FormButton as Button } from "@repo/ui/form-button";
import { useAuth } from "@repo/auth/hooks/useAuth";

export function LogoutButton() {
    const router = useRouter();
    const { logout } = useAuth();

    async function handleLogout() {
        await logout();
        router.push("/login");
        router.refresh();
    }

    return (
        <Button type="button" className="w-auto px-6" onClick={handleLogout}>
            Log out
        </Button>
    );
}
