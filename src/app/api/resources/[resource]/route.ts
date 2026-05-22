import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";

import { demoPassword } from "@/lib/data/seed";
import { cleanEmptyStrings, getRecordId, normalizePayload, parseResource, readPayload, redirectBack, requireApiAccess, wantsJson } from "@/lib/server/api";
import { createResource, listResource } from "@/lib/server/store";
import { UploadError } from "@/lib/server/uploads";

const departmentPhraseCodes: Record<string, string> = {
  "board": "bod",
  "board of directors": "bod",
  "bod": "bod",
  "human resource": "hr",
  "human resources": "hr",
  "hr": "hr",
  "social media": "socmed",
  "social media specialist": "socmedspec",
};

const departmentWordCodes: Record<string, string> = {
  social: "soc",
  media: "med",
  specialist: "spec",
  resources: "res",
  resource: "res",
  operations: "ops",
};

function normalizeDepartmentName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeDepartmentId(name: string) {
  const normalized = normalizeDepartmentName(name);
  if (!normalized) return "";
  const phraseCode = departmentPhraseCodes[normalized];
  if (phraseCode) return `dept_${phraseCode}`;

  const words = normalized.split(" ").filter(Boolean);
  const code = words
    .map((word) => departmentWordCodes[word] ?? word)
    .join("")
    .slice(0, 32);

  return `dept_${code}`;
}

async function uniqueDepartmentId(name: string) {
  const baseId = makeDepartmentId(name);
  if (!baseId) return "";

  const departments = await listResource("Departments");
  const existingIds = new Set(departments.map((department) => department.department_id));
  if (!existingIds.has(baseId)) return baseId;

  let index = 2;
  while (existingIds.has(`${baseId}_${index}`)) index += 1;
  return `${baseId}_${index}`;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ resource: string }> }) {
  const { resource: resourceParam } = await context.params;
  const resource = parseResource(resourceParam);
  if (!resource) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const access = await requireApiAccess(resource, "read");
  if (access.error) return access.error;

  return NextResponse.json({ data: await listResource(resource) });
}

export async function POST(request: NextRequest, context: { params: Promise<{ resource: string }> }) {
  const { resource: resourceParam } = await context.params;
  const resource = parseResource(resourceParam);
  if (!resource) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const access = await requireApiAccess(resource, "write");
  if (access.error) return access.error;

  let payload: Record<string, unknown>;
  try {
    payload = normalizePayload(cleanEmptyStrings(await readPayload(request)));
  } catch (error) {
    if (error instanceof UploadError) {
      return wantsJson(request) ? NextResponse.json({ error: error.message }, { status: 400 }) : redirectBack(request);
    }
    throw error;
  }

  const now = new Date().toISOString();

  if (resource === "Users") {
    payload.password_hash_or_auth_id = await bcrypt.hash(String(payload.password ?? demoPassword), 10);
    delete payload.password;
    payload.profile_photo ??= "";
    payload.bio ??= "";
    payload.is_active ??= true;
    payload.signup_status ??= "verified";
    payload.signup_provider ??= "password";
    payload.verification_key_hash ??= "";
    payload.verification_expires_at ??= "";
    payload.requested_at ??= "";
    payload.approved_at ??= now;
    payload.rejected_at ??= "";
    payload.rejection_reason ??= "";
    payload.created_at ??= now;
    payload.updated_at ??= now;
  }

  if (resource === "Task_Comments") {
    payload.mentions ??= [];
    payload.updated_at ??= now;
  }

  if (resource === "Tasks") {
    payload.assigned_by ??= access.user.user_id;
    payload.assigned_to = Array.isArray(payload.assigned_to) && payload.assigned_to.length > 0 ? payload.assigned_to : [access.user.user_id];
    payload.status ??= "To Do";
    payload.priority ??= "Medium";
    payload.progress = Number(payload.progress ?? 0);
    payload.labels = Array.isArray(payload.labels) ? payload.labels : [];
    payload.completed_at ??= "";
  }

  if (resource === "Departments") {
    payload.department_id ||= await uniqueDepartmentId(String(payload.department_name ?? ""));
    payload.leader_user_id ??= "";
  }

  if (resource === "Leave_Requests") {
    payload.status ??= "Pending Approval";
    payload.approved_by ??= "";
    payload.approval_note ??= "";
  }

  if (resource === "Announcements") {
    payload.target_department ??= "all";
    payload.target_users ??= [];
    payload.scheduled_at ??= now;
    payload.is_pinned ??= false;
  }

  const record = await createResource(resource, payload as never);
  const entityId = getRecordId(record as unknown as Record<string, unknown>, resource);

  if (resource === "Tasks" && Array.isArray(payload.assigned_to)) {
    await Promise.all(
      payload.assigned_to.map((userId) =>
        createResource("Notifications", {
          user_id: String(userId),
          title: "New task assigned",
          description: `${access.user.full_name} assigned you: ${String(payload.title ?? "Untitled task")}`,
          type: "task_assigned",
          related_link: `/tasks/${entityId}`,
          is_read: false,
          created_at: now,
        }),
      ),
    );
  }

  if (resource !== "Activity_Logs") {
    await createResource("Activity_Logs", {
      user_id: access.user.user_id,
      action: "created",
      entity_type: resource,
      entity_id: entityId,
      description: `${access.user.full_name} created ${resource.replaceAll("_", " ")}.`,
      created_at: now,
    });
  }

  if (wantsJson(request)) return NextResponse.json({ data: record }, { status: 201 });
  if (resource === "Tasks") return NextResponse.redirect(new URL(`/tasks/${entityId}`, request.url));
  return redirectBack(request);
}
