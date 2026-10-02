import { parsePersonaInput } from "@/lib/social-hub";
import { personaTable, deleteHubRow, failure, readJsonBody, requireProjectAccess, updateHubRow } from "@/lib/server/project-hub";

type Context = { params: Promise<{ projectId: string; personaId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { projectId, personaId } = await context.params;
  const guard = await requireProjectAccess(projectId, "edit");
  if (guard.error) return guard.error;

  const parsed = parsePersonaInput(await readJsonBody(request));
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.value).length === 0) return Response.json({ error: "Nothing to update." }, { status: 400 });

  try {
    const row = await updateHubRow(personaTable, projectId, personaId, parsed.value);
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ data: row });
  } catch (error) {
    return failure(error, "Failed to update persona.");
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { projectId, personaId } = await context.params;
  const guard = await requireProjectAccess(projectId, "edit");
  if (guard.error) return guard.error;

  try {
    await deleteHubRow(personaTable, projectId, personaId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error, "Failed to delete persona.");
  }
}
