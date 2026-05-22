import type { Metadata } from "next";
import { Suspense } from "react";

import { RouteProgress } from "@/components/app/route-progress";
import "./globals.css";

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
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
