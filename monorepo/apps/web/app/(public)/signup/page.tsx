import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";
import { AuthShell } from "@/components/auth/AuthShell";

export default function SignupPage() {
    return (
        <AuthShell
            badge="Get Started"
            title="Create your account"
            subtitle="Set up secure access in less than a minute and start building production-ready chatbot workflows."
            sideTitle="Launch faster with a workflow-first dashboard"
            sideDescription="After signup, you can connect your knowledge sources, monitor ingestion jobs, and manage chatbot responses from one place."
            sidePoints={[
                "Guided onboarding into chatbot setup",
                "Email verification for account protection",
                "Built for teams working on real customer flows",
            ]}
            footer={
                <p>
                    Already have an account?{" "}
                    <Link href="/login" className="font-semibold text-cyan-700 transition hover:text-cyan-900">
                        Log in instead
                    </Link>
                    .
                </p>
            }
        >
            <SignupForm />
        </AuthShell>
    );
}
