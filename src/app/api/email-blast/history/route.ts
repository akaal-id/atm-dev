import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { listEmailBlasts } from "@/lib/server/email-blasts";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const blasts = await listEmailBlasts(user.user_id);
  return NextResponse.json({
    data: blasts.map((blast) => ({
      id: blast.id,
      subject: blast.subject,
      body: blast.body,
      attachment_url: blast.attachment_url,
      status: blast.status,
      created_at: blast.created_at,
      recipient_count: blast.recipients.length,
      recipients: blast.recipients.map((recipient) => ({
        id: recipient.id,
        email: recipient.recipient_email,
        status: recipient.status,
      })),
    })),
  });
}
