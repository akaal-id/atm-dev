import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { listEmailBlasts } from "@/lib/server/email-blasts";
import { signStoredEmailAttachment } from "@/lib/server/uploads";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const blasts = await listEmailBlasts(user.user_id);
  const data = await Promise.all(
    blasts.map(async (blast) => ({
      id: blast.id,
      subject: blast.subject,
      body: blast.body,
      attachment_url: blast.attachment_url ? await signStoredEmailAttachment(blast.attachment_url) : null,
      attachment_name: blast.attachment_url ? blast.attachment_url.split("/").pop()?.split("?")[0] || null : null,
      status: blast.status,
      created_at: blast.created_at,
      recipient_count: blast.recipients.length,
      recipients: blast.recipients.map((recipient) => ({
        id: recipient.id,
        email: recipient.recipient_email,
        status: recipient.status,
      })),
    })),
  );

  return NextResponse.json({ data });
}
