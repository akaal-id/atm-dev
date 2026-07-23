import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Suspense } from "react";

import { PwaRegister } from "@/components/app/pwa-register";
import { RouteProgress } from "@/components/app/route-progress";
import "./globals.css";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: {
    default: "Akaal Team Management",
    template: "%s | Akaal Team Management",
  },
  description: "ATM is an internal team management, HR, attendance, tasking, calendar, notification, and performance dashboard.",
  applicationName: "Akaal Team Management",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ATM",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon/atm-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon/atm-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className={`${geistSans.className} min-h-full`}>
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
