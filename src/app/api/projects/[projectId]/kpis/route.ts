import { createProjectKpi, failure, readJsonBody, requireProjectAccess } from "@/lib/server/project-hub";
import { parseKpiInput } from "@/lib/project-kpi";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const guard = await requireProjectAccess(projectId, "edit");
  if (guard.error) return guard.error;

  const parsed = parseKpiInput(await readJsonBody(request));
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  if (!parsed.value.name) return Response.json({ error: "KPI name is required." }, { status: 400 });

  try {
    const kpi = await createProjectKpi(projectId, guard.access.companyId, { ...parsed.value, name: parsed.value.name });
    return Response.json({ data: kpi }, { status: 201 });
  } catch (error) {
    return failure(error, "Failed to add KPI.");
  }
}
