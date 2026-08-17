import Link from "next/link";
import PlayerAvatar from "@/components/playerAvatar";
import { cleanName } from "@/lib/playerName";
import { Card, SectionTitle } from "@/components/ui";
import { posGroup, ratingColor, ovColor } from "@/lib/ratingBands";

// Cap hit from contractText ("6,500,000$ / 4yrs" → 6500000)
export function parseCapFromContract(contractText: string | null): number {
  if (!contractText) return 0;
  const nums = contractText.match(/[\d,]+/);
  return nums ? parseInt(nums[0].replace(/,/g, ""), 10) : 0;
}
export function salaryOf(p: any): number {
  return p.capHit || parseCapFromContract(p.contractText);
}
export function fmtM(v: number): string {
  return v > 0 ? `$${(v / 1_000_000).toFixed(2)}M` : "—";
}

export type Grouped = { forwards: any[]; defense: any[]; goalies: any[] };
export function groupRoster(players: any[]): Grouped {
  const isFwd = (p: any) => !p.isGoalie && (p.position?.includes("C") || p.position?.includes("W") || p.position?.includes("F"));
  const isDef = (p: any) => !p.isGoalie && !isFwd(p) && p.position?.includes("D");
  return {
    forwards: players.filter(isFwd),
    defense: players.filter(isDef),
    goalies: players.filter((p) => p.isGoalie).map((p) => ({ ...p, ...(p.goalieRating ?? {}) })),
  };
}

const SKATER_ATTRS = ["ck", "fg", "di", "sk", "st", "en", "du", "ph", "fo", "pa", "sc", "df", "ps", "ex", "ld", "mo"];
const GOALIE_ATTRS = ["sk", "du", "en", "sz", "ag", "rb", "sc", "hs", "rt", "ph", "ps", "ex", "ld", "mo"];

export function RosterSection({ title, players, accent, farm }: { title: string; players: any[]; accent?: string; farm?: boolean }) {
  const isGoalie = title === "Goalies";
  const attrs = isGoalie ? GOALIE_ATTRS : SKATER_ATTRS;

  return (
    <div>
      <SectionTitle count={players.length} accent={accent}>{title}</SectionTitle>
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase tracking-wider bg-slate-800/30">
                <th className="px-3 py-3 text-left font-medium sticky left-0 bg-slate-900 z-10 min-w-[160px]">Player</th>
                <th className="px-3 py-3 text-center font-medium whitespace-nowrap">Pos</th>
                <th className="px-3 py-3 text-center font-medium w-12">Age</th>
                {attrs.map((a) => <th key={a} className="px-2.5 py-3 text-center font-medium w-11">{a.toUpperCase()}</th>)}
                <th className="px-3 py-3 text-center font-medium w-12">OVR</th>
                <th className="px-4 py-3 text-right font-medium w-24">Salary</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const salary = salaryOf(player);
                const grp = isGoalie ? "G" as const : posGroup(player.position, false);
                return (
                  <tr key={player.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                    <td className="px-3 py-2 sticky left-0 bg-slate-900 z-10">
                      <div className="flex items-center gap-2">
                        <PlayerAvatar src={player.photoUrl} alt={player.name} size={32} />
                        <div className="min-w-0">
                          <Link href={`/players/${player.slug}`} className="font-medium text-sm hover:text-blue-400 transition-colors truncate block">{cleanName(player.name)}</Link>
                          {farm && player.affiliate && <p className="text-[10px] text-emerald-300/60">{player.affiliate.code || player.affiliate.name}</p>}
                          {(player.injuryDaysLeft ?? 0) > 0 && (
                            <p className="text-[10px] font-semibold text-red-400 flex items-center gap-1 whitespace-nowrap" title={player.injuryDesc || "Injured"}>
                              <span aria-hidden>🤕</span> IR · {player.injuryDaysLeft}d{player.injuryDesc ? ` · ${player.injuryDesc}` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-400 whitespace-nowrap">{player.position}</td>
                    <td className="px-3 py-2.5 text-center text-slate-400">{player.age || "—"}</td>
                    {attrs.map((a) => <td key={a} className={`px-2.5 py-2.5 text-center tabular-nums ${ratingColor(grp, a, player[a])}`}>{player[a] ?? "—"}</td>)}
                    <td className="px-2 py-2 text-center">
                      <span className={`font-bold ${ovColor(grp, player.overall)}`}>{player.overall || "—"}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <span className={`font-semibold tabular-nums ${salary > 0 ? "text-white" : "text-slate-600"}`}>{fmtM(salary)}</span>
                      {(() => {
                        // one uniform sub-line: just the term (cap is on the line above)
                        const yr = player.contractText?.match(/(\d+)\s*yr/i)?.[1];
                        return yr ? <p className="text-[10px] text-slate-500 tabular-nums">{yr} {yr === "1" ? "year" : "years"}</p> : null;
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/** Full NHL roster grouped into Forwards / Defensemen / Goalies. */
export function RosterTables({ players }: { players: any[] }) {
  const g = groupRoster(players);
  if (players.length === 0) return <Card><p className="text-slate-500 text-center py-8">No players on roster</p></Card>;
  return (
    <div className="space-y-6">
      {g.forwards.length > 0 && <RosterSection title="Forwards" players={g.forwards} />}
      {g.defense.length > 0 && <RosterSection title="Defensemen" players={g.defense} />}
      {g.goalies.length > 0 && <RosterSection title="Goalies" players={g.goalies} />}
    </div>
  );
}
