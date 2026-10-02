import styles from "./employees.module.css";
import { EmployeesView } from "@/components/app/views";
import { requirePermission } from "@/lib/server/auth";
import { getAppData } from "@/lib/server/app-data";
import { currentMonthScores } from "@/lib/server/scoring";

export default async function EmployeesPage() {
  await requirePermission("employees:view");
  const [data, scores] = await Promise.all([getAppData(["Users", "Departments", "Roles"]), currentMonthScores()]);
  return (
    <div className={styles.page}>
      <EmployeesView {...data} scores={scores} />
    </div>
  );
}
