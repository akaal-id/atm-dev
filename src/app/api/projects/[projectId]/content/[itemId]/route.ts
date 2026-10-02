import { parseContentInput } from "@/lib/content-matrix";
import {
  deleteContentItem,
  failure,
  isProjectTask,
  listProjectBrandIds,
  readJsonBody,
  requireProjectAccess,
  updateContentItem,
} from "@/lib/server/project-hub";

type Context = { params: Promise<{ projectId: string; itemId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { projectId, itemId } = await context.params;
  const guard = await requireProjectAccess(projectId, "contribute");
  if (guard.error) return guard.error;

  const parsed = parseContentInput(await readJsonBody(request));
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.value).length === 0) return Response.json({ error: "Nothing to update." }, { status: 400 });

  try {
    if (parsed.value.brand_id && !(await listProjectBrandIds(projectId)).includes(parsed.value.brand_id)) {
      return Response.json({ error: "Brand is not part of this project." }, { status: 400 });
    }
    if (parsed.value.task_id && !(await isProjectTask(parsed.value.task_id, projectId))) {
      return Response.json({ error: "Task not found in this project." }, { status: 400 });
    }
    const item = await updateContentItem(projectId, itemId, parsed.value);
    if (!item) return Response.json({ error: "Content not found" }, { status: 404 });
    return Response.json({ data: item });
  } catch (error) {
    return failure(error, "Failed to update content.");
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { projectId, itemId } = await context.params;
  const guard = await requireProjectAccess(projectId, "contribute");
  if (guard.error) return guard.error;

  try {
    await deleteContentItem(projectId, itemId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error, "Failed to delete content.");
  }
}
