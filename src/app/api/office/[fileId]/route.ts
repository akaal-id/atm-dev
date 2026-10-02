import { isValidSnapshot } from "@/lib/office-snapshot";
import { deleteOfficeFile, getOfficeFileAccess, updateOfficeFile } from "@/lib/server/office";
import { failure, readJsonBody } from "@/lib/server/project-hub";
import type { OfficeFile } from "@/lib/types/office";

type Context = { params: Promise<{ fileId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { fileId } = await context.params;
  const access = await getOfficeFileAccess(fileId);
  if (!access) return Response.json({ error: "File not found" }, { status: 404 });
  if (!access.canEdit) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await readJsonBody(request);
  const patch: Partial<Pick<OfficeFile, "title" | "folder" | "snapshot" | "content">> = {};

  if (body.title !== undefined) {
    const title = String(body.title ?? "").trim().slice(0, 200);
    if (!title) return Response.json({ error: "Title is required." }, { status: 400 });
    patch.title = title;
  }
  if (body.folder !== undefined && access.file.scope === "project") patch.folder = String(body.folder ?? "").trim().slice(0, 120);
  if (body.snapshot !== undefined) {
    if (!isValidSnapshot(access.file.type, body.snapshot)) return Response.json({ error: "Invalid file data." }, { status: 400 });
    patch.snapshot = body.snapshot as Record<string, unknown>;
    // Docs keep HTML only until their first Univer save (imported notes).
    if (access.file.type === "doc") patch.content = "";
  }
  if (body.content !== undefined) {
    if (access.file.type !== "doc") return Response.json({ error: "Only docs have content." }, { status: 400 });
    patch.content = String(body.content ?? "");
  }
  if (Object.keys(patch).length === 0) return Response.json({ error: "Nothing to update." }, { status: 400 });

  try {
    const file = await updateOfficeFile(fileId, access.user.user_id, patch);
    return Response.json({ data: file });
  } catch (error) {
    return failure(error, "Failed to save file.");
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { fileId } = await context.params;
  const access = await getOfficeFileAccess(fileId);
  if (!access) return Response.json({ error: "File not found" }, { status: 404 });
  if (!access.canDelete) return Response.json({ error: "Only the file owner or a project editor can delete this file." }, { status: 403 });

  try {
    await deleteOfficeFile(fileId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error, "Failed to delete file.");
  }
}
