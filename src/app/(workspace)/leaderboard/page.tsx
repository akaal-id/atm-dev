import styles from "./leaderboard.module.css";

import { LeaderboardView } from "@/components/app/leaderboard";
import { jakartaToday } from "@/lib/metrics";
import { isScoreTrack, type LeaderboardPeriodView } from "@/lib/scoring";
import { requirePermission } from "@/lib/server/auth";
import { getLeaderboard } from "@/lib/server/scoring";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; track?: string; dept?: string }> }) {
  const user = await requirePermission("leaderboard:view");
  const params = await searchParams;
  const view: LeaderboardPeriodView = params.view === "week" || params.view === "quarter" ? params.view : "month";
  const date = params.date && DATE.test(params.date) ? params.date : jakartaToday();
  const data = await getLeaderboard(view, date);

  return (
    <div className={styles.page}>
      <LeaderboardView
        data={data}
        currentUserId={user.user_id}
        filters={{ view, date, track: isScoreTrack(params.track) ? params.track : "", dept: params.dept ?? "" }}
      />
    </div>
  );
}
