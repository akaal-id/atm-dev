import type { Metadata } from "next";

import { NotFoundView } from "@/components/app/not-found-view";

export const metadata: Metadata = {
  title: "Halaman tidak tersedia",
};

/**
 * Default Next.js 404 — used for unknown routes and every `notFound()` call
 * (missing tasks, employees, invalid tenant URLs, etc.).
 */
export default function NotFoundPage() {
  return <NotFoundView />;
}
