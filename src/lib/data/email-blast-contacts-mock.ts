export type ContactVerificationStatus = "unchecked" | "valid" | "invalid" | "unknown";

export type MockContact = {
  id: string;
  email: string;
  fullName: string;
  verificationStatus?: ContactVerificationStatus;
  verificationDetail?: string;
};

export type MockContactGroup = {
  id: string;
  groupName: string;
  createdAt: string;
  contacts: MockContact[];
};

/** Stub contact groups until Supabase tables are wired. */
export const mockContactGroups: MockContactGroup[] = [
  {
    id: "group-001",
    groupName: "Prospek B2B",
    createdAt: "2026-07-01T10:00:00+07:00",
    contacts: [
      { id: "c-001", email: "buyer@enterprise.com", fullName: "Andi Buyer" },
      { id: "c-002", email: "procurement@enterprise.com", fullName: "Siti Procurement" },
      { id: "c-003", email: "cto@client.id", fullName: "Budi CTO" },
    ],
  },
  {
    id: "group-002",
    groupName: "Newsletter aktif",
    createdAt: "2026-06-20T09:15:00+07:00",
    contacts: [
      { id: "c-004", email: "a@newsletter.test", fullName: "Alex Newsletter" },
      { id: "c-005", email: "b@newsletter.test", fullName: "Bella Newsletter" },
      { id: "c-006", email: "c@newsletter.test", fullName: "Cahya Newsletter" },
      { id: "c-007", email: "d@newsletter.test", fullName: "Dina Newsletter" },
    ],
  },
  {
    id: "group-003",
    groupName: "Partner sales",
    createdAt: "2026-05-12T14:30:00+07:00",
    contacts: [
      { id: "c-008", email: "sales@partner.co", fullName: "Eko Partner" },
      { id: "c-009", email: "lead@startup.id", fullName: "Fajar Lead" },
    ],
  },
];

export function getMockContactGroup(id: string) {
  return mockContactGroups.find((group) => group.id === id);
}
