import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HubPage } from "@/components/hub/hub-page";
import { akaalHub } from "@/lib/data/akaal-hub";
import { getSession } from "@/lib/server/auth";

export const metadata: Metadata = {
  title: "AKAAL",
  description: akaalHub.brand.tagline,
  openGraph: {
    title: "AKAAL",
    description: akaalHub.brand.tagline,
    url: "https://team.akaal.id",
    siteName: "AKAAL",
    type: "website",
  },
};

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return <HubPage />;
}
