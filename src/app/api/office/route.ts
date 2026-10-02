import { getCurrentUser } from "@/lib/server/auth";
import { isValidSnapshot } from "@/lib/office-snapshot";
import { createOfficeFile } from "@/lib/server/office";
import { officeFileTypes } from "@/lib/types/office";
import { failure, readJsonBody } from "@/lib/server/project-hub";

/** Create a sheet/doc in a project (`project_id`) or as a personal note (`scope: "personal"`). */
export async function POST(request: Request) {
  if (!(await getCurrentUser())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJsonBody(request);
  const type = officeFileTypes.find((value) => value === body.type) ?? null;
  const title = String(body.title ?? "").trim().slice(0, 200);
  const personal = body.scope === "personal";
  const projectId = String(body.project_id ?? "").trim();

  if (!type) return Response.json({ error: "type must be sheet or doc." }, { status: 400 });
  if (body.snapshot !== undefined && body.snapshot !== null && !isValidSnapshot(type, body.snapshot)) {
    return Response.json({ error: "Invalid file data." }, { status: 400 });
  }
  if (!title) return Response.json({ error: "Title is required." }, { status: 400 });
  if (!personal && !projectId) {
    return Response.json({ error: "Choose a project for this file, or save it as a personal note." }, { status: 400 });
  }

  try {
    const result = await createOfficeFile({
      type,
      title,
      projectId: personal ? null : projectId,
      folder: String(body.folder ?? "").trim().slice(0, 120),
      content: typeof body.content === "string" ? body.content : undefined,
      snapshot: (body.snapshot as Record<string, unknown> | null | undefined) ?? null,
    });
    if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ data: result.file }, { status: 201 });
  } catch (error) {
    return failure(error, "Failed to create file.");
  }
}
