import { ProjectsView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";

export default async function ProjectsPage() {
  const data = await getAppData(["Users", "Projects"]);
  return <ProjectsView {...data} />;
}
