import { failure, readJsonBody, requireProjectAccess } from "@/lib/server/project-hub";
import { updateResource } from "@/lib/server/store";
import { projectStatuses } from "@/lib/permissions";
import type { Project, ProjectStatus } from "@/lib/types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const textFields = ["objective", "pic_user_id", "sop_content"] as const;
const dateFields = ["period_start", "period_end"] as const;

/** Update project-hub header fields (status, type, period, objective, PIC, SOP). */
export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const guard = await requireProjectAccess(projectId, "edit");
  if (guard.error) return guard.error;

  const body = await readJsonBody(request);
  const patch: Partial<Project> = {};

  if (body.status !== undefined) {
    const status = String(body.status);
    if (!(projectStatuses as readonly string[]).includes(status)) {
      return Response.json({ error: `status must be one of: ${projectStatuses.join(", ")}.` }, { status: 400 });
    }
    patch.status = status as ProjectStatus;
    // A finished project is 100% done.
    if (status === "Completed") patch.progress = 100;
  }
  if (body.project_type !== undefined) {
    if (body.project_type !== "general" && body.project_type !== "social_media") {
      return Response.json({ error: "project_type must be general or social_media." }, { status: 400 });
    }
    patch.project_type = body.project_type;
  }
  for (const field of textFields) {
    if (body[field] !== undefined) patch[field] = String(body[field] ?? "").trim();
  }
  for (const field of dateFields) {
    if (body[field] === undefined) continue;
    const value = String(body[field] ?? "").trim();
    if (value && !DATE_PATTERN.test(value)) {
      return Response.json({ error: `${field} must be YYYY-MM-DD.` }, { status: 400 });
    }
    patch[field] = value;
  }

  const start = patch.period_start ?? guard.access.project.period_start ?? "";
  const end = patch.period_end ?? guard.access.project.period_end ?? "";
  if (start && end && end < start) {
    return Response.json({ error: "Period end must be on or after period start." }, { status: 400 });
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const project = await updateResource("Projects", projectId, patch);
    return Response.json({ data: project });
  } catch (error) {
    return failure(error, "Failed to update project.");
  }
}
