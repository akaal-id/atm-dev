import styles from "./project-files.module.css";
import { ProjectFilesView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";

export default async function ProjectFilesPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const data = await getAppData(["Users", "Projects", "Project_Files"]);
  return (
    <div className={styles.page}>
      <ProjectFilesView data={data} projectId={project} />
    </div>
  );
}
