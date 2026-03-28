"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";

type LogoutButtonProps = {
    redirectTo?: string;
    basePath?: string;
    renderButton: (props: { type: "button"; className: string; onClick: () => void; children: React.ReactNode }) => React.ReactNode;
};

export function LogoutButton({
    redirectTo = "/login",
    basePath = "/api/auth",
    renderButton,
}: LogoutButtonProps) {
    const router = useRouter();
    const { logout } = useAuth({ basePath });

    async function handleLogout() {
        await logout();
        router.push(redirectTo);
        router.refresh();
    }

    return (
        <>
            {renderButton({ type: "button", className: "w-auto px-6", onClick: handleLogout, children: "Log out" })}
        </>
    );
}
