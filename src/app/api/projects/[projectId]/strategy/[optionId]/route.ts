import {
  deleteStrategyOption,
  failure,
  parseTargetShare,
  readJsonBody,
  requireProjectAccess,
  updateStrategyOption,
} from "@/lib/server/project-hub";
import type { StrategyOption } from "@/lib/types/project-hub";

type Context = { params: Promise<{ projectId: string; optionId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { projectId, optionId } = await context.params;
  const guard = await requireProjectAccess(projectId, "edit");
  if (guard.error) return guard.error;

  const body = await readJsonBody(request);
  const patch: Partial<Pick<StrategyOption, "label" | "description" | "target_share" | "sort_order">> = {};

  if (body.label !== undefined) {
    const label = String(body.label ?? "").trim();
    if (!label) return Response.json({ error: "Label is required." }, { status: 400 });
    patch.label = label;
  }
  if (body.description !== undefined) patch.description = String(body.description ?? "").trim();
  if (body.sort_order !== undefined) patch.sort_order = Number(body.sort_order) || 0;
  if (body.target_share !== undefined) {
    const share = parseTargetShare(body.target_share);
    if (share === "invalid") return Response.json({ error: "Target share must be between 0 and 100." }, { status: 400 });
    patch.target_share = share;
  }

  try {
    const option = await updateStrategyOption(projectId, optionId, patch);
    if (!option) return Response.json({ error: "Option not found" }, { status: 404 });
    return Response.json({ data: option });
  } catch (error) {
    return failure(error, "Failed to update strategy option.");
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { projectId, optionId } = await context.params;
  const guard = await requireProjectAccess(projectId, "edit");
  if (guard.error) return guard.error;

  try {
    await deleteStrategyOption(projectId, optionId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error, "Failed to delete strategy option.");
  }
}
