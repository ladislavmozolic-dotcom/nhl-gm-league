import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { evaluateUnhappyNow } from "@/lib/unhappy-players-server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, now: await evaluateUnhappyNow() });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Internal server error." }, { status: 500 });
  }
}
