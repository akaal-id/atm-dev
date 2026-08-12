export type BlastRecipientStatus =
  | "sent"
  | "delivered"
  | "bounced"
  | "failed"
  | "pending"
  | "opened"
  | "clicked"
  | "complained"
  | "delivery_delayed"
  | "queued"
  | "scheduled"
  | "canceled"
  | "suppressed"
  | "skipped";

export type MockCreatedBy = {
  userId: string;
  fullName: string;
};

export type MockBlastRecipient = {
  id: string;
  email: string;
  status: BlastRecipientStatus;
};

export type MockEmailBlast = {
  id: string;
  subject: string;
  body: string;
  attachmentName: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  createdBy?: MockCreatedBy;
  recipients: MockBlastRecipient[];
};

/** Stub send history until backend/Supabase is wired. */
export const mockEmailBlasts: MockEmailBlast[] = [
  {
    id: "blast-001",
    subject: "Promo Q3 — Katalog Akaal 2026",
    body: "Halo tim,\n\nBerikut katalog promo kuartal ini. Silakan cek lampiran dan hubungi kami jika ada pertanyaan.\n\nSalam,\nMarketing Akaal",
    attachmentName: "katalog-q3-2026.pdf",
    attachmentUrl: "#",
    createdAt: "2026-07-18T09:30:00+07:00",
    createdBy: { userId: "usr_demo", fullName: "Demo User" },
    recipients: [
      { id: "r-001", email: "prospek1@contoh.com", status: "delivered" },
      { id: "r-002", email: "prospek2@contoh.com", status: "delivered" },
      { id: "r-003", email: "lead@startup.id", status: "bounced" },
      { id: "r-004", email: "sales@partner.co", status: "sent" },
    ],
  },
  {
    id: "blast-002",
    subject: "Undangan demo produk — Akaal Team",
    body: "Yth. Bapak/Ibu,\n\nKami mengundang Anda untuk sesi demo singkat minggu depan. Detail jadwal terlampir.\n\nTerima kasih.",
    attachmentName: null,
    attachmentUrl: null,
    createdAt: "2026-07-15T14:05:00+07:00",
    createdBy: { userId: "usr_demo", fullName: "Demo User" },
    recipients: [
      { id: "r-005", email: "cto@client.id", status: "delivered" },
      { id: "r-006", email: "ops@client.id", status: "delivered" },
      { id: "r-007", email: "invalid@", status: "failed" },
    ],
  },
  {
    id: "blast-003",
    subject: "Follow-up proposal B2B",
    body: "Halo,\n\nMelanjutkan diskusi kemarin, berikut ringkasan proposal kami. Mohon konfirmasinya.\n\nHormat kami.",
    attachmentName: "proposal-b2b.docx",
    attachmentUrl: "#",
    createdAt: "2026-07-10T11:20:00+07:00",
    createdBy: { userId: "usr_demo", fullName: "Demo User" },
    recipients: [
      { id: "r-008", email: "buyer@enterprise.com", status: "delivered" },
      { id: "r-009", email: "procurement@enterprise.com", status: "pending" },
    ],
  },
  {
    id: "blast-004",
    subject: "Newsletter bulanan — update fitur",
    body: "Tim marketing,\n\nRingkasan update produk bulan ini untuk dibagikan ke prospek aktif.",
    attachmentName: null,
    attachmentUrl: null,
    createdAt: "2026-07-02T08:00:00+07:00",
    createdBy: { userId: "usr_demo", fullName: "Demo User" },
    recipients: [
      { id: "r-010", email: "a@newsletter.test", status: "delivered" },
      { id: "r-011", email: "b@newsletter.test", status: "delivered" },
      { id: "r-012", email: "c@newsletter.test", status: "delivered" },
      { id: "r-013", email: "d@newsletter.test", status: "bounced" },
      { id: "r-014", email: "e@newsletter.test", status: "delivered" },
    ],
  },
];

export function blastOverallStatus(blast: MockEmailBlast): string {
  const statuses = blast.recipients.map((recipient) => recipient.status);
  if (statuses.length === 0) return "Sent";
  if (statuses.every((status) => status === "skipped")) return "Skipped";
  const failedLike = statuses.some((status) =>
    ["failed", "bounced", "complained", "canceled", "suppressed"].includes(status),
  );
  const successLike = statuses.some((status) =>
    ["sent", "delivered", "opened", "clicked", "queued", "scheduled", "delivery_delayed"].includes(status),
  );
  if (failedLike && successLike) return "Partial";
  if (failedLike && !successLike) return "Failed";
  if (statuses.some((status) => ["pending", "queued", "delivery_delayed"].includes(status))) return "Pending";
  return "Sent";
}

export function getMockEmailBlast(id: string) {
  return mockEmailBlasts.find((blast) => blast.id === id);
}

export function normalizeRecipientStatus(status: string): BlastRecipientStatus {
  const known: BlastRecipientStatus[] = [
    "sent",
    "delivered",
    "bounced",
    "failed",
    "pending",
    "opened",
    "clicked",
    "complained",
    "delivery_delayed",
    "queued",
    "scheduled",
    "canceled",
    "suppressed",
    "skipped",
  ];
  if (known.includes(status as BlastRecipientStatus)) return status as BlastRecipientStatus;
  if (status === "skipped") return "skipped";
  return "sent";
}
