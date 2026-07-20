import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { UploadError, uploadEmailBlastAttachment } from "@/lib/server/uploads";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }

  try {
    const url = await uploadEmailBlastAttachment(file);
    if (!url) {
      return NextResponse.json({ error: "Upload produced an empty URL." }, { status: 502 });
    }
    return NextResponse.json({
      data: {
        url,
        name: file.name,
        size: file.size,
        content_type: file.type || null,
      },
    });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("email-blast upload failed", error);
    return NextResponse.json({ error: "Failed to upload attachment." }, { status: 502 });
  }
}
