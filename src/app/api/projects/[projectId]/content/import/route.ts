import { createContentItem, failure, readJsonBody, requireProjectAccess } from "@/lib/server/project-hub";
import { supabaseRest } from "@/lib/server/supabase-rest";

/**
 * Turns existing project tasks into content-matrix rows linked by task_id (title, publication
 * date and month come from the task). Tasks that already have a row are skipped, so re-importing is safe.
 */
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const guard = await requireProjectAccess(projectId, "contribute");
  if (guard.error) return guard.error;

  const body = (await readJsonBody(request)) as { task_ids?: unknown } | null;
  const requested = [...new Set(Array.isArray(body?.task_ids) ? body.task_ids.map(String).filter(Boolean) : [])].slice(0, 200);
  if (!requested.length) return Response.json({ error: "Pick at least one task." }, { status: 400 });

  try {
    const enc = encodeURIComponent;
    const [tasks, existing] = await Promise.all([
      supabaseRest<Array<{ task_id: string; title: string; due_date: string | null }>>(
        `/tasks?select=task_id,title,due_date&project_id=eq.${enc(projectId)}&task_id=in.(${requested.map((id) => `"${id.replace(/"/g, "")}"`).join(",")})`,
      ),
      supabaseRest<Array<{ task_id: string }>>(`/content_items?select=task_id&project_id=eq.${enc(projectId)}&task_id=neq.`),
    ]);
    const linked = new Set(existing.map((row) => row.task_id));
    const toImport = tasks.filter((task) => !linked.has(task.task_id));

    const created = [];
    for (const task of toImport) {
      const due = (task.due_date ?? "").slice(0, 10);
      created.push(
        await createContentItem(projectId, guard.access.companyId, guard.access.user.user_id, {
          title: task.title,
          task_id: task.task_id,
          publication_date: due,
          month: due.slice(0, 7),
        }),
      );
    }
    return Response.json({ data: { created: created.length, skipped: requested.length - created.length, items: created } }, { status: 201 });
  } catch (error) {
    return failure(error, "Failed to import tasks.");
  }
}
