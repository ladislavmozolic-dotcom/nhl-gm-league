import Link from "next/link";

type GameSel = {
  id: number; gameDate: Date | null; homeTeamId: number; awayTeamId: number;
  homeGoals: number | null; awayGoals: number | null;
  homeTeam: { code: string | null }; awayTeam: { code: string | null };
};
type SkRow = { teamId: number; goals: number; assists: number; points: number; shots: number; pim: number; plusMinus: number; hits: number; blocks: number; toi: number; game: GameSel };
type GlRow = { shotsAgainst: number; saves: number; goalsAgainst: number; decision: string | null; game: GameSel };

const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "—");
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Game-by-game NHL log for a player. Skaters get scoring lines, goalies get W/L + SV%. */
export default function PlayerGameLog({ isGoalie, skater, goalie }: { isGoalie: boolean; skater: SkRow[]; goalie: GlRow[] }) {
  const rows = isGoalie ? goalie : skater;
  if (!rows.length) return <p className="py-8 text-center text-slate-500">No NHL games played yet.</p>;

  const matchup = (g: GameSel, myTeamId: number) => {
    const home = myTeamId === g.homeTeamId;
    const oppCode = (home ? g.awayTeam.code : g.homeTeam.code) ?? "—";
    const mine = home ? g.homeGoals : g.awayGoals;
    const theirs = home ? g.awayGoals : g.homeGoals;
    const win = (mine ?? 0) > (theirs ?? 0);
    return { label: `${home ? "vs" : "@"} ${oppCode}`, score: `${mine ?? 0}-${theirs ?? 0}`, win };
  };

  const th = "px-2.5 py-2 text-center font-medium";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase tracking-wider bg-slate-800/30">
            <th className="px-3 py-2 text-left font-medium">Date</th>
            <th className="px-3 py-2 text-left font-medium">Opponent</th>
            <th className={th}>Result</th>
            {isGoalie
              ? <>{["Dec", "SA", "SV", "GA", "SV%"].map((c) => <th key={c} className={th}>{c}</th>)}</>
              : <>{["G", "A", "P", "+/-", "S", "PIM", "HIT", "BLK", "TOI"].map((c) => <th key={c} className={th}>{c}</th>)}</>}
          </tr>
        </thead>
        <tbody>
          {isGoalie ? goalie.map((r, i) => {
            // goalie's team: he allowed `goalsAgainst`, which equals the opponent's goals
            const g = r.game;
            const home = r.goalsAgainst === (g.awayGoals ?? -1);
            const m = matchup(g, home ? g.homeTeamId : g.awayTeamId);
            const svp = r.shotsAgainst ? (r.saves / r.shotsAgainst) : 0;
            return (
              <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                <td className="px-3 py-1.5 text-slate-400">{fmtDate(g.gameDate)}</td>
                <td className="px-3 py-1.5"><Link href={`/games/${g.id}`} className="hover:text-blue-400">{m.label}</Link></td>
                <td className={`px-2.5 py-1.5 text-center font-semibold ${m.win ? "text-green-400" : "text-red-400"}`}>{m.win ? "W" : "L"} {m.score}</td>
                <td className="px-2.5 py-1.5 text-center">{r.decision ?? "—"}</td>
                <td className="px-2.5 py-1.5 text-center tabular-nums">{r.shotsAgainst}</td>
                <td className="px-2.5 py-1.5 text-center tabular-nums">{r.saves}</td>
                <td className="px-2.5 py-1.5 text-center tabular-nums">{r.goalsAgainst}</td>
                <td className="px-2.5 py-1.5 text-center tabular-nums">{svp.toFixed(3).replace(/^0/, "")}</td>
              </tr>
            );
          }) : skater.map((r, i) => {
            const m = matchup(r.game, r.teamId);
            return (
              <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                <td className="px-3 py-1.5 text-slate-400">{fmtDate(r.game.gameDate)}</td>
                <td className="px-3 py-1.5"><Link href={`/games/${r.game.id}`} className="hover:text-blue-400">{m.label}</Link></td>
                <td className={`px-2.5 py-1.5 text-center font-semibold ${m.win ? "text-green-400" : "text-red-400"}`}>{m.win ? "W" : "L"} {m.score}</td>
                <td className="px-2.5 py-1.5 text-center tabular-nums font-semibold text-white">{r.goals}</td>
                <td className="px-2.5 py-1.5 text-center tabular-nums">{r.assists}</td>
                <td className="px-2.5 py-1.5 text-center tabular-nums font-semibold">{r.points}</td>
                <td className={`px-2.5 py-1.5 text-center tabular-nums ${r.plusMinus > 0 ? "text-green-400" : r.plusMinus < 0 ? "text-red-400" : "text-slate-400"}`}>{r.plusMinus > 0 ? `+${r.plusMinus}` : r.plusMinus}</td>
                <td className="px-2.5 py-1.5 text-center tabular-nums">{r.shots}</td>
                <td className="px-2.5 py-1.5 text-center tabular-nums">{r.pim}</td>
                <td className="px-2.5 py-1.5 text-center tabular-nums">{r.hits}</td>
                <td className="px-2.5 py-1.5 text-center tabular-nums">{r.blocks}</td>
                <td className="px-2.5 py-1.5 text-center tabular-nums text-slate-400">{mmss(r.toi)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
