import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { getActiveCompanyContext } from "@/lib/server/company-context";
import {
  addContactsToGroup,
  deleteContact,
  getContactGroupForCompany,
} from "@/lib/server/email-blast-contacts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const groupId = String(payload.group_id ?? "").trim();
  if (!groupId) return NextResponse.json({ error: "group_id is required." }, { status: 400 });

  const companyContext = await getActiveCompanyContext(user.user_id);
  const group = await getContactGroupForCompany(companyContext.company.id, groupId);
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

  const rawContacts = Array.isArray(payload.contacts)
    ? payload.contacts
    : payload.email
      ? [{ email: payload.email, full_name: payload.full_name, company: payload.company }]
      : [];

  const contacts = rawContacts
    .map((entry) => {
      const row = entry as Record<string, unknown>;
      return {
        email: String(row.email ?? "").trim().toLowerCase(),
        fullName: String(row.full_name ?? row.fullName ?? "").trim(),
        company: String(row.company ?? "").trim(),
      };
    })
    .filter((contact) => contact.email);

  if (contacts.length === 0) {
    return NextResponse.json({ error: "At least one contact email is required." }, { status: 400 });
  }

  const invalid = contacts.filter((contact) => !EMAIL_PATTERN.test(contact.email));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Invalid email(s): ${invalid.map((c) => c.email).join(", ")}` }, { status: 400 });
  }

  try {
    const created = await addContactsToGroup(groupId, contacts);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to add contacts." }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const contactId = String(payload?.id ?? payload?.contact_id ?? "").trim();
  if (!contactId) return NextResponse.json({ error: "id is required." }, { status: 400 });

  try {
    const companyContext = await getActiveCompanyContext(user.user_id);
    await deleteContact(companyContext.company.id, contactId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete contact." }, { status: 502 });
  }
}
