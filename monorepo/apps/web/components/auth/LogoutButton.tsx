"use client";

import { useRouter } from "next/navigation";
import { FormButton as Button } from "@repo/ui/form-button";
import { useAuth } from "@repo/auth/hooks/useAuth";
import { logoutButtonThemeClasses } from "@/lib/theme/components/logout-button.theme";

export function LogoutButton() {
    const router = useRouter();
    const { logout } = useAuth();

    async function handleLogout() {
        await logout();
        router.push("/login");
        router.refresh();
    }

    return (
        <Button type="button" className={logoutButtonThemeClasses.button} onClick={handleLogout}>
            Log out
        </Button>
    );
}
