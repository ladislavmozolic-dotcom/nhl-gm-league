import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { getLeagueClock } from "@/lib/calendar-server";
import { cleanName } from "@/lib/playerName";
import { BackPill } from "@/components/ui";
import BuyoutCalculator from "@/components/BuyoutCalculator";

export const dynamic = "force-dynamic";

export default async function BuyoutCalculatorPage() {
  const [settings, clock, players, teams] = await Promise.all([
    loadSettings(),
    getLeagueClock(),
    prisma.player.findMany({
      where: { rosterType: "NHL", capHit: { gt: 0 }, contractYears: { gt: 0 } },
      select: { id: true, name: true, teamId: true, capHit: true, contractYears: true },
      orderBy: { capHit: "desc" },
    }),
    prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true } }),
  ]);
  const codeById = new Map(teams.map((t) => [t.id, t.code]));
  const pickerPlayers = players.map((p) => ({
    id: p.id, name: cleanName(p.name), teamCode: p.teamId ? codeById.get(p.teamId) ?? null : null,
    capHit: p.capHit ?? 0, contractYears: p.contractYears ?? 0,
  }));

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Buyout Calculator</h1>
        <BackPill href="/tools">Tools</BackPill>
      </div>
      <p className="text-slate-400 text-sm mb-6">
        Uses the same rules as the live Buy out button: {settings.buyoutPctOffseason}% of the annual cap hit in
        the off-season and preseason, or {settings.buyoutPctSeason}% during the regular season and playoffs.
        The charge becomes dead cap for twice the remaining contract length. No cash is deducted from the team bank.
      </p>

      <BuyoutCalculator
        players={pickerPlayers}
        offseasonPct={settings.buyoutPctOffseason}
        seasonPct={settings.buyoutPctSeason}
        currentPhase={clock.phase}
      />
    </div>
  );
}
