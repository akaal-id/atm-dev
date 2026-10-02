import { applyDefaultStrategy, failure, requireProjectAccess } from "@/lib/server/project-hub";

/** Add Akaal's default funnel / pillar / channel options that the project doesn't have yet. */
export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const guard = await requireProjectAccess(projectId, "edit");
  if (guard.error) return guard.error;

  try {
    const added = await applyDefaultStrategy(projectId, guard.access.companyId);
    return Response.json({ data: { added } });
  } catch (error) {
    return failure(error, "Failed to apply default strategy.");
  }
}
