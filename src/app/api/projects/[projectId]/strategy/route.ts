import {
  createStrategyOption,
  failure,
  isStrategyOptionType,
  parseTargetShare,
  readJsonBody,
  requireProjectAccess,
} from "@/lib/server/project-hub";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const guard = await requireProjectAccess(projectId, "edit");
  if (guard.error) return guard.error;

  const body = await readJsonBody(request);
  const label = String(body.label ?? "").trim();
  if (!isStrategyOptionType(body.type)) {
    return Response.json({ error: "type must be funnel, pillar, channel or theme." }, { status: 400 });
  }
  if (!label) return Response.json({ error: "Label is required." }, { status: 400 });

  const targetShare = parseTargetShare(body.target_share);
  if (targetShare === "invalid") {
    return Response.json({ error: "Target share must be between 0 and 100." }, { status: 400 });
  }

  try {
    const option = await createStrategyOption(projectId, guard.access.companyId, {
      type: body.type,
      label,
      description: String(body.description ?? "").trim(),
      target_share: targetShare,
      sort_order: Number(body.sort_order ?? 0) || 0,
    });
    return Response.json({ data: option }, { status: 201 });
  } catch (error) {
    return failure(error, "Failed to add strategy option.");
  }
}
