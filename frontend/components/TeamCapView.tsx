import Link from "next/link";
import PlayerLink from "@/components/PlayerLink";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { loadSettings } from "@/lib/sim/settings";
import { computeStandings } from "@/lib/sim/standings";
import {
  getArenaSections, selloutRevenue, computeTeamFinance, teamCapSummary, projectedPointsPct,
  playerCapYears, deadMoneyForYear, money, CURRENT_SEASON_START, seasonLabel,
  accruedCapSpace, SEASON_GAMES, ltirRelief, capCeilingForPhase,
} from "@/lib/finance";
import { getLeagueClock } from "@/lib/calendar-server";
import { getTeamSession } from "@/lib/auth";
import BuyoutButton from "@/components/BuyoutButton";
import { buyoutPlayer } from "@/app/finance/[slug]/actions";

const SEASON = "2026-27";
const SPAN = 8;
type CP = { id: number; name: string; position: string; age: number | null; isGoalie: boolean; capHit: number | null; contractYears: number | null; retainedSalary?: number | null };

/** Shared salary-cap / finance view for a team — used by /finance/[slug] and /teams/[slug]/salary. */
export default async function TeamCapView({ slug }: { slug: string }) {
  const team = await prisma.team.findUnique({
    where: { slug },
    select: {
      id: true, name: true, logoUrl: true, arena: true, popularity: true, arenaSections: true, capacity: true, bankAccount: true,
      players: { where: { rosterType: "NHL" }, select: { id: true, name: true, position: true, age: true, isGoalie: true, capHit: true, retainedSalary: true, contractYears: true, injuryDaysLeft: true, condition: true }, orderBy: [{ isGoalie: "asc" }, { capHit: "desc" }] },
      affiliateTeams: { select: { players: { where: { rosterType: "AHL" }, select: { id: true, name: true, position: true, age: true, isGoalie: true, capHit: true, contractYears: true }, orderBy: [{ isGoalie: "asc" }, { capHit: "desc" }] } } },
    },
  });
  if (!team) notFound();
  const farm = team.affiliateTeams[0]?.players ?? [];

  const [settings, session, buyouts, standings, homeGames, totalGames, gamesScheduled] = await Promise.all([
    loadSettings(), getTeamSession(),
    prisma.buyout.findMany({ where: { teamId: team.id }, select: { id: true, playerId: true, playerName: true, perYear: true, startYear: true, years: true, totalCost: true } }),
    computeStandings(SEASON, "NHL"),
    prisma.game.count({ where: { season: SEASON, league: "NHL", status: "FINAL", seriesId: null, homeTeamId: team.id } }),
    prisma.game.count({ where: { season: SEASON, league: "NHL", status: "FINAL", seriesId: null, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] } }),
    prisma.game.count({ where: { season: SEASON, league: "NHL", seriesId: null, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] } }),
  ]);
  const isGm = session === team.id;
  // The Buyout table doubles up: a real buyout debits the bank (totalCost > 0);
  // a trade-retention record (totalCost = 0) is dead cap only — the player is
  // gone from this roster, but this club still carries part of his cap hit.
  const realBuyouts = buyouts.filter((b) => b.totalCost > 0);
  const retentions = buyouts.filter((b) => b.totalCost === 0);
  const st = standings.find((s) => s.teamId === team.id);
  const fin = computeTeamFinance({
    popularity: team.popularity, pointsPct: projectedPointsPct(st),
    selloutRevenue: selloutRevenue(getArenaSections(team)),
    // real dollars this club owes — a retained acquisition only costs it the
    // post-retention share; the retaining club carries the rest.
    salary: team.players.reduce((s, p) => s + Math.max(0, (p.capHit ?? 0) - (p.retainedSalary ?? 0)), 0),
    homeGamesPlayed: homeGames, totalGamesPlayed: totalGames,
    startingBank: settings.startingCapital,
  });
  const years = Array.from({ length: SPAN }, (_, i) => CURRENT_SEASON_START + i);
  // Each player's own Cap Hit is shown net of any retention someone else pays
  // (see CapRows), so Total Salaries here is the sum of those same net numbers.
  // The rest of this club's own dead money splits into two lines matching the
  // tables below: real buyouts, and Dead Cap (salary it retains on players it
  // traded away) — kept apart since a retention isn't a buyout, but both still
  // count toward the Actual Cap Hit.
  const netPlayersForCap = team.players.map((p) => ({ capHit: Math.max(0, (p.capHit ?? 0) - (p.retainedSalary ?? 0)) }));
  const realBuyoutsDeadMoney = deadMoneyForYear(realBuyouts, CURRENT_SEASON_START);
  const deadCapAmount = deadMoneyForYear(retentions, CURRENT_SEASON_START);
  const cap = teamCapSummary(netPlayersForCap, settings, realBuyoutsDeadMoney + deadCapAmount);
  // Projected Cap Space = biggest full-season cap hit a club can still add and
  // stay legal — unused cap banks each game, so it grows toward the deadline.
  const accrued = accruedCapSpace(cap.capSpace, totalGames, gamesScheduled || 82);
  const maxCapHit = cap.capHit + accrued.actual; // Projected Cap Hit — max the club may carry for the rest
  // LTIR relief is based on what this club actually carries for the injured player
  // (net of any retention it benefits from), matching `cap.capHit` above.
  const ltirRoster = team.players.map((p) => ({ ...p, capHit: Math.max(0, (p.capHit ?? 0) - (p.retainedSalary ?? 0)) }));
  const ltir = ltirRelief(ltirRoster); // cap relief from skaters on LTIR (injured, CON < 90)
  const { phase } = await getLeagueClock();
  const effectiveCeiling = capCeilingForPhase(cap.upper, phase) + ltir;
  const overBy = Math.max(0, cap.capHit - effectiveCeiling);
  const cushioned = phase !== "regular" && phase !== "playoffs";

  const Badge = ({ s }: { s: "UFA" | "RFA" }) => (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${s === "UFA" ? "bg-red-600 text-white" : "bg-blue-600 text-white"}`}>{s}</span>
  );
  const FRow = ({ k, v, cls = "" }: { k: string; v: string; cls?: string }) => (
    <div className="flex justify-between px-4 py-2 border-b border-slate-800/60 text-sm"><span className="text-slate-400">{k}</span><span className={`tabular-nums ${cls}`}>{v}</span></div>
  );
  const CapRows = ({ list, gm }: { list: CP[]; gm: boolean }) => (
    <>{list.map((p) => {
      // A player this club acquired with retention only counts against it for
      // the post-retention share — the retaining club carries the rest (shown
      // on ITS page as Dead Cap, not repeated here).
      const netCapHit = Math.max(0, (p.capHit ?? 0) - (p.retainedSalary ?? 0));
      const cells = playerCapYears({ ...p, capHit: netCapHit }, CURRENT_SEASON_START, SPAN);
      return (
        <tr key={p.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
          <td className="px-3 py-1.5"><PlayerLink id={p.id} name={p.name} /></td>
          <td className="px-2 py-1.5 text-center text-slate-500 text-xs">{p.position}</td>
          <td className="px-2 py-1.5 text-center text-slate-400 tabular-nums">{p.age ?? "—"}</td>
          <td className="px-3 py-1.5 text-right tabular-nums font-medium">{netCapHit ? money(netCapHit) : "—"}</td>
          {cells.map((c, i) => <td key={i} className="px-3 py-1.5 text-right tabular-nums">{c.salary != null ? <span className="text-green-400">{money(c.salary)}</span> : c.status ? <Badge s={c.status} /> : ""}</td>)}
          {gm && <td className="px-2 py-1.5 text-right">{p.capHit && p.contractYears ? <BuyoutButton slug={slug} playerId={p.id} playerName={p.name} onBuyout={buyoutPlayer} /> : null}</td>}
        </tr>
      );
    })}</>
  );
  const Thead = ({ gm }: { gm: boolean }) => (
    <thead>
      <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-800/30">
        <th className="text-left px-3 py-2 font-medium">Player</th><th className="px-2 py-2 font-medium">Pos</th><th className="px-2 py-2 font-medium">Age</th><th className="text-right px-3 py-2 font-medium">Cap Hit</th>
        {years.map((y) => <th key={y} className="text-right px-3 py-2 whitespace-nowrap">{seasonLabel(y)}</th>)}
        {gm && <th />}
      </tr>
    </thead>
  );

  return (
    <div className="space-y-5">
      {/* header + cap summary */}
      <div className="flex flex-wrap items-center gap-6 bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 p-5">
        {team.logoUrl && <img src={team.logoUrl} alt="" className="w-16 h-16 object-contain" />}
        <div className="flex-1 min-w-[180px]">
          <h1 className="text-2xl font-bold">{team.name}</h1>
          <p className="text-sm text-slate-500">{team.arena} · popularity {team.popularity} · attendance {(fin.attendance * 100).toFixed(0)}%</p>
          {isGm && <Link href={`/teams/${slug}/finance`} className="text-xs text-blue-400 hover:underline">Ticket prices →</Link>}
        </div>
        <div className="text-sm grid grid-cols-2 gap-x-6 gap-y-1 tabular-nums">
          <span className="text-slate-400" title="Sum of each player's Cap Hit — already net of any retention someone else pays">Total Salaries</span><span className="text-right">{money(cap.totalSalaries)}</span>
          <span className="text-slate-400" title="Dead money from this club's own player buyouts">Buyouts</span><span className="text-right">{realBuyoutsDeadMoney ? money(realBuyoutsDeadMoney) : "—"}</span>
          <span className="text-slate-400" title="Salary this club retains on players it traded away (see Dead Cap below) — not a buyout, but still counts against its cap">Dead Cap</span><span className="text-right">{deadCapAmount ? money(deadCapAmount) : "—"}</span>
          <span className="text-slate-400" title="Total Salaries + Buyouts + Dead Cap">Actual Cap Hit</span><span className="text-right font-semibold">{money(cap.capHit)}</span>
          <span className="text-slate-400" title={`Ceiling ${money(cap.upper)} − Actual Cap Hit`}>Actual Cap Space</span><span className={`text-right font-semibold ${cap.capSpace < 0 ? "text-red-400" : "text-green-400"}`}>{money(cap.capSpace)}</span>
          <span className="text-slate-400" title="Max total cap hit you may carry for the rest of the season">Projected Cap Hit</span><span className="text-right tabular-nums text-slate-200">{money(maxCapHit)}</span>
          <span className="text-slate-400" title={`Biggest full-season cap hit you can still add and stay legal — unused cap banks each game (grows toward the deadline). ${accrued.played}/${gamesScheduled || 82} GP.`}>
            Projected Cap Space <span className="text-slate-600">({accrued.played}/{gamesScheduled || 82} GP)</span>
          </span>
          <span className={`text-right font-bold ${accrued.actual < 0 ? "text-red-400" : "text-emerald-400"}`}>{money(accrued.actual)}</span>
          {ltir > 0 && (<>
            <span className="text-slate-400" title="Long-Term Injured Reserve — cap hits of skaters injured below CON 90. You may exceed the cap by this much to replace them.">LTIR Relief</span>
            <span className="text-right font-semibold text-sky-300">+{money(ltir)}</span>
          </>)}
          <span className="text-slate-400" title={cushioned ? "Off-season: up to +10% over the cap allowed; must be compliant by opening day." : "Regular season: must stay under the ceiling (incl. LTIR relief)."}>Cap Status</span>
          <span className={`text-right font-bold ${overBy > 0 ? "text-red-400" : "text-green-400"}`}>
            {overBy > 0 ? `Over by ${money(overBy)}` : cushioned ? "OK · off-season" : "Compliant ✓"}
          </span>
          <span className="text-slate-400">Bank Account</span><span className="text-right text-amber-300 font-semibold">{money(team.bankAccount)}</span>
        </div>
      </div>

      {/* income / expenses */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-800/30 border-b border-slate-800 text-xs font-bold uppercase tracking-wide text-slate-400">Income (tickets)</div>
          <FRow k="Actual" v={money(fin.actualIncome)} /><FRow k="Projected" v={money(fin.projectedIncome)} cls="text-slate-400" />
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-800/30 border-b border-slate-800 text-xs font-bold uppercase tracking-wide text-slate-400">Expenses (salaries)</div>
          <FRow k="Actual" v={money(fin.actualExpenses)} /><FRow k="Projected" v={money(fin.projectedExpenses)} cls="text-slate-400" />
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-800/30 border-b border-slate-800 text-xs font-bold uppercase tracking-wide text-slate-400">Result</div>
          <FRow k="Projected result" v={money(fin.projectedResult)} cls={fin.projectedResult < 0 ? "text-red-400" : "text-green-400"} />
          <FRow k="Proj. bank" v={money(fin.projectedBankAccount)} cls="text-slate-400" />
        </div>
      </div>

      <div className="text-xs text-slate-500">▲ Upper limit: {money(cap.upper)} · ▼ Lower limit: {money(cap.lower)}</div>

      {/* NHL cap table */}
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">NHL Roster ({team.players.length})</h2>
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 overflow-x-auto -mt-2">
        <table className="w-full text-sm min-w-[960px]">
          <Thead gm={isGm} />
          <tbody>
            <CapRows list={team.players} gm={isGm} />
            {realBuyouts.map((b) => (
              <tr key={`b${b.id}`} className="border-b border-slate-800/60 bg-red-950/10">
                <td className="px-3 py-1.5 text-slate-400 italic">{b.playerName} <span className="text-[10px] text-red-400">(bought out)</span></td><td /><td />
                <td className="px-3 py-1.5 text-right text-red-300 tabular-nums">{money(b.perYear)}</td>
                {years.map((y, i) => <td key={i} className="px-3 py-1.5 text-right tabular-nums">{y >= b.startYear && y < b.startYear + b.years ? <span className="text-red-300">{money(b.perYear)}</span> : ""}</td>)}
                {isGm && <td />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dead cap — retained salary on players this club no longer rosters */}
      {retentions.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 overflow-x-auto -mt-2">
          <div className="px-4 py-2.5 bg-slate-800/30 border-b border-slate-800 text-xs font-bold uppercase tracking-wide text-slate-400">Dead Cap — salary retained on traded players</div>
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-800/30">
                <th className="text-left px-3 py-2 font-medium">Player</th>
                <th className="text-right px-3 py-2 font-medium">Retained</th>
                {years.map((y) => <th key={y} className="text-right px-3 py-2 whitespace-nowrap">{seasonLabel(y)}</th>)}
              </tr>
            </thead>
            <tbody>
              {retentions.map((r) => (
                <tr key={`r${r.id}`} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                  <td className="px-3 py-1.5">
                    {r.playerId ? <PlayerLink id={r.playerId} name={r.playerName} /> : <span className="italic text-slate-400">{r.playerName}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right text-amber-300 tabular-nums font-medium">{money(r.perYear)}</td>
                  {years.map((y, i) => <td key={i} className="px-3 py-1.5 text-right tabular-nums">{y >= r.startYear && y < r.startYear + r.years ? <span className="text-amber-300">{money(r.perYear)}</span> : ""}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Farm cap table */}
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Farm Roster ({farm.length})</h2>
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 overflow-x-auto -mt-2">
        <table className="w-full text-sm min-w-[960px]">
          <Thead gm={false} />
          <tbody>
            <CapRows list={farm} gm={false} />
            {farm.length === 0 && <tr><td colSpan={4 + SPAN} className="px-3 py-3 text-slate-600 text-sm">No farm roster.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
