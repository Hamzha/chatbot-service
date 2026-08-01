import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Chatbot Platform",
  description:
    "AI-powered chatbot platform with authentication, web scraping, and RAG-based PDF Q&A",
};

export const viewport: Viewport = {
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden text-slate-900">
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          expand
          duration={4000}
          toastOptions={{
            classNames: {
              toast:
                "rounded-xl border border-slate-200 shadow-lg bg-white/95 backdrop-blur",
              title: "font-semibold text-slate-900",
              description: "text-slate-600",
              actionButton: "bg-slate-900 text-white",
              cancelButton: "bg-slate-100 text-slate-700",
            },
          }}
        />
      </body>
    </html>
  );
}
