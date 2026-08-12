import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { getActiveCompanyContext } from "@/lib/server/company-context";
import {
  getContactGroupWithContacts,
  listContactsByIdsForCompany,
  updateContactVerification,
} from "@/lib/server/email-blast-contacts";
import { verifyEmailAddress } from "@/lib/server/email-verify";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const companyContext = await getActiveCompanyContext(user.user_id);
  const companyId = companyContext.company.id;

  const groupId = String(payload.group_id ?? "").trim();
  const rawIds = Array.isArray(payload.contact_ids)
    ? payload.contact_ids.map((id) => String(id ?? "").trim()).filter(Boolean)
    : [];

  let contacts = rawIds.length > 0 ? await listContactsByIdsForCompany(companyId, rawIds) : [];

  if (contacts.length === 0 && groupId) {
    const group = await getContactGroupWithContacts(companyId, groupId);
    if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });
    contacts = group.contacts;
  }

  if (contacts.length === 0) {
    return NextResponse.json({ error: "No contacts to verify." }, { status: 400 });
  }

  const results = [];
  for (const contact of contacts) {
    const verified = await verifyEmailAddress(contact.email);
    const updated = await updateContactVerification(contact.id, {
      status: verified.status,
      detail: verified.detail,
    });
    results.push({
      id: contact.id,
      email: contact.email,
      verification_status: updated?.verification_status || verified.status,
      verification_detail: updated?.verification_detail || verified.detail,
      verified_at: updated?.verified_at || new Date().toISOString(),
    });
  }

  const summary = {
    total: results.length,
    valid: results.filter((item) => item.verification_status === "valid").length,
    invalid: results.filter((item) => item.verification_status === "invalid").length,
    unknown: results.filter((item) => item.verification_status === "unknown").length,
  };

  return NextResponse.json({ data: results, summary });
}
