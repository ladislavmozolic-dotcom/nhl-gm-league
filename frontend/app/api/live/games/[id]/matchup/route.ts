import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";
import { loadTeamLines } from "@/lib/sim/lines";

export const dynamic = "force-dynamic";

function formatShortName(fullName: string): string {
  const clean = cleanName(fullName);
  const parts = clean.split(" ");
  if (parts.length > 1) {
    const firstInitial = parts[0][0];
    const lastName = parts.slice(1).join(" ");
    return `${firstInitial}. ${lastName}`;
  }
  return clean;
}

async function getTeamMatchup(teamId: number, fallbackName: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, code: true, logoUrl: true, league: true },
  });

  const rosterType = team?.league === "AHL" ? "AHL" : "NHL";

  // Load eligible players for this team
  const rawPlayers = await prisma.player.findMany({
    where: {
      teamId,
      scratched: false,
      injuryDaysLeft: { lte: 0 },
      suspendedGames: { lte: 0 },
      rosterType: { in: [rosterType, "NHL", "AHL"] },
    },
    select: {
      id: true,
      name: true,
      number: true,
      position: true,
      isGoalie: true,
      overall: true,
    },
    orderBy: { overall: "desc" },
  });

  const playerMap = new Map(rawPlayers.map((p) => [p.id, p]));
  const forwards = rawPlayers.filter((p) => !p.isGoalie && !p.position?.toUpperCase().includes("D"));
  const defensemen = rawPlayers.filter((p) => !p.isGoalie && p.position?.toUpperCase().includes("D"));
  const goalies = rawPlayers.filter((p) => p.isGoalie);

  // Load GM lines from DB
  let linesData = null;
  try {
    linesData = await loadTeamLines(teamId);
  } catch (err) {
    console.error("Failed to load lines for team", teamId, err);
  }

  const forwardLines = [];
  const usedFwdIds = new Set<number>();

  for (let i = 0; i < 4; i++) {
    const fl = linesData?.forwardLines?.[i];

    // LW
    let lw = fl?.lw ? playerMap.get(fl.lw) : null;
    if (!lw || usedFwdIds.has(lw.id)) {
      lw = forwards.find((f) => !usedFwdIds.has(f.id)) || rawPlayers.find((p) => !p.isGoalie && !usedFwdIds.has(p.id));
    }
    if (lw) usedFwdIds.add(lw.id);

    // C
    let c = fl?.c ? playerMap.get(fl.c) : null;
    if (!c || usedFwdIds.has(c.id)) {
      c =
        forwards.find((f) => !usedFwdIds.has(f.id) && f.position?.toUpperCase().includes("C")) ||
        forwards.find((f) => !usedFwdIds.has(f.id)) ||
        rawPlayers.find((p) => !p.isGoalie && !usedFwdIds.has(p.id));
    }
    if (c) usedFwdIds.add(c.id);

    // RW
    let rw = fl?.rw ? playerMap.get(fl.rw) : null;
    if (!rw || usedFwdIds.has(rw.id)) {
      rw = forwards.find((f) => !usedFwdIds.has(f.id)) || rawPlayers.find((p) => !p.isGoalie && !usedFwdIds.has(p.id));
    }
    if (rw) usedFwdIds.add(rw.id);

    forwardLines.push({
      num: i + 1,
      lw: {
        name: lw ? formatShortName(lw.name) : `LW ${i + 1}`,
        num: String(lw?.number ?? (i * 3 + 10)),
      },
      c: {
        name: c ? formatShortName(c.name) : `C ${i + 1}`,
        num: String(c?.number ?? (i * 3 + 11)),
      },
      rw: {
        name: rw ? formatShortName(rw.name) : `RW ${i + 1}`,
        num: String(rw?.number ?? (i * 3 + 12)),
      },
    });
  }

  // Defense Pairs (up to 3)
  const usedDefIds = new Set<number>();
  const defensePairs = [];
  for (let i = 0; i < 3; i++) {
    const dp = linesData?.defensePairs?.[i];
    let ld = dp?.ld ? playerMap.get(dp.ld) : null;
    if (!ld || usedDefIds.has(ld.id)) {
      ld = defensemen.find((d) => !usedDefIds.has(d.id)) || rawPlayers.find((p) => !p.isGoalie && !usedFwdIds.has(p.id) && !usedDefIds.has(p.id));
    }
    if (ld) usedDefIds.add(ld.id);

    let rd = dp?.rd ? playerMap.get(dp.rd) : null;
    if (!rd || usedDefIds.has(rd.id)) {
      rd = defensemen.find((d) => !usedDefIds.has(d.id)) || rawPlayers.find((p) => !p.isGoalie && !usedFwdIds.has(p.id) && !usedDefIds.has(p.id));
    }
    if (rd) usedDefIds.add(rd.id);

    defensePairs.push({
      num: i + 1,
      ld: {
        name: ld ? formatShortName(ld.name) : `LD ${i + 1}`,
        num: String(ld?.number ?? (i * 2 + 4)),
      },
      rd: {
        name: rd ? formatShortName(rd.name) : `RD ${i + 1}`,
        num: String(rd?.number ?? (i * 2 + 5)),
      },
    });
  }

  const defense = defensePairs[0] || {
    ld: { name: "LD", num: "4" },
    rd: { name: "RD", num: "5" },
  };

  // Goalie
  const starterId = linesData?.situations?.others?.starter;
  let g = starterId ? playerMap.get(starterId) : null;
  if (!g) g = goalies[0] || rawPlayers.find((p) => p.isGoalie);

  const goalie = {
    name: g ? formatShortName(g.name) : "Brankár",
    num: String(g?.number ?? 30),
  };

  // Backup goalie
  const backupId = linesData?.situations?.others?.backup;
  let bg = backupId ? playerMap.get(backupId) : null;
  if (!bg) {
    bg = goalies.find((gl) => gl.id !== g?.id) || null;
  }
  const backup = {
    name: bg ? formatShortName(bg.name) : "Náhradník",
    num: String(bg?.number ?? (g?.number === 1 ? 30 : 1)),
  };

  // Extra attacker
  const extraFwd = forwards.find((f) => !usedFwdIds.has(f.id)) || forwards[0];
  const extra = {
    name: extraFwd ? formatShortName(extraFwd.name) : "Extra",
    num: String(extraFwd?.number ?? 91),
  };

  return {
    id: teamId,
    name: team?.name || fallbackName,
    code: team?.code || null,
    logoUrl: team?.logoUrl || null,
    forwardLines,
    defense,
    defensePairs,
    goalie,
    backup,
    extra,
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gameId = Number(id);
  const url = new URL(req.url);

  let homeTeamId = Number(url.searchParams.get("homeTeamId"));
  let awayTeamId = Number(url.searchParams.get("awayTeamId"));

  if (Number.isInteger(gameId)) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { homeTeamId: true, awayTeamId: true },
    });
    if (game) {
      if (!Number.isInteger(homeTeamId) || homeTeamId <= 0) homeTeamId = game.homeTeamId;
      if (!Number.isInteger(awayTeamId) || awayTeamId <= 0) awayTeamId = game.awayTeamId;
    }
  }

  if (!Number.isInteger(homeTeamId) || !Number.isInteger(awayTeamId) || homeTeamId <= 0 || awayTeamId <= 0) {
    return NextResponse.json({ error: "Invalid team ids" }, { status: 400 });
  }

  const [homeMatchup, awayMatchup] = await Promise.all([
    getTeamMatchup(homeTeamId, "Domáci"),
    getTeamMatchup(awayTeamId, "Hostia"),
  ]);

  return NextResponse.json(
    {
      home: homeMatchup,
      away: awayMatchup,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
