import { getSessionCookie } from "@repo/auth/lib/cookies";
import { redirect } from "next/navigation";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default async function OnboardingPage() {
    const token = await getSessionCookie();
    const user = token ? await getCurrentUserFromToken(token) : null;
    if (!user) {
        redirect("/login");
    }
    if (user.onboardingCompleted) {
        redirect("/dashboard");
    }

    return <OnboardingWizard userName={user.name} />;
}
