import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth/session";

const protectedRoutes = ["/dashboard"];
const authPages = ["/login", "/signup"];

function matchesPath(pathname: string, basePaths: string[]): boolean {
    return basePaths.some((basePath) => {
        return pathname === basePath || pathname.startsWith(`${basePath}/`);
    });
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const isProtectedRoute = matchesPath(pathname, protectedRoutes);
    const isAuthPage = matchesPath(pathname, authPages);

    if (!isProtectedRoute && !isAuthPage) {
        return NextResponse.next();
    }

    const user = await getAuthenticatedUserFromRequest(request);

    if (isProtectedRoute && !user) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    if (isAuthPage && user) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (isProtectedRoute && user) {
        const onOnboarding =
            pathname === "/dashboard/onboarding" || pathname.startsWith("/dashboard/onboarding/");

        if (!user.onboardingCompleted && !onOnboarding) {
            return NextResponse.redirect(new URL("/dashboard/onboarding", request.url));
        }

        if (user.onboardingCompleted && onOnboarding) {
            return NextResponse.redirect(new URL("/dashboard", request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*", "/login", "/signup"],
};
