import styles from "./office.module.css";

import { OfficeBrowser } from "@/components/app/office/office-browser";
import { hasPermission } from "@/lib/permissions";
import { getAppData } from "@/lib/server/app-data";
import { getActiveCompanyContext } from "@/lib/server/company-context";
import { listOfficeFiles } from "@/lib/server/office";

export default async function OfficePage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const [{ location }, data] = await Promise.all([searchParams, getAppData(["Users", "Projects"])]);
  const me = data.currentUser;
  const companyId = (await getActiveCompanyContext(me.user_id)).company.id;
  const files = await listOfficeFiles(me.user_id, companyId).catch((error: unknown) => {
    console.error(error);
    return null;
  });

  const isManager = hasPermission(me.role_id, "projects:manage");
  const projects = data.projects.map((project) => ({
    project_id: project.project_id,
    project_name: project.project_name,
    canContribute:
      isManager || [project.owner_user_id, project.pic_user_id].includes(me.user_id) || project.members.includes(me.user_id),
  }));
  const visibleProjects = new Set(projects.map((project) => project.project_id));
  const known = new Set([...visibleProjects, "personal", "all"]);

  return (
    <div className={styles.page}>
      {files === null ? (
        <p className={styles.notice}>Office needs the Supabase database (<code>ATM_DATA_MODE=supabase</code>).</p>
      ) : (
        <OfficeBrowser
          files={files.filter((file) => file.scope === "personal" || visibleProjects.has(file.project_id ?? ""))}
          projects={projects}
          userNames={Object.fromEntries(data.users.map((user) => [user.user_id, user.full_name]))}
          initialLocation={location && known.has(location) ? location : "all"}
        />
      )}
    </div>
  );
}
