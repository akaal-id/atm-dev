import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { getActiveCompanyContext } from "@/lib/server/company-context";
import {
  createContactGroup,
  deleteContactGroup,
  listContactGroupsWithContacts,
} from "@/lib/server/email-blast-contacts";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const context = await getActiveCompanyContext(user.user_id);
  const groups = await listContactGroupsWithContacts(context.company.id);
  return NextResponse.json({
    data: groups.map((group) => ({
      id: group.id,
      group_name: group.group_name,
      created_at: group.created_at,
      user_id: group.user_id,
      created_by: group.created_by ?? { user_id: group.user_id, full_name: group.user_id },
      contacts: group.contacts.map((contact) => ({
        id: contact.id,
        email: contact.email,
        full_name: contact.full_name,
        company: contact.company || "",
        verification_status: contact.verification_status || "unchecked",
        verification_detail: contact.verification_detail || "",
        verified_at: contact.verified_at || null,
      })),
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const groupName = String(payload?.group_name ?? "").trim();
  if (!groupName) return NextResponse.json({ error: "group_name is required." }, { status: 400 });

  try {
    const context = await getActiveCompanyContext(user.user_id);
    const group = await createContactGroup(user.user_id, context.company.id, groupName);
    return NextResponse.json(
      {
        data: {
          ...group,
          contacts: [],
          created_by: { user_id: user.user_id, full_name: user.full_name || user.user_id },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create contact group." }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const groupId = String(payload?.id ?? payload?.group_id ?? "").trim();
  if (!groupId) return NextResponse.json({ error: "id is required." }, { status: 400 });

  try {
    const context = await getActiveCompanyContext(user.user_id);
    await deleteContactGroup(context.company.id, groupId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete contact group." }, { status: 502 });
  }
}
