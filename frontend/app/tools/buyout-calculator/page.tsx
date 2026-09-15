import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loadSettings } from "@/lib/sim/settings";
import { getLeagueClock } from "@/lib/calendar-server";
import { cleanName } from "@/lib/playerName";
import { BackPill } from "@/components/ui";
import BuyoutCalculator from "@/components/BuyoutCalculator";

export const dynamic = "force-dynamic";

export default async function BuyoutCalculatorPage() {
  if (!(await isAdmin())) redirect("/");

  const [settings, clock, players, teams] = await Promise.all([
    loadSettings(),
    getLeagueClock(),
    prisma.player.findMany({
      where: { rosterType: "NHL", capHit: { gt: 0 }, contractYears: { gt: 0 } },
      select: { id: true, name: true, teamId: true, capHit: true, contractYears: true, age: true },
      orderBy: { capHit: "desc" },
    }),
    prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true } }),
  ]);
  const codeById = new Map(teams.map((t) => [t.id, t.code]));
  const pickerPlayers = players.map((p) => ({
    id: p.id, name: cleanName(p.name), teamCode: p.teamId ? codeById.get(p.teamId) ?? null : null,
    capHit: p.capHit ?? 0, contractYears: p.contractYears ?? 0, age: p.age,
  }));
  const inSeason = clock.phase === "regular" || clock.phase === "playoffs";

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Buyout Calculator</h1>
        <BackPill href="/tools">Tools</BackPill>
      </div>
      <p className="text-slate-400 text-sm mb-6">
        Admin-only preview of what buying a player out costs under our own league rules — not the real NHL&apos;s
        age-based formula. Dead-money cap hit is spread over 2× the remaining contract years at {settings.buyoutPctSeason}%
        of salary in-season, {settings.buyoutPctOffseason}% off-season (tunable in Sim Settings).
      </p>

      <BuyoutCalculator
        players={pickerPlayers}
        pctSeason={settings.buyoutPctSeason}
        pctOffseason={settings.buyoutPctOffseason}
        defaultInSeason={inSeason}
        currentPhase={clock.phaseLabel}
      />
    </div>
  );
}
