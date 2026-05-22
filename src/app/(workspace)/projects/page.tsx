import { ProjectsView } from "@/components/app/views";
import { requirePermission } from "@/lib/server/auth";
import { getAppData } from "@/lib/server/app-data";

export default async function ProjectsPage() {
  await requirePermission("projects:manage");
  const data = await getAppData();
  return <ProjectsView {...data} />;
}
