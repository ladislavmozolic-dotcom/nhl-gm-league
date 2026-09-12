import { loadSettings } from "@/lib/sim/settings";
import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { updateSalaryRetentionSettings } from "./actions";
import { prisma } from "@/lib/prisma";
import { CURRENT_SEASON_START, money } from "@/lib/finance";
import { cleanName } from "@/lib/playerName";
import RemoveRetentionButton from "@/components/RemoveRetentionButton";
import RetentionPctEditor from "@/components/RetentionPctEditor";

export const dynamic = "force-dynamic";

// A trade-retention record is a Buyout row with totalCost=0 (see lib/trade-exec.ts).
// "Active" = its contract term hasn't run out yet (CURRENT_SEASON_START within
// [startYear, startYear+years)) — an expired one is history, not a live cap hit.
async function loadActiveRetentions() {
  const records = (await prisma.buyout.findMany({ where: { totalCost: 0 }, orderBy: { createdAt: "desc" } }))
    .filter((r) => CURRENT_SEASON_START < r.startYear + r.years);

  const [teams, players] = await Promise.all([
    prisma.team.findMany({ select: { id: true, name: true, code: true } }),
    prisma.player.findMany({
      where: { id: { in: records.map((r) => r.playerId).filter((id): id is number => id != null) } },
      select: { id: true, name: true, teamId: true, capHit: true },
    }),
  ]);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const playerById = new Map(players.map((p) => [p.id, p]));

  // A player can (rarely) carry 2 stacked retentions — each one's % is against
  // the cap hit net of every OTHER active retention on him (matching how
  // lib/trade-exec.ts computes `netBefore` when a retention is first applied),
  // so we need every record grouped by player to work that out per row.
  const byPlayer = new Map<number, typeof records>();
  for (const r of records) {
    if (r.playerId == null) continue;
    const arr = byPlayer.get(r.playerId) ?? [];
    arr.push(r);
    byPlayer.set(r.playerId, arr);
  }

  return records.map((r) => {
    const player = r.playerId ? playerById.get(r.playerId) : null;
    const siblings = r.playerId ? (byPlayer.get(r.playerId) ?? []) : [];
    const otherTotal = siblings.filter((s) => s.id !== r.id).reduce((sum, s) => sum + s.perYear, 0);
    const netBefore = player ? Math.max(0, (player.capHit ?? 0) - otherTotal) : 0;
    const pct = netBefore > 0 ? Math.round((r.perYear / netBefore) * 1000) / 10 : 0;
    return {
      id: r.id,
      playerId: r.playerId,
      playerName: r.playerId ? cleanName(player?.name ?? r.playerName) : r.playerName,
      retainingTeam: teamById.get(r.teamId)?.name ?? "Unknown",
      currentTeam: r.playerId ? teamById.get(player?.teamId ?? -1)?.name ?? "—" : "—",
      perYear: r.perYear,
      pct,
      startYear: r.startYear,
      expiryYear: r.startYear + r.years,
    };
  });
}

export default async function SalaryRetentionAdminPage() {
  if (!(await isAdmin())) redirect("/");

  const [settings, activeRetentions] = await Promise.all([loadSettings(), loadActiveRetentions()]);

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Salary Retention Management</h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure rules for salary retention in trades, including team player limits and total cap percentage limits.
        </p>
      </div>

      <div className="bg-amber-950/40 border border-amber-800/50 rounded-xl p-4 text-sm text-amber-200">
        <b>⚠ Not wired up yet:</b> the value saves fine (e.g. setting Max Total Retention % to 20% works — nothing here
        caps it below 100%), but <code className="text-amber-100">retentionMaxPlayersIn</code>, <code className="text-amber-100">retentionMaxPlayersOut</code> and
        <code className="text-amber-100"> retentionMaxTotalPct</code> aren&apos;t read by the trade engine yet (checked in <code className="text-amber-100">lib/trade-exec.ts</code>) — only{" "}
        <b>Max % Retained on Single Contract</b> and the older single &quot;max retained players&quot; setting (Simulation Engine page) are actually enforced during a trade.
        Saving a number here won&apos;t change trade behavior until that enforcement is added.
      </div>

      <form action={updateSalaryRetentionSettings} className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Max Players IN with Retention
            </label>
            <input
              type="number"
              name="retentionMaxPlayersIn"
              defaultValue={settings.retentionMaxPlayersIn}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              min={0}
              max={10}
            />
            <p className="text-xs text-slate-500 mt-1">Maximum number of retained players a team can acquire.</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Max Players OUT with Retention
            </label>
            <input
              type="number"
              name="retentionMaxPlayersOut"
              defaultValue={settings.retentionMaxPlayersOut}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              min={0}
              max={10}
            />
            <p className="text-xs text-slate-500 mt-1">Maximum number of players a team can retain salary for.</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Max Total Retention % of Cap Hit
            </label>
            <input
              type="number"
              name="retentionMaxTotalPct"
              defaultValue={settings.retentionMaxTotalPct}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              min={1}
              max={100}
              step={0.5}
            />
            <p className="text-xs text-slate-500 mt-1">
              Maximum total active retained salary as a percentage of the team&apos;s Salary Cap (Default: 10%).
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Max % Retained on Single Contract
            </label>
            <input
              type="number"
              name="retentionMaxPct"
              defaultValue={settings.retentionMaxPct}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              min={1}
              max={50}
            />
            <p className="text-xs text-slate-500 mt-1">Maximum percentage of a single player&apos;s salary that can be retained (NHL standard: 50%).</p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            Save Retention Rules
          </button>
        </div>
      </form>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-black text-white">Active Retentions</h2>
          <p className="text-sm text-slate-400 mt-1">
            Every currently active trade retention across the league. Remove one if it&apos;s wrong — the acquiring club&apos;s cap hit is recalculated immediately.
          </p>
        </div>
        {activeRetentions.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">No club is currently retaining salary on anyone.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th className="py-2 pr-3">Player</th>
                  <th className="py-2 pr-3">Retained By</th>
                  <th className="py-2 pr-3">Now On</th>
                  <th className="py-2 pr-3">%</th>
                  <th className="py-2 pr-3">Per Year</th>
                  <th className="py-2 pr-3">Expires</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {activeRetentions.map((r) => (
                  <tr key={r.id} className="border-b border-slate-900">
                    <td className="py-2 pr-3 text-white font-semibold">{r.playerName}</td>
                    <td className="py-2 pr-3 text-slate-300">{r.retainingTeam}</td>
                    <td className="py-2 pr-3 text-slate-300">{r.currentTeam}</td>
                    <td className="py-2 pr-3 text-slate-300 tabular-nums">{r.pct}%</td>
                    <td className="py-2 pr-3 text-slate-300 tabular-nums">{money(r.perYear)}</td>
                    <td className="py-2 pr-3 text-slate-500">{r.expiryYear}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        {r.playerId != null && <RetentionPctEditor buyoutId={r.id} currentPct={r.pct} maxPct={settings.retentionMaxPct} />}
                        <RemoveRetentionButton buyoutId={r.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
