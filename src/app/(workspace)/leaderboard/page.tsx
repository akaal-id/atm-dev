import { LeaderboardView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";

export default async function LeaderboardPage() {
  const data = await getAppData(["Users", "Departments", "Gamification_Points", "Badges", "User_Badges"]);
  return <LeaderboardView {...data} />;
}
