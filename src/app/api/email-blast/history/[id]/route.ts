import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { getEmailBlast } from "@/lib/server/email-blasts";
import { signStoredEmailAttachment } from "@/lib/server/uploads";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const blast = await getEmailBlast(id, user.user_id);
  if (!blast) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attachmentUrl = blast.attachment_url ? await signStoredEmailAttachment(blast.attachment_url) : null;
  const attachmentName = blast.attachment_url ? blast.attachment_url.split("/").pop()?.split("?")[0] || null : null;

  return NextResponse.json({
    data: {
      id: blast.id,
      subject: blast.subject,
      body: blast.body,
      attachment_url: attachmentUrl,
      attachment_name: attachmentName,
      status: blast.status,
      created_at: blast.created_at,
      resend_batch_id: blast.resend_batch_id,
      recipients: blast.recipients.map((recipient) => ({
        id: recipient.id,
        email: recipient.recipient_email,
        status: recipient.status,
        error: recipient.error,
        resend_id: recipient.resend_id,
      })),
    },
  });
}
