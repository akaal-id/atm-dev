import styles from "./gamification-settings.module.css";

import { GamificationSettings } from "@/components/app/gamification-settings";
import { defaultTrack, isScoreTrack } from "@/lib/scoring";
import { requirePermission } from "@/lib/server/auth";
import { getScoringConfig } from "@/lib/server/scoring";
import { listResource } from "@/lib/server/store";

export default async function AdminGamificationSettingsPage() {
  await requirePermission("settings:manage");
  const [config, users, departments, ledger] = await Promise.all([
    getScoringConfig(),
    listResource("Users"),
    listResource("Departments"),
    listResource("Gamification_Points"),
  ]);
  const departmentName = new Map(departments.map((department) => [department.department_id, department.department_name]));
  const people = users
    .filter((user) => user.is_active && user.role_id !== "org_owner")
    .sort((left, right) => left.full_name.localeCompare(right.full_name))
    .map((user) => ({
      user_id: user.user_id,
      full_name: user.full_name,
      photo: user.profile_photo || "",
      department: departmentName.get(user.department_id) ?? "",
      track: defaultTrack(user),
      trackSet: isScoreTrack(user.score_track),
    }));
  const adjustments = ledger
    .filter((entry) => entry.source_type === "manual_adjustment")
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 20)
    .map(({ point_id, user_id, points, reason, created_at }) => ({ point_id, user_id, points: Number(points), reason, created_at }));

  return (
    <div className={styles.page}>
      <GamificationSettings initialConfig={config} people={people} adjustments={adjustments} />
    </div>
  );
}
