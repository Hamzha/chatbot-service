"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";

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
