import type { Metadata } from "next";
import { getCurrentUserFromToken } from "@/lib/auth/authService";
import { getSessionCookie } from "@repo/auth/lib/cookies";
import {
  getSiteUrl,
  LandingContent,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  type HomeUser,
} from "@/app/home/LandingContent";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${SITE_NAME} — RAG chatbot for your docs and websites`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "AI chatbot",
    "RAG",
    "retrieval augmented generation",
    "web scraping",
    "PDF chatbot",
    "embeddable chatbot widget",
    "knowledge base chatbot",
    "customer support AI",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  category: "technology",
  formatDetection: { email: false, address: false, telephone: false },
};

async function resolveUser(): Promise<HomeUser> {
  try {
    const token = await getSessionCookie();
    if (!token) return null;
    const u = await getCurrentUserFromToken(token);
    return u ? { email: u.email } : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const user = await resolveUser();
  return <LandingContent user={user} />;
}

