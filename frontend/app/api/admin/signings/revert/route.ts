import { NextResponse } from "next/server";
import { executeRevertSigning } from "@/lib/revert-signing-server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const logId = Number(body.logId);
    if (!logId || Number.isNaN(logId)) {
      return NextResponse.json({ ok: false, error: "Invalid or missing logId." }, { status: 400 });
    }

    const result = await executeRevertSigning(logId);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
