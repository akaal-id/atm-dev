import { parseCampaignInput } from "@/lib/social-hub";
import { campaignTable, deleteHubRow, failure, readJsonBody, requireProjectAccess, updateHubRow } from "@/lib/server/project-hub";

type Context = { params: Promise<{ projectId: string; campaignId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { projectId, campaignId } = await context.params;
  const guard = await requireProjectAccess(projectId, "edit");
  if (guard.error) return guard.error;

  const parsed = parseCampaignInput(await readJsonBody(request));
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.value).length === 0) return Response.json({ error: "Nothing to update." }, { status: 400 });

  try {
    const row = await updateHubRow(campaignTable, projectId, campaignId, parsed.value);
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ data: row });
  } catch (error) {
    return failure(error, "Failed to update campaign.");
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { projectId, campaignId } = await context.params;
  const guard = await requireProjectAccess(projectId, "edit");
  if (guard.error) return guard.error;

  try {
    await deleteHubRow(campaignTable, projectId, campaignId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error, "Failed to delete campaign.");
  }
}
