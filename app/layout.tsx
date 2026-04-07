import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: 'Reminisce — AI Context Orchestration',
  description: 'Reminisce stores your architecture, decisions, and git state — then injects them into every AI call automatically. Define once. Build forever.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://reminisce.app'),
  openGraph: {
    title: 'Reminisce — AI Context Orchestration',
    description: 'Reminisce stores your architecture, decisions, and git state — then injects them into every AI call automatically.',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://reminisce.app',
    siteName: 'Reminisce',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Reminisce — AI Context Orchestration',
    description: 'AI that remembers everything about your project. Define once. Build forever.',
  },
}

import OnboardingGate from '@/components/OnboardingGate'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var t = localStorage.getItem('reminisce-theme') 
                || 'solar-flare';
              document.documentElement.setAttribute(
                'data-theme', t
              );
            } catch(e) {
              document.documentElement.setAttribute(
                'data-theme', 'solar-flare'
              );
            }
          })();
        `}} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <OnboardingGate>
            {children}
          </OnboardingGate>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
