import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import {
  mergeTactics,
  type TeamTactics,
  type Tempo,
  type Forecheck,
  type PuckStyle,
  type DZone,
  type PpStyle,
  type PkStyle,
} from "@/lib/sim/tactics";

const allowed = {
  tempo: new Set<Tempo>(["slow", "balanced", "fast"]),
  forecheck: new Set<Forecheck>(["passive", "balanced", "aggressive"]),
  puckStyle: new Set<PuckStyle>(["cycle", "balanced", "rush", "shotVolume"]),
  dZone: new Set<DZone>(["collapse", "balanced", "aggressive"]),
  ppStyle: new Set<PpStyle>(["balanced", "umbrella", "131", "overload"]),
  pkStyle: new Set<PkStyle>(["balanced", "box", "diamond", "aggressive"]),
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teamId = Number((await params).id);
  if (!Number.isInteger(teamId) || teamId <= 0) return NextResponse.json({ ok: false, error: "invalid team" }, { status: 400 });
  if (!(await canManageTeam(teamId))) return NextResponse.json({ ok: false, error: "not authorized" }, { status: 403 });

  const body = await request.json().catch(() => null) as Partial<TeamTactics> | null;
  if (!body
    || !allowed.tempo.has(body.tempo as Tempo)
    || !allowed.forecheck.has(body.forecheck as Forecheck)
    || !allowed.puckStyle.has(body.puckStyle as PuckStyle)
    || !allowed.dZone.has(body.dZone as DZone)
    || !allowed.ppStyle.has((body.ppStyle ?? "balanced") as PpStyle)
    || !allowed.pkStyle.has((body.pkStyle ?? "balanced") as PkStyle)) {
    return NextResponse.json({ ok: false, error: "invalid tactics" }, { status: 400 });
  }

  const clean = mergeTactics({
    tempo: body.tempo,
    forecheck: body.forecheck,
    puckStyle: body.puckStyle,
    dZone: body.dZone,
    ppStyle: body.ppStyle ?? "balanced",
    pkStyle: body.pkStyle ?? "balanced",
    ...(typeof body.preset === "string" ? { preset: body.preset } : {}),
  });
  const saved = await prisma.teamLines.upsert({
    where: { teamId },
    create: { teamId, system: clean as object },
    update: { system: clean as object },
    select: { system: true },
  });

  revalidatePath("/teams/[slug]/tactics", "page");
  return NextResponse.json({ ok: true, tactics: mergeTactics(saved.system as Partial<TeamTactics>) });
}
