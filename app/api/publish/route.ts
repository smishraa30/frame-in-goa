import { NextRequest, NextResponse } from "next/server";
import { encodeId, saveCard } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad_form" }, { status: 400 });
  }

  const image = form.get("image");
  if (!(image instanceof Blob)) return NextResponse.json({ error: "no_image" }, { status: 400 });
  if (image.size > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (image.type && !image.type.startsWith("image/"))
    return NextResponse.json({ error: "not_image" }, { status: 415 });

  const bytes = Buffer.from(await image.arrayBuffer());
  // PNG magic — never persist something that is not actually an image.
  const png = bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!png && !jpg) return NextResponse.json({ error: "not_image" }, { status: 415 });

  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

  let imageUrl: string;
  try {
    imageUrl = await saveCard(id, bytes, png ? "image/png" : "image/jpeg");
  } catch {
    // No blob store configured and the filesystem is read-only: the client
    // falls back to attaching the image directly instead of sharing a link.
    return NextResponse.json({ error: "storage_unavailable" }, { status: 501 });
  }

  const origin = new URL(req.url).origin;
  const shareId = encodeId(imageUrl);
  const meta = String(form.get("meta") || "");
  const q = new URLSearchParams();
  try {
    const m = JSON.parse(meta || "{}") as Record<string, string>;
    const keys: Record<string, string> = {
      name: "n",
      role: "r",
      format: "f",
      builderClass: "c",
      builderId: "i",
    };
    for (const [k, short] of Object.entries(keys)) {
      if (m[k]) q.set(short, String(m[k]).slice(0, 60));
    }
  } catch {
    /* meta is decoration only */
  }
  const qs = q.toString();

  return NextResponse.json({
    id: shareId,
    imageUrl: imageUrl.startsWith("/") ? `${origin}${imageUrl}` : imageUrl,
    pageUrl: `${origin}/s/${shareId}${qs ? `?${qs}` : ""}`,
  });
}
