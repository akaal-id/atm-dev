import { NextResponse, type NextRequest } from "next/server";

import { cleanEmptyStrings, normalizePayload, parseResource, readPayload, redirectBack, requireApiAccess, wantsJson } from "@/lib/server/api";
import { createResource, deleteResource, getResourceById, updateResource } from "@/lib/server/store";

export async function GET(_request: NextRequest, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource: resourceParam, id } = await context.params;
  const resource = parseResource(resourceParam);
  if (!resource) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const access = await requireApiAccess(resource, "read");
  if (access.error) return access.error;

  const record = await getResourceById(resource, id);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: record });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource: resourceParam, id } = await context.params;
  const resource = parseResource(resourceParam);
  if (!resource) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const access = await requireApiAccess(resource, "write");
  if (access.error) return access.error;

  const patch = normalizePayload(cleanEmptyStrings(await readPayload(request)));
  if (resource === "Tasks" && patch.status === "Done") {
    patch.completed_at = new Date().toISOString();
    patch.progress ??= 100;
  }

  const record = await updateResource(resource, id, patch as never);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (resource === "Tasks") {
    await createResource("Activity_Logs", {
      user_id: access.user.user_id,
      action: "updated",
      entity_type: "Tasks",
      entity_id: id,
      description: `${access.user.full_name} updated task ${id}.`,
      created_at: new Date().toISOString(),
    });
  }

  return wantsJson(request) ? NextResponse.json({ data: record }) : redirectBack(request);
}

export async function POST(request: NextRequest, context: { params: Promise<{ resource: string; id: string }> }) {
  const payload = await readPayload(request.clone());
  const method = String(payload._method ?? payload.intent ?? "").toLowerCase();

  if (method === "delete") {
    return DELETE(request, context);
  }

  return PATCH(request, context);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource: resourceParam, id } = await context.params;
  const resource = parseResource(resourceParam);
  if (!resource) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const access = await requireApiAccess(resource, "write");
  if (access.error) return access.error;

  if (resource === "Users" && id === access.user.user_id) {
    return NextResponse.json({ error: "You cannot remove your own account." }, { status: 400 });
  }

  const deleted = await deleteResource(resource, id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (resource === "Users" && !wantsJson(request)) {
    return NextResponse.redirect(new URL("/employees", request.url));
  }

  return wantsJson(request) ? NextResponse.json({ ok: true }) : redirectBack(request);
}
