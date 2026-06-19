import { ProjectFilesView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";

export default async function ProjectFilesPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const data = await getAppData(["Users", "Projects", "Project_Files"]);
  return <ProjectFilesView data={data} projectId={project} />;
}
