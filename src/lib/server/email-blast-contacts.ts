import "server-only";

import { makeId } from "@/lib/utils";

function supabaseUrl() {
  const projectId = process.env.SUPABASE_PROJECT_ID;
  const explicitUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  return (explicitUrl || (projectId ? `https://${projectId}.supabase.co` : "")).replace(/\/$/, "");
}

function supabaseKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function headers() {
  const key = supabaseKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

export type CreatedByInfo = {
  user_id: string;
  full_name: string;
};

export type ContactGroupRecord = {
  id: string;
  user_id: string;
  company_id: string;
  group_name: string;
  created_at: string;
};

export type ContactVerificationStatus = "unchecked" | "valid" | "invalid" | "unknown";

export type ContactRecord = {
  id: string;
  group_id: string;
  email: string;
  full_name: string;
  company: string;
  created_at?: string;
  verification_status?: ContactVerificationStatus;
  verification_detail?: string;
  verified_at?: string | null;
};

export type ContactGroupWithContacts = ContactGroupRecord & {
  contacts: ContactRecord[];
  created_by?: CreatedByInfo;
};

async function lookupUsersByIds(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) return map;

  const response = await fetch(
    `${baseUrl}/rest/v1/users?user_id=in.(${unique.map(encodeURIComponent).join(",")})&select=user_id,full_name`,
    { headers: headers(), cache: "no-store" },
  );
  if (!response.ok) return map;
  const rows = (await response.json()) as Array<{ user_id: string; full_name: string }>;
  for (const row of rows) {
    map.set(row.user_id, row.full_name || row.user_id);
  }
  return map;
}

function withCreatedBy(group: ContactGroupRecord, names: Map<string, string>): ContactGroupWithContacts {
  return {
    ...group,
    contacts: [],
    created_by: {
      user_id: group.user_id,
      full_name: names.get(group.user_id) || group.user_id,
    },
  };
}

export async function listContactGroupsWithContacts(companyId: string): Promise<ContactGroupWithContacts[]> {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) return [];

  const groupsRes = await fetch(
    `${baseUrl}/rest/v1/contact_groups?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=created_at.desc`,
    { headers: headers(), cache: "no-store" },
  );
  if (!groupsRes.ok) return [];
  const groups = (await groupsRes.json()) as ContactGroupRecord[];
  if (groups.length === 0) return [];

  const groupIds = groups.map((group) => group.id);
  const contactsRes = await fetch(
    `${baseUrl}/rest/v1/contacts?group_id=in.(${groupIds.map(encodeURIComponent).join(",")})&select=*&order=full_name.asc`,
    { headers: headers(), cache: "no-store" },
  );
  const contacts = contactsRes.ok ? ((await contactsRes.json()) as ContactRecord[]) : [];
  const names = await lookupUsersByIds(groups.map((group) => group.user_id));

  return groups.map((group) => ({
    ...withCreatedBy(group, names),
    contacts: contacts.filter((contact) => contact.group_id === group.id),
  }));
}

export async function createContactGroup(
  userId: string,
  companyId: string,
  groupName: string,
): Promise<ContactGroupRecord> {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) throw new Error("Supabase is not configured.");

  const record = {
    id: makeId("cgrp"),
    user_id: userId,
    company_id: companyId,
    group_name: groupName.trim(),
    created_at: new Date().toISOString(),
  };

  const response = await fetch(`${baseUrl}/rest/v1/contact_groups`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(record),
  });
  if (!response.ok) {
    throw new Error(`Failed to create contact group (${response.status})`);
  }
  const rows = (await response.json()) as ContactGroupRecord[];
  return rows[0] ?? record;
}

export async function deleteContactGroup(companyId: string, groupId: string) {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) throw new Error("Supabase is not configured.");

  const response = await fetch(
    `${baseUrl}/rest/v1/contact_groups?id=eq.${encodeURIComponent(groupId)}&company_id=eq.${encodeURIComponent(companyId)}`,
    { method: "DELETE", headers: headers() },
  );
  if (!response.ok) throw new Error(`Failed to delete contact group (${response.status})`);
}

