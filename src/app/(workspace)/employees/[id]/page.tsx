import styles from "./id.module.css";
import { notFound } from "next/navigation";

import { EmployeeProfileView } from "@/components/app/views";
import { requirePermission } from "@/lib/server/auth";
import { getAppData } from "@/lib/server/app-data";
import { officeForDisplay } from "@/lib/server/attendance-location";
import { currentMonthScores } from "@/lib/server/scoring";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("employees:view");
  const { id } = await params;
  const [data, office, scores] = await Promise.all([
    getAppData(["Users", "Departments", "Roles", "Tasks", "Attendance"]),
    officeForDisplay(),
    currentMonthScores(),
  ]);
  const employee = data.users.find((candidate) => candidate.user_id === id);

  if (!employee) notFound();

  return (
    <div className={styles.page}>
      <EmployeeProfileView data={data} employee={employee} office={office} monthScore={scores[employee.user_id]} />
    </div>
  );
}
