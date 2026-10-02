import styles from "./projectId.module.css";

import { notFound } from "next/navigation";

import { ProjectDashboard } from "@/components/app/project-dashboard/project-dashboard";
import { getAppData } from "@/lib/server/app-data";
import { listProjectOfficeFiles } from "@/lib/server/office";
import { getProjectAccess, getProjectHubData } from "@/lib/server/project-hub";
import type { ProjectHubData } from "@/lib/types/project-hub";

export default async function ProjectDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ projectId }, { tab }] = await Promise.all([params, searchParams]);
  const access = await getProjectAccess(projectId);
  if (!access) notFound();

  const [data, hub, officeFiles] = await Promise.all([
    getAppData(["Users", "Tasks", "Project_Files"]),
    getProjectHubData(projectId, access.companyId).catch((error: unknown) => {
      console.error(error);
      return null;
    }),
    listProjectOfficeFiles(projectId).catch(() => []),
  ]);

  const emptyHub: ProjectHubData = { brands: [], companyBrands: [], strategy: [], kpis: [], content: [], personas: [], campaigns: [] };

  return (
    <div className={styles.page}>
      <ProjectDashboard
        project={access.project}
        canEdit={access.canEdit}
        canContribute={access.canContribute}
        initialTab={tab}
        users={data.users.map((user) => ({ user_id: user.user_id, full_name: user.full_name, profile_photo: user.profile_photo, position: user.position, is_active: user.is_active }))}
        tasks={data.tasks.filter((task) => task.project_id === projectId)}
        files={data.projectFiles.filter((file) => file.project_id === projectId)}
        hub={hub ?? emptyHub}
        hubUnavailable={hub === null}
        officeFiles={officeFiles}
      />
    </div>
  );
}
