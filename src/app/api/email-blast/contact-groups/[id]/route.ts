import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { getActiveCompanyContext } from "@/lib/server/company-context";
import { getContactGroupWithContacts } from "@/lib/server/email-blast-contacts";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const groupId = String(id ?? "").trim();
  if (!groupId) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const companyContext = await getActiveCompanyContext(user.user_id);
  const group = await getContactGroupWithContacts(companyContext.company.id, groupId);
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

  return NextResponse.json({
    data: {
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
    },
  });
}
