import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
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
  title: "InternShippy — AI resume tailoring for startup applications",
  description:
    "Paste a job description, get a recruiter-grade resume + ATS-clean variant in 30 seconds. Drag-reorder, edit, ship.",
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
      <body className="min-h-full flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <ClerkProvider>
          <header className="sticky top-0 z-20 backdrop-blur bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
            <div className="mx-auto max-w-7xl w-full px-6 h-14 flex items-center justify-between">
              <Link
                href="/"
                className="font-semibold tracking-tight text-base hover:opacity-80 transition"
              >
                InternShippy
              </Link>
              <nav className="flex items-center gap-3 text-sm">
                <Show when="signed-in">
                  <Link
                    href="/dashboard"
                    className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/library"
                    className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
                  >
                    Library
                  </Link>
                  <UserButton />
                </Show>
                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="px-3 py-1.5 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition text-sm font-medium">
                      Get started
                    </button>
                  </SignUpButton>
                </Show>
              </nav>
            </div>
          </header>
          <div className="flex-1 flex flex-col">{children}</div>
        </ClerkProvider>
      </body>
    </html>
  );
}
