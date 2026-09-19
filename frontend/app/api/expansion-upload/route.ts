import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { isAdmin } from "@/lib/auth";

// Expansion-team logo upload. Admin only. Saves under public/uploads/teams and
// returns the public path — served live by Caddy (no rebuild needed), same
// mechanism as app/api/site-upload/route.ts.
export const runtime = "nodejs";

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" };

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ error: "Nepodporovaný formát (PNG/JPG/WEBP/GIF/SVG)" }, { status: 400 });
  if (file.size > 4_000_000) return NextResponse.json({ error: "Súbor je príliš veľký (max 4 MB)" }, { status: 400 });

  const name = `${randomBytes(8).toString("hex")}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const dir = join(process.cwd(), "public", "uploads", "teams");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), bytes);
  return NextResponse.json({ url: `/uploads/teams/${name}` });
}
