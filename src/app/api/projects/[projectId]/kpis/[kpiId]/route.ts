import { deleteProjectKpi, failure, readJsonBody, requireProjectAccess, updateProjectKpi } from "@/lib/server/project-hub";
import { parseKpiInput } from "@/lib/project-kpi";

type Context = { params: Promise<{ projectId: string; kpiId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { projectId, kpiId } = await context.params;
  const guard = await requireProjectAccess(projectId, "edit");
  if (guard.error) return guard.error;

  const parsed = parseKpiInput(await readJsonBody(request));
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  if (parsed.value.name === "") return Response.json({ error: "KPI name is required." }, { status: 400 });

  try {
    const kpi = await updateProjectKpi(projectId, kpiId, parsed.value);
    if (!kpi) return Response.json({ error: "KPI not found" }, { status: 404 });
    return Response.json({ data: kpi });
  } catch (error) {
    return failure(error, "Failed to update KPI.");
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { projectId, kpiId } = await context.params;
  const guard = await requireProjectAccess(projectId, "edit");
  if (guard.error) return guard.error;

  try {
    await deleteProjectKpi(projectId, kpiId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error, "Failed to delete KPI.");
  }
}
