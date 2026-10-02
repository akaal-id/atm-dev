import { parseContentInput } from "@/lib/content-matrix";
import {
  createContentItem,
  failure,
  isProjectTask,
  listProjectBrandIds,
  readJsonBody,
  requireProjectAccess,
} from "@/lib/server/project-hub";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const guard = await requireProjectAccess(projectId, "contribute");
  if (guard.error) return guard.error;

  const parsed = parseContentInput(await readJsonBody(request));
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const { value } = parsed;
  if (!value.title) return Response.json({ error: "Title is required." }, { status: 400 });

  try {
    if (value.brand_id && !(await listProjectBrandIds(projectId)).includes(value.brand_id)) {
      return Response.json({ error: "Brand is not part of this project." }, { status: 400 });
    }
    if (value.task_id && !(await isProjectTask(value.task_id, projectId))) {
      return Response.json({ error: "Task not found in this project." }, { status: 400 });
    }
    const item = await createContentItem(projectId, guard.access.companyId, guard.access.user.user_id, { ...value, title: value.title });
    return Response.json({ data: item }, { status: 201 });
  } catch (error) {
    return failure(error, "Failed to add content.");
  }
}
