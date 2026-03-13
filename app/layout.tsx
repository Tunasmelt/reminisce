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
  description: 'AI with a Photographic Memory',
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
