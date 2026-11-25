import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { SmartScanError, smartScanReceipt } from "@/lib/ai-receipt";

// Reading a photo with Gemini can take a while
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel's request limit is 4.5 MB

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Send a receipt photo" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo is too large" }, { status: 413 });

  try {
    const receipt = await smartScanReceipt(file);
    return NextResponse.json({ receipt });
  } catch (e) {
    if (e instanceof SmartScanError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Smart scan failed" }, { status: 502 });
  }
}
