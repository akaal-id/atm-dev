import { parseCampaignInput } from "@/lib/social-hub";
import { campaignTable, createHubRow, failure, readJsonBody, requireProjectAccess } from "@/lib/server/project-hub";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const guard = await requireProjectAccess(projectId, "edit");
  if (guard.error) return guard.error;

  const parsed = parseCampaignInput(await readJsonBody(request));
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  if (!parsed.value.name) return Response.json({ error: "Name is required." }, { status: 400 });

  try {
    const row = await createHubRow(campaignTable, projectId, guard.access.companyId, parsed.value);
    return Response.json({ data: row }, { status: 201 });
  } catch (error) {
    return failure(error, "Failed to add campaign.");
  }
}
