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

const FILE_EXT = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "txt", "zip"]);
const FILE_MAX = 15_000_000;
function fileOk(ext: string, b: Buffer): boolean {
  const head = b.subarray(0, 8);
  if (ext === "pdf") return b.subarray(0, 4).toString("ascii") === "%PDF";
  if (["docx", "xlsx", "pptx", "zip"].includes(ext)) return head[0] === 0x50 && head[1] === 0x4b;
  if (["doc", "xls", "ppt"].includes(ext)) return head.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  return !b.subarray(0, 4096).includes(0); // csv / txt: plain text only
}

export async function POST(request: Request) {
  const me = await getTeamSession();
  if (!me || !(await chatEnabled())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (form?.get("kind") === "voice") {
    // voice messages: WAV only (encoded in the browser — plays on every phone/desktop), verified by header, ≤ 6 MB
    if (file.size > 6_000_000) return NextResponse.json({ error: "Hlasová správa je príliš dlhá" }, { status: 400 });
    const wav = Buffer.from(await file.arrayBuffer());
    if (!(wav.length > 44 && wav.subarray(0, 4).toString("ascii") === "RIFF" && wav.subarray(8, 12).toString("ascii") === "WAVE")) return NextResponse.json({ error: "Neplatný zvuk" }, { status: 400 });
    const vname = `${randomBytes(8).toString("hex")}.wav`;
    const vdir = join(process.cwd(), "public", "uploads", "chat", "voice");
    await mkdir(vdir, { recursive: true });
    await writeFile(join(vdir, vname), wav);
    return NextResponse.json({ url: `/uploads/chat/voice/${vname}` });
  }
  if (form?.get("kind") === "file") {
    // documents: strict extension whitelist + content check; stored under a random name (never served as HTML/JS)
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!FILE_EXT.has(ext)) return NextResponse.json({ error: "Povolené súbory: PDF, Word, Excel, PowerPoint, CSV, TXT, ZIP" }, { status: 400 });
    if (file.size > FILE_MAX) return NextResponse.json({ error: "Súbor je príliš veľký (max 15 MB)" }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    if (!fileOk(ext, buf)) return NextResponse.json({ error: "Obsah súboru nezodpovedá jeho typu" }, { status: 400 });
    const stored = `${randomBytes(8).toString("hex")}.${ext}`;
    const fdir = join(process.cwd(), "public", "uploads", "chat", "files");
    await mkdir(fdir, { recursive: true });
    await writeFile(join(fdir, stored), buf);
    return NextResponse.json({ url: `/uploads/chat/files/${stored}`, name: file.name.replace(/[\u0000-\u001f<>]/g, "").slice(0, 120), size: buf.length });
  }
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
