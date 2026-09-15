import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loadSettings } from "@/lib/sim/settings";
import { cleanName } from "@/lib/playerName";
import { BackPill } from "@/components/ui";
import BuyoutCalculator from "@/components/BuyoutCalculator";

export const dynamic = "force-dynamic";

export default async function BuyoutCalculatorPage() {
  if (!(await isAdmin())) redirect("/");

  const [settings, players, teams] = await Promise.all([
    loadSettings(),
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
    capHit: p.capHit ?? 0, contractYears: p.contractYears ?? 0, age: p.age ?? 27,
  }));

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Buyout Calculator</h1>
        <BackPill href="/tools">Tools</BackPill>
      </div>
      <p className="text-slate-400 text-sm mb-6">
        Admin-only. Uses the real NHL buyout rule (CBA Art. 50.5(b)): the club owes the player{" "}
        {settings.buyoutRealYoungPct}% of remaining salary if he&apos;s under {settings.buyoutRealAgeThreshold} at
        buyout time, {settings.buyoutRealOldPct}% if he&apos;s older — paid out (and counted against the cap) over
        2× the remaining contract years. Edit the age threshold and the two percentages below in{" "}
        <a href="/admin/simulation" className="underline hover:text-slate-300">Sim Settings</a> to test different
        conditions; this tool doesn&apos;t touch the live in-game buyout (which still uses its own simpler rule)
        unless you ask for that separately.
      </p>

      <BuyoutCalculator
        players={pickerPlayers}
        ageThreshold={settings.buyoutRealAgeThreshold}
        youngPct={settings.buyoutRealYoungPct}
        oldPct={settings.buyoutRealOldPct}
      />
    </div>
  );
}
