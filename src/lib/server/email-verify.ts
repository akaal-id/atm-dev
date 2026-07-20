import "server-only";

import { promises as dns } from "node:dns";

export type EmailVerificationStatus = "unchecked" | "valid" | "invalid" | "unknown";

export type EmailVerificationResult = {
  email: string;
  status: Exclude<EmailVerificationStatus, "unchecked">;
  detail: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "yopmail.com",
  "trashmail.com",
  "temp-mail.org",
]);

function domainFromEmail(email: string) {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email.slice(at + 1).trim().toLowerCase();
}

/**
 * Best-effort email check without sending via Resend:
 * 1) syntax  2) disposable domain block  3) MX / A DNS lookup.
 * Does NOT prove a specific mailbox exists (catch-all domains still pass).
 */
export async function verifyEmailAddress(emailInput: string): Promise<EmailVerificationResult> {
  const email = emailInput.trim().toLowerCase();

  if (!email || !EMAIL_PATTERN.test(email)) {
    return { email, status: "invalid", detail: "Format email tidak valid." };
  }

  const domain = domainFromEmail(email);
  if (!domain || !domain.includes(".")) {
    return { email, status: "invalid", detail: "Domain email tidak valid." };
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { email, status: "invalid", detail: "Domain email sementara / disposable." };
  }

  try {
    const mx = await dns.resolveMx(domain);
    if (mx.length > 0) {
      return {
        email,
        status: "valid",
        detail: `Domain siap menerima email (MX: ${mx[0]?.exchange || "ok"}).`,
      };
    }
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : "";
    if (code !== "ENODATA" && code !== "ENOTFOUND") {
      return { email, status: "unknown", detail: "Gagal memeriksa DNS domain. Coba lagi nanti." };
    }
  }

  try {
    const addresses = await dns.resolve4(domain);
    if (addresses.length > 0) {
      return {
        email,
        status: "valid",
        detail: "Domain punya DNS A record (tanpa MX eksplisit).",
      };
    }
  } catch {
    // no A record either
  }

  return { email, status: "invalid", detail: "Domain tidak punya server email (MX tidak ditemukan)." };
}

export async function verifyEmailAddresses(emails: string[]) {
  const unique = [...new Set(emails.map((value) => value.trim().toLowerCase()).filter(Boolean))];
  const results: EmailVerificationResult[] = [];
  for (const email of unique) {
    results.push(await verifyEmailAddress(email));
  }
  return results;
}
