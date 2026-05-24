import { EmployeesView } from "@/components/app/views";
import { requirePermission } from "@/lib/server/auth";
import { getAppData } from "@/lib/server/app-data";

export default async function EmployeesPage() {
  await requirePermission("employees:view");
  const data = await getAppData(["Users", "Departments", "Roles", "Gamification_Points"]);
  return <EmployeesView {...data} />;
}
