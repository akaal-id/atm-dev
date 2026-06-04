import { LeaderboardView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";
import { syncLeaderboardPoints } from "@/lib/server/gamification";

export default async function LeaderboardPage() {
  await syncLeaderboardPoints();
  const data = await getAppData(["Users", "Departments", "Tasks", "Attendance", "Gamification_Points", "Badges", "User_Badges"]);
  return <LeaderboardView {...data} />;
}