export async function addContactsToGroup(
  groupId: string,
  contacts: Array<{ email: string; fullName?: string; company?: string }>,
): Promise<ContactRecord[]> {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) throw new Error("Supabase is not configured.");

  const rows = contacts.map((contact) => ({
    id: makeId("ctct"),
    group_id: groupId,
    email: contact.email.trim().toLowerCase(),
    full_name: (contact.fullName || "").trim(),
    company: (contact.company || "").trim(),
    verification_status: "unchecked",
    verification_detail: "",
    verified_at: null,
    created_at: new Date().toISOString(),
  }));

  if (rows.length === 0) return [];

  const response = await fetch(`${baseUrl}/rest/v1/contacts`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`Failed to add contacts (${response.status})`);
  return (await response.json()) as ContactRecord[];
}

export async function getContactGroupForCompany(companyId: string, groupId: string) {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) return null;

  const response = await fetch(
    `${baseUrl}/rest/v1/contact_groups?id=eq.${encodeURIComponent(groupId)}&company_id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`,
    { headers: headers(), cache: "no-store" },
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as ContactGroupRecord[];
  return rows[0] ?? null;
}

export async function getContactGroupWithContacts(
  companyId: string,
  groupId: string,
): Promise<ContactGroupWithContacts | null> {
  const group = await getContactGroupForCompany(companyId, groupId);
  if (!group) return null;

  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) return { ...group, contacts: [], created_by: { user_id: group.user_id, full_name: group.user_id } };

  const contactsRes = await fetch(
    `${baseUrl}/rest/v1/contacts?group_id=eq.${encodeURIComponent(groupId)}&select=*&order=full_name.asc`,
    { headers: headers(), cache: "no-store" },
  );
  const contacts = contactsRes.ok ? ((await contactsRes.json()) as ContactRecord[]) : [];
  const names = await lookupUsersByIds([group.user_id]);

  return {
    ...withCreatedBy(group, names),
    contacts,
  };
}

export async function deleteContact(companyId: string, contactId: string) {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) throw new Error("Supabase is not configured.");

  const contactRes = await fetch(
    `${baseUrl}/rest/v1/contacts?id=eq.${encodeURIComponent(contactId)}&select=id,group_id&limit=1`,
    { headers: headers(), cache: "no-store" },
  );
  if (!contactRes.ok) throw new Error(`Failed to load contact (${contactRes.status})`);
  const contacts = (await contactRes.json()) as Array<{ id: string; group_id: string }>;
  const contact = contacts[0];
  if (!contact) throw new Error("Contact not found");

  const group = await getContactGroupForCompany(companyId, contact.group_id);
  if (!group) throw new Error("Forbidden");

  const response = await fetch(`${baseUrl}/rest/v1/contacts?id=eq.${encodeURIComponent(contactId)}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!response.ok) throw new Error(`Failed to delete contact (${response.status})`);
}

export async function updateContactVerification(
  contactId: string,
  input: {
    status: ContactVerificationStatus;
    detail: string;
  },
): Promise<ContactRecord> {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) throw new Error("Supabase is not configured.");

  const response = await fetch(`${baseUrl}/rest/v1/contacts?id=eq.${encodeURIComponent(contactId)}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({
      verification_status: input.status,
      verification_detail: input.detail,
      verified_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Failed to update verification (${response.status})`);
  const rows = (await response.json()) as ContactRecord[];
  return rows[0];
}

export async function listContactsByIdsForCompany(companyId: string, contactIds: string[]): Promise<ContactRecord[]> {
  if (contactIds.length === 0) return [];
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) return [];

  const response = await fetch(
    `${baseUrl}/rest/v1/contacts?id=in.(${contactIds.map(encodeURIComponent).join(",")})&select=*`,
    { headers: headers(), cache: "no-store" },
  );
  if (!response.ok) return [];
  const contacts = (await response.json()) as ContactRecord[];

  const allowed: ContactRecord[] = [];
  for (const contact of contacts) {
    const group = await getContactGroupForCompany(companyId, contact.group_id);
    if (group) allowed.push(contact);
  }
  return allowed;
}
