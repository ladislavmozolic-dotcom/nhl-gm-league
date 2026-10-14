import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { getTeamSession } from "@/lib/auth";
import { chatEnabled } from "@/lib/im/server";

// Chat pictures: photos, GIFs, avatars. Any signed-in GM. Saved under public/uploads/chat
// (served straight from the uploads volume by Caddy). Type is decided by the file's
// magic bytes, never by the client-sent MIME — and SVG is not accepted (script risk).
export const runtime = "nodejs";
const MAX = 8_000_000;

function sniff(b: Buffer): "png" | "jpg" | "gif" | "webp" | null {
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 6 && (b.subarray(0, 6).toString("ascii") === "GIF87a" || b.subarray(0, 6).toString("ascii") === "GIF89a")) return "gif";
  if (b.length > 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

export async function POST(request: Request) {
  const me = await getTeamSession();
  if (!me || !(await chatEnabled())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Súbor je príliš veľký (max 8 MB)" }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = sniff(bytes);
  if (!ext) return NextResponse.json({ error: "Povolené sú PNG, JPG, WEBP a GIF" }, { status: 400 });
  const name = `${randomBytes(8).toString("hex")}.${ext}`;
  const dir = join(process.cwd(), "public", "uploads", "chat");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), bytes);
  return NextResponse.json({ url: `/uploads/chat/${name}` });
}
