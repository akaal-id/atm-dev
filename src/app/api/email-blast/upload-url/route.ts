import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { createEmailBlastUploadUrl, UploadError } from "@/lib/server/uploads";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const fileName = String(body?.fileName ?? "").trim();
  const fileSize = Number(body?.fileSize);
  const contentType = String(body?.contentType ?? "").trim();

  if (!fileName || !Number.isFinite(fileSize) || fileSize <= 0 || !contentType) {
    return NextResponse.json({ error: "fileName, fileSize, and contentType are required." }, { status: 400 });
  }

  try {
    const upload = await createEmailBlastUploadUrl(fileName, fileSize, contentType);
    return NextResponse.json({ data: upload });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("email-blast upload-url failed", error);
    return NextResponse.json({ error: "Failed to create upload URL." }, { status: 502 });
  }
}
