import { LeaderboardView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";

export default async function LeaderboardPage() {
  const data = await getAppData();
  return <LeaderboardView {...data} />;
}
