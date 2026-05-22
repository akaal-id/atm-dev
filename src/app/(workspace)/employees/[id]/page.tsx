import { notFound } from "next/navigation";

import { EmployeeProfileView } from "@/components/app/views";
import { requirePermission } from "@/lib/server/auth";
import { getAppData } from "@/lib/server/app-data";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("employees:view");
  const { id } = await params;
  const data = await getAppData();
  const employee = data.users.find((candidate) => candidate.user_id === id);

  if (!employee) notFound();

  return <EmployeeProfileView data={data} employee={employee} />;
}
