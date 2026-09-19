import Link from "next/link";
import PlayerLink from "@/components/PlayerLink";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { loadSettings } from "@/lib/sim/settings";
import { computeStandings } from "@/lib/sim/standings";
import {
  getArenaSections, selloutRevenue, computeTeamFinance, teamCapSummary, projectedPointsPct,
  playerCapYears, deadMoneyForYear, money, CURRENT_SEASON_START, seasonLabel,
  accruedCapSpace, onLtir, ltirRelief, capCeilingForPhase, farmSalaryExpense, liveCapHit,
  DEFAULT_PROJECTED_CAPS, buyoutTerms,
} from "@/lib/finance";
import { getLeagueClock, regularSeasonDayProgress } from "@/lib/calendar-server";
import { getTeamSession } from "@/lib/auth";
import { teamRetentionStatus } from "@/lib/cap";
import { ROSTER_LIMITS } from "@/lib/roster-rules";
import BuyoutButton from "@/components/BuyoutButton";
import { buyoutPlayer } from "@/app/finance/[slug]/actions";

const SEASON = "2026-27";
const SPAN = 5;
type CP = { id: number; name: string; position: string; age: number | null; birthDate?: string | Date | null; isGoalie: boolean; capHit: number | null; contractYears: number | null; contractType?: string | null; retainedSalary?: number | null; tradeClause?: string | null; noTradeTeams?: number[]; injuryDaysLeft?: number | null; condition?: number | null };
const CLAUSE_LABEL: Record<string, string> = { NTC: "NTC", NMC: "NMC", M_NTC: "M-NTC" };
const isD = (pos: string) => /(^|\/)D(\/|$)/.test(pos) || pos === "D";
/** capwages-style split: Forwards / Defense / Goalies as their own groups
 *  instead of one flat cap-hit-sorted list. */
const splitByPos = (list: CP[]) => ({
  forwards: list.filter((p) => !p.isGoalie && !isD(p.position)),
  defense: list.filter((p) => !p.isGoalie && isD(p.position)),
  goalies: list.filter((p) => p.isGoalie),
});

/** Shared salary-cap / finance view for a team — used by /finance/[slug] and /teams/[slug]/salary. */
export default async function TeamCapView({ slug }: { slug: string }) {
  const team = await prisma.team.findUnique({
    where: { slug },
    select: {
      id: true, name: true, code: true, logoUrl: true, arena: true, popularity: true, arenaSections: true, capacity: true, bankAccount: true,
      players: { where: { rosterType: "NHL" }, select: { id: true, name: true, position: true, age: true, birthDate: true, isGoalie: true, capHit: true, retainedSalary: true, contractType: true, contractYears: true, injuryDaysLeft: true, condition: true, tradeClause: true, noTradeTeams: true }, orderBy: [{ isGoalie: "asc" }, { capHit: "desc" }] },
      affiliateTeams: { select: { players: { where: { rosterType: "AHL" }, select: { id: true, name: true, position: true, age: true, birthDate: true, isGoalie: true, capHit: true, ahlSalary: true, contractType: true, contractYears: true, tradeClause: true, noTradeTeams: true }, orderBy: [{ isGoalie: "asc" }, { capHit: "desc" }] } } },
    },
  });
  if (!team) notFound();
  const farm = team.affiliateTeams[0]?.players ?? [];

  const [settings, session, buyouts, standings, homeGames, totalGames, retention, dayProgress, allTeams, capProjections] = await Promise.all([
    loadSettings(), getTeamSession(),
    prisma.buyout.findMany({ where: { teamId: team.id }, select: { id: true, playerId: true, playerName: true, perYear: true, startYear: true, years: true, totalCost: true } }),
    computeStandings(SEASON, "NHL"),
    prisma.game.count({ where: { season: SEASON, league: "NHL", status: "FINAL", seriesId: null, homeTeamId: team.id } }),
    prisma.game.count({ where: { season: SEASON, league: "NHL", status: "FINAL", seriesId: null, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] } }),
    teamRetentionStatus(team.id),
    regularSeasonDayProgress(),
    prisma.team.findMany({ select: { id: true, code: true } }),
    prisma.capProjection.findMany({ orderBy: { year: "asc" } }),
  ]);
  // For an M-NTC player's protected-teams tooltip.
  const teamCodeById = new Map(allTeams.map((t) => [t.id, t.code]));
  const isGm = session === team.id;
  // The Buyout table doubles up: a positive totalCost identifies a bought-out
  // contract; 0 identifies trade retention. Both are dead cap, never a cash fee.
  const realBuyouts = buyouts.filter((b) => b.totalCost > 0);
  const retentions = buyouts.filter((b) => b.totalCost === 0);
  const st = standings.find((s) => s.teamId === team.id);
  // Farm (AHL) contracts worth budgeting for drain the bank like NHL salaries do,
  // but never touch the NHL cap — kept entirely out of every cap figure below.
  const farmExpense = farmSalaryExpense(farm);
  const fin = computeTeamFinance({
    popularity: team.popularity, pointsPct: projectedPointsPct(st),
    selloutRevenue: selloutRevenue(getArenaSections(team)),
    // real dollars this club owes — a retained acquisition only costs it the
    // post-retention share; the retaining club carries the rest.
    salary: team.players.reduce((s, p) => s + Math.max(0, liveCapHit(p) - (p.retainedSalary ?? 0)), 0) + farmExpense,
    homeGamesPlayed: homeGames, totalGamesPlayed: totalGames,
    startingBank: settings.startingCapital,
  });
  const years = Array.from({ length: SPAN }, (_, i) => CURRENT_SEASON_START + i);

  // ---- Multi-year cap projection (same SPAN=5 as the roster tables) ----
  /** Sum of cap hits for players with a live contract in a given offset year (0 = current). */
  const nhlCapHitForYear = (offsetYear: number) =>
    team.players.reduce((s, p) => {
      const net = Math.max(0, liveCapHit(p) - (p.retainedSalary ?? 0));
      // Only count if the player still has contractYears covering that offset.
      const yearsLeft = (p.contractYears ?? 0) - offsetYear;
      return s + (yearsLeft > 0 ? net : 0);
    }, 0) +
    deadMoneyForYear(realBuyouts, CURRENT_SEASON_START + offsetYear) +
    deadMoneyForYear(retentions, CURRENT_SEASON_START + offsetYear);
  /** Count of NHL players still under contract in a given offset year. */
  const nhlContractsForYear = (offsetYear: number) =>
    team.players.filter((p) => (p.contractYears ?? 0) - offsetYear > 0).length;
  /** Count of all org players (NHL+AHL) still under contract. */
  const allContractsForYear = (offsetYear: number) =>
    team.players.filter((p) => (p.contractYears ?? 0) - offsetYear > 0).length +
    farm.filter((p) => (p.contractYears ?? 0) - offsetYear > 0).length;
  // Each player's own Cap Hit is shown net of any retention someone else pays
  // (see CapRows), so Total Salaries here is the sum of those same net numbers.
  // The rest of this club's own dead money splits into two lines matching the
  // tables below: real buyouts, and Dead Cap (salary it retains on players it
  // traded away) — kept apart since a retention isn't a buyout, but both still
  // count toward the Actual Cap Hit.
  const netPlayersForCap = team.players.map((p) => ({ capHit: Math.max(0, liveCapHit(p) - (p.retainedSalary ?? 0)) }));
  const realBuyoutsDeadMoney = deadMoneyForYear(realBuyouts, CURRENT_SEASON_START);
  const deadCapAmount = deadMoneyForYear(retentions, CURRENT_SEASON_START);
  const cap = teamCapSummary(netPlayersForCap, settings, realBuyoutsDeadMoney + deadCapAmount);
  // Projected Cap Space = biggest full-season cap hit a club can still add and
  // stay legal — unused cap banks each CALENDAR DAY (the real NHL mechanic,
  // same denominator for every club), so it grows toward the trade deadline.
  const accrued = accruedCapSpace(cap.capSpace, dayProgress.daysPlayed, dayProgress.daysTotal);
  const maxCapHit = cap.capHit + accrued.actual; // Projected Cap Hit — max the club may carry for the rest
  // LTIR relief is based on what this club actually carries for the injured player
  // (net of any retention it benefits from), matching `cap.capHit` above.
  const ltirRoster = team.players.map((p) => ({ ...p, capHit: Math.max(0, liveCapHit(p) - (p.retainedSalary ?? 0)) }));
  const ltir = ltirRelief(ltirRoster);
  const { phase } = await getLeagueClock();
  const effectiveCeiling = cap.upper + ltir;
  const phaseComplianceCeiling = capCeilingForPhase(cap.upper, phase) + ltir;
  const overBy = Math.max(0, cap.capHit - phaseComplianceCeiling);
  const cushioned = phase !== "regular" && phase !== "playoffs";
  const buyoutInSeason = !cushioned;
  const posCounts = splitByPos(team.players);
  const orgTotal = team.players.length + farm.length; // NHL + AHL, vs. ROSTER_LIMITS.orgMax

  const Badge = ({ s }: { s: "UFA" | "RFA" }) => (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${s === "UFA" ? "bg-red-600 text-white" : "bg-blue-600 text-white"}`}>{s}</span>
  );
  const TypeBadge = ({ type }: { type?: string | null }) => {
    if (type === "ONE_WAY") {
      return (
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/70 border border-emerald-800/60 text-emerald-300"
          title="One-way contract (full salary in NHL or AHL)"
        >
          1-way
        </span>
      );
    }
    if (type === "TWO_WAY") {
      return (
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-950/70 border border-indigo-800/60 text-indigo-300"
          title="Two-way contract (discounted salary when assigned to AHL)"
        >
          2-way
        </span>
      );
    }
    return <span className="text-slate-600 text-xs">—</span>;
  };
  const FRow = ({ k, v, cls = "", title }: { k: string; v: string; cls?: string; title?: string }) => (
    <div className="flex justify-between px-4 py-2 border-b border-slate-800/60 text-sm" title={title}><span className="text-slate-400">{k}</span><span className={`tabular-nums ${cls}`}>{v}</span></div>
  );
  const CapRows = ({ list, gm }: { list: CP[]; gm: boolean }) => (
    <>{list.map((p) => {
      // A player this club acquired with retention only counts against it for
      // the post-retention share — the retaining club carries the rest (shown
      // on ITS page as Dead Cap, not repeated here).
      // 0 once his contract has fully run out — his last capHit stays frozen on
      // the row for the year-by-year columns' benefit, but isn't a live salary
      // any more, so the standalone Cap Hit column shouldn't read as one either.
      const netCapHit = Math.max(0, liveCapHit(p) - (p.retainedSalary ?? 0));
      const cells = playerCapYears({ ...p, capHit: netCapHit }, CURRENT_SEASON_START, SPAN);
      const protectedTeams = p.tradeClause === "M_NTC" ? (p.noTradeTeams ?? []).map((id) => teamCodeById.get(id)).filter(Boolean).join(", ") : "";
      const isLtir = onLtir({ capHit: p.capHit, injuryDaysLeft: p.injuryDaysLeft, condition: p.condition, isGoalie: p.isGoalie });
      return (
        <tr key={p.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
          <td className="px-3 py-1.5 whitespace-nowrap sticky left-0 bg-slate-900 z-10">
            <div className="flex items-center gap-1.5">
              <PlayerLink id={p.id} name={p.name} />
              {isLtir && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 text-sky-300" title={`On LTIR (injured, CON < 90) — grants +${money(netCapHit)} relief for call-ups`}>
                  LTIR · +{money(netCapHit)}
                </span>
              )}
            </div>
          </td>
          <td className="px-2 py-1.5 text-center text-slate-500 text-xs whitespace-nowrap">{p.position}</td>
          <td className="px-2 py-1.5 text-center text-slate-400 tabular-nums whitespace-nowrap">{p.age ?? "—"}</td>
          <td className="px-2 py-1.5 text-center whitespace-nowrap"><TypeBadge type={p.contractType} /></td>
          <td className="px-2 py-1.5 text-center text-slate-400 tabular-nums whitespace-nowrap" title={protectedTeams ? `Protected against: ${protectedTeams}` : undefined}>
            {p.tradeClause ? (CLAUSE_LABEL[p.tradeClause] ?? p.tradeClause) : ""}
          </td>
          <td className="px-3 py-1.5 text-right tabular-nums font-medium text-xs whitespace-nowrap">{netCapHit ? money(netCapHit) : "—"}</td>
          {cells.map((c, i) => <td key={i} className="px-3 py-1.5 text-right tabular-nums text-xs whitespace-nowrap">{c.salary != null ? <span className="text-green-400">{money(c.salary)}</span> : c.status ? <Badge s={c.status} /> : ""}</td>)}
          {gm && (
            <td className="px-2 py-1.5 text-right whitespace-nowrap">
              {p.capHit && p.contractYears ? (
                <BuyoutButton
                  slug={slug} playerId={p.id} playerName={p.name} onBuyout={buyoutPlayer}
                  terms={buyoutTerms(p.capHit, p.contractYears, buyoutInSeason, settings)}
                />
              ) : null}
            </td>
          )}
        </tr>
      );
    })}</>
  );
  const Thead = ({ gm }: { gm: boolean }) => (
    <thead>
      <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-800/30">
        <th className="text-left px-3 py-2 font-medium whitespace-nowrap sticky left-0 bg-slate-900 z-10 min-w-[170px]">Player</th>
        <th className="px-2 py-2 font-medium text-center whitespace-nowrap">Pos</th>
        <th className="px-2 py-2 font-medium text-center whitespace-nowrap">Age</th>
        <th className="px-2 py-2 font-medium text-center whitespace-nowrap" title="Contract type: 1-way (full salary in AHL) or 2-way (reduced AHL salary)">Type</th>
        <th className="px-2 py-2 font-medium text-center whitespace-nowrap" title="Trade protection clause">Clause</th>
        <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Cap Hit</th>
        {years.map((y) => <th key={y} className="text-right px-3 py-2 whitespace-nowrap">{seasonLabel(y)}</th>)}
        {gm && <th className="whitespace-nowrap" />}
      </tr>
    </thead>
  );
  const groupCapHit = (list: CP[]) => list.reduce((s, p) => s + Math.max(0, liveCapHit(p) - (p.retainedSalary ?? 0)), 0);
  // capwages-style position group: its own header (name, count, subtotal) + table.
  const PosGroup = ({ title, list, gm }: { title: string; list: CP[]; gm: boolean }) => (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 overflow-x-auto">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/30 border-b border-slate-800">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{title} ({list.length})</span>
        <span className="text-xs text-slate-500 tabular-nums">{list.length > 0 ? money(groupCapHit(list)) : "—"}</span>
      </div>
      <table className="w-full text-sm min-w-[960px]">
        <Thead gm={gm} />
        <tbody>
          {list.length > 0 ? <CapRows list={list} gm={gm} /> : <tr><td colSpan={6 + SPAN + (gm ? 1 : 0)} className="px-3 py-3 text-slate-600 text-sm">None on this roster.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Link href={`/tools/cap-calculator?${new URLSearchParams({ ...(team.code ? { team: team.code } : {}), from: slug }).toString()}`}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600/20 hover:bg-sky-600/30 border border-sky-700/50 text-sky-300 transition-colors">
          Cap Calculator →
        </Link>
      </div>

      {/* header + cap summary */}
      <div className="flex flex-wrap items-center gap-6 bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 p-5">
        {team.logoUrl && <img src={team.logoUrl} alt="" className="w-16 h-16 object-contain" />}
        <div className="flex-1 min-w-[180px]">
          <h1 className="text-2xl font-bold">{team.name}</h1>
          <p className="text-sm text-slate-500">{team.arena} · popularity {team.popularity} · attendance {(fin.attendance * 100).toFixed(0)}%</p>
          {isGm && <Link href={`/teams/${slug}/finance`} className="text-xs text-blue-400 hover:underline">Ticket prices →</Link>}
        </div>
        <div className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 tabular-nums w-full lg:w-auto">
          {/* Left Column: Contracts & Organization */}
          <div className="space-y-1.5">
            <div className="flex justify-between gap-4"><span className="text-slate-400" title="NHL + AHL players in the organization, vs. the league's max org roster size">Roster Size</span><span className={`${orgTotal > ROSTER_LIMITS.orgMax ? "text-red-400 font-semibold" : ""}`}>{orgTotal}/{ROSTER_LIMITS.orgMax} <span className="text-slate-500 text-xs">({team.players.length} NHL · {farm.length} AHL)</span></span></div>
            <div className="flex justify-between gap-4"><span className="text-slate-400" title="Sum of each player's Cap Hit — already net of any retention someone else pays">Total Salaries</span><span className="text-right">{money(cap.totalSalaries)}</span></div>
            <div className="flex justify-between gap-4"><span className="text-slate-400" title="Dead cap from this club's bought-out contracts">Dead Cap — Buyouts</span><span className="text-right">{realBuyoutsDeadMoney ? money(realBuyoutsDeadMoney) : "—"}</span></div>
            <div className="flex justify-between gap-4"><span className="text-slate-400" title="Salary this club retains on players it traded away">Retained Salary</span><span className="text-right">{deadCapAmount ? money(deadCapAmount) : "—"}</span></div>
            <div className="flex justify-between gap-4"><span className="text-slate-400" title="Contracts retained on (out) + retained-salary players rostered (in) — one combined pool vs. the league's configured max per team">Retention Slots</span><span className={`text-right ${retention.slotsOutUsed + retention.slotsInUsed >= retention.slotsMax ? "text-red-400 font-semibold" : ""}`}>{retention.slotsOutUsed + retention.slotsInUsed}/{retention.slotsMax}</span></div>
            <div className="flex justify-between gap-4"><span className="text-slate-400" title="Dead Cap as a % of the cap ceiling vs. the league's configured max">Retention % of Cap</span><span className={`text-right ${retention.pctOfCap >= retention.pctMax ? "text-red-400 font-semibold" : ""}`}>{retention.pctOfCap.toFixed(1)}% <span className="text-slate-500">/ {retention.pctMax}%</span></span></div>
            <div className="flex justify-between gap-4"><span className="text-slate-400">Bank Account</span><span className="text-right text-amber-300 font-semibold">{money(team.bankAccount)}</span></div>
          </div>

          {/* Right Column: Salary Cap & Room */}
          <div className="space-y-1.5">
            <div className="flex justify-between gap-4"><span className="text-slate-400" title="Total Salaries + Buyout Dead Cap + Retained Salary">Actual Cap Hit</span><span className="text-right font-semibold">{money(cap.capHit)}</span></div>
            <div className="flex justify-between gap-4"><span className="text-slate-400" title="Salary cap upper limit / ceiling">Upper Limit (Base)</span><span className="text-right tabular-nums text-slate-200">{money(cap.upper)}</span></div>
            {ltir > 0 && (
              <>
                <div className="flex justify-between gap-4"><span className="text-slate-400" title="Long-Term Injured Reserve relief pool from injured skaters (CON < 90)">LTIR Relief</span><span className="text-right font-semibold text-sky-300">+{money(ltir)}</span></div>
                <div className="flex justify-between gap-4"><span className="text-slate-400" title="Maximum allowed cap hit including LTIR Relief (Upper Limit + LTIR Relief)">Effective Ceiling</span><span className="text-right font-semibold text-sky-200">{money(effectiveCeiling)}</span></div>
                <div className="flex justify-between gap-4 bg-emerald-950/40 px-2 py-0.5 -mx-2 rounded border border-emerald-800/40">
                  <span className="text-emerald-300 font-medium" title="Real available space to call up players from AHL or add salaries (Effective Ceiling − Actual Cap Hit)">Available Cap (with LTIR)</span>
                  <span className={`text-right font-bold ${effectiveCeiling - cap.capHit < 0 ? "text-red-400" : "text-emerald-400"}`}>{money(effectiveCeiling - cap.capHit)}</span>
                </div>
                <div className="flex justify-between gap-4"><span className="text-slate-400 text-xs" title={`Base Ceiling ${money(cap.upper)} − Actual Cap Hit (without LTIR)`}>Base Space (excl. LTIR)</span><span className={`text-right text-xs ${cap.capSpace < 0 ? "text-red-400" : "text-slate-300"}`}>{money(cap.capSpace)}</span></div>
              </>
            )}
            {ltir === 0 && (
              <div className="flex justify-between gap-4"><span className="text-slate-400" title={`Ceiling ${money(cap.upper)} − Actual Cap Hit`}>Actual Cap Space</span><span className={`text-right font-semibold ${cap.capSpace < 0 ? "text-red-400" : "text-green-400"}`}>{money(cap.capSpace)}</span></div>
            )}
            <div className="flex justify-between gap-4"><span className="text-slate-400" title="Projected Cap Space">Projected Cap Space</span><span className={`text-right font-bold ${accrued.actual < 0 ? "text-red-400" : "text-emerald-400"}`}>{money(accrued.actual)}</span></div>
            <div className="flex justify-between gap-4"><span className="text-slate-400">Cap Status</span><span className={`text-right font-bold ${overBy > 0 ? "text-red-400" : ltir > 0 ? "text-sky-300" : "text-green-400"}`}>{overBy > 0 ? `Over by ${money(overBy)}` : ltir > 0 ? "Compliant (LTIR) ✓" : cushioned ? "OK · off-season" : "Compliant ✓"}</span></div>
          </div>
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
          <FRow k="of which Farm (AHL)" v={farmExpense ? money(farmExpense) : "—"} cls="text-slate-500" title="Farm contracts over $100K — drains the bank like an NHL salary, but never counts against the NHL cap" />
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-800/30 border-b border-slate-800 text-xs font-bold uppercase tracking-wide text-slate-400">Result</div>
          <FRow k="Projected result" v={money(fin.projectedResult)} cls={fin.projectedResult < 0 ? "text-red-400" : "text-green-400"} />
          <FRow k="Proj. bank" v={money(fin.projectedBankAccount)} cls="text-slate-400" />
        </div>
      </div>

      <div className="text-xs text-slate-500">▲ Upper limit: {money(cap.upper)} · ▼ Lower limit: {money(cap.lower)}</div>

      {/* ── Multi-year Cap Projection ── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 overflow-x-auto">
        <div className="px-4 py-2.5 bg-slate-800/30 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Cap Projection</span>
          <span className="text-xs text-slate-500">Future seasons — based on current contracts &amp; projected cap limits</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-800/30">
              <th className="text-left px-4 py-2.5 font-medium w-52">Season</th>
              {years.map((y) => {
                const proj = capProjections.find((p) => p.year === y);
                const note = proj?.note ?? DEFAULT_PROJECTED_CAPS[y]?.note;
                return (
                  <th key={y} className={`text-center px-3 py-2.5 whitespace-nowrap font-medium ${y === CURRENT_SEASON_START ? "text-blue-400" : ""}`}>
                    <div>{seasonLabel(y)}</div>
                    {note && (
                      <div className={`text-[9px] font-normal mt-0.5 ${note.toLowerCase().includes("confirm") ? "text-emerald-500" : "text-slate-600"}`}>
                        {note}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {/* Row 1: Projected Upper Limit */}
            <tr className="hover:bg-slate-800/20">
              <td className="px-4 py-2 text-slate-400 text-xs font-medium whitespace-nowrap" title="Salary cap ceiling for this season — set by admin in Cap Projection settings">
                Projected Upper Limit
              </td>
              {years.map((y) => {
                const proj = capProjections.find((p) => p.year === y);
                const upper = proj?.upperLimit ?? DEFAULT_PROJECTED_CAPS[y]?.upper ?? cap.upper;
                const isCustom = proj != null || DEFAULT_PROJECTED_CAPS[y] != null;
                return (
                  <td key={y} className={`px-3 py-2 text-center tabular-nums text-xs ${isCustom ? "text-sky-300" : "text-slate-300"}`}>
                    {money(upper)}
                  </td>
                );
              })}
            </tr>
            {/* Row 2: NHL Cap Hit */}
            <tr className="hover:bg-slate-800/20">
              <td className="px-4 py-2 text-slate-400 text-xs font-medium whitespace-nowrap" title="Total NHL roster cap hit + dead money (buyouts / retained salary) for that season">
                NHL Cap Hit
              </td>
              {years.map((y, i) => {
                const proj = capProjections.find((p) => p.year === y);
                const upper = proj?.upperLimit ?? DEFAULT_PROJECTED_CAPS[y]?.upper ?? cap.upper;
                const hit = nhlCapHitForYear(i);
                const over = hit > upper;
                return (
                  <td key={y} className={`px-3 py-2 text-center tabular-nums text-xs font-semibold ${over ? "text-red-400" : i === 0 ? "text-slate-100" : "text-slate-300"}`}>
                    {money(hit)}
                  </td>
                );
              })}
            </tr>
            {/* Row 3: NHL Cap Space */}
            <tr className="hover:bg-slate-800/20">
              <td className="px-4 py-2 text-slate-400 text-xs font-medium whitespace-nowrap" title="Upper Limit minus NHL Cap Hit — how much room remains to add players">
                NHL Cap Space
              </td>
              {years.map((y, i) => {
                const proj = capProjections.find((p) => p.year === y);
                const upper = proj?.upperLimit ?? DEFAULT_PROJECTED_CAPS[y]?.upper ?? cap.upper;
                const space = upper - nhlCapHitForYear(i);
                return (
                  <td key={y} className={`px-3 py-2 text-center tabular-nums text-xs font-bold ${space < 0 ? "text-red-400" : space > 10_000_000 ? "text-emerald-400" : "text-green-300"}`}>
                    {money(space)}
                  </td>
                );
              })}
            </tr>
            {/* Row 4: NHL Roster Contracts */}
            <tr className="hover:bg-slate-800/20">
              <td className="px-4 py-2 text-slate-400 text-xs font-medium whitespace-nowrap" title="Number of NHL players under contract / max active NHL roster size (23)">
                NHL Roster Contracts
              </td>
              {years.map((y, i) => {
                const count = nhlContractsForYear(i);
                const over = count > ROSTER_LIMITS.proMax;
                return (
                  <td key={y} className={`px-3 py-2 text-center tabular-nums text-xs ${over ? "text-red-400 font-bold" : "text-slate-300"}`}>
                    <span className={over ? "text-red-400" : "text-slate-200"}>{count}</span>
                    <span className="text-slate-600">/{ROSTER_LIMITS.proMax}</span>
                  </td>
                );
              })}
            </tr>
            {/* Row 5: All Contracts (NHL + AHL) */}
            <tr className="hover:bg-slate-800/20">
              <td className="px-4 py-2 text-slate-400 text-xs font-medium whitespace-nowrap" title="Total contracts in the organization (NHL + AHL) / max org roster size (55)">
                All Contracts
              </td>
              {years.map((y, i) => {
                const count = allContractsForYear(i);
                const over = count > ROSTER_LIMITS.orgMax;
                return (
                  <td key={y} className={`px-3 py-2 text-center tabular-nums text-xs ${over ? "text-red-400 font-bold" : "text-slate-300"}`}>
                    <span className={over ? "text-red-400" : "text-slate-200"}>{count}</span>
                    <span className="text-slate-600">/{ROSTER_LIMITS.orgMax}</span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>


      {/* NHL cap table — split by position, capwages-style */}
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">NHL Roster ({team.players.length})</h2>
      <div className="space-y-4 -mt-2">
        <PosGroup title="Forwards" list={posCounts.forwards} gm={isGm} />
        <PosGroup title="Defense" list={posCounts.defense} gm={isGm} />
        <PosGroup title="Goalies" list={posCounts.goalies} gm={isGm} />
      </div>

      {/* Dead cap from this club's own bought-out contracts */}
      {realBuyouts.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 overflow-x-auto">
          <div className="px-4 py-2.5 bg-slate-800/30 border-b border-slate-800 text-xs font-bold uppercase tracking-wide text-slate-400">Dead Cap — bought-out contracts</div>
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-800/30">
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap sticky left-0 bg-slate-900 z-10 min-w-[170px]">Player</th>
                <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Cap Hit</th>
                {years.map((y) => <th key={y} className="text-right px-3 py-2 whitespace-nowrap">{seasonLabel(y)}</th>)}
              </tr>
            </thead>
            <tbody>
              {realBuyouts.map((b) => (
                <tr key={`b${b.id}`} className="border-b border-slate-800/60 bg-red-950/10">
                  <td className="px-3 py-1.5 text-slate-400 italic whitespace-nowrap sticky left-0 bg-slate-900 z-10">{b.playerId ? <PlayerLink id={b.playerId} name={b.playerName} /> : b.playerName} <span className="text-[10px] text-red-400">(bought out)</span></td>
                  <td className="px-3 py-1.5 text-right text-red-300 tabular-nums whitespace-nowrap">{money(b.perYear)}</td>
                  {years.map((y, i) => <td key={i} className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{y >= b.startYear && y < b.startYear + b.years ? <span className="text-red-300">{money(b.perYear)}</span> : ""}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Retained salary on players this club no longer rosters */}
      {retentions.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 overflow-x-auto -mt-2">
          <div className="px-4 py-2.5 bg-slate-800/30 border-b border-slate-800 text-xs font-bold uppercase tracking-wide text-slate-400 flex items-center justify-between">
            <span>Retained Salary — traded players</span>
            <span className={`normal-case font-normal ${retention.slotsOutUsed + retention.slotsInUsed >= retention.slotsMax || retention.pctOfCap >= retention.pctMax ? "text-red-400" : "text-slate-500"}`}>
              {retention.slotsOutUsed + retention.slotsInUsed}/{retention.slotsMax} slots · {retention.pctOfCap.toFixed(1)}/{retention.pctMax}% of cap
            </span>
          </div>
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-800/30">
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap sticky left-0 bg-slate-900 z-10 min-w-[170px]">Player</th>
                <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Retained</th>
                {years.map((y) => <th key={y} className="text-right px-3 py-2 whitespace-nowrap">{seasonLabel(y)}</th>)}
              </tr>
            </thead>
            <tbody>
              {retentions.map((r) => (
                <tr key={`r${r.id}`} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                  <td className="px-3 py-1.5 whitespace-nowrap sticky left-0 bg-slate-900 z-10">
                    {r.playerId ? <PlayerLink id={r.playerId} name={r.playerName} /> : <span className="italic text-slate-400">{r.playerName}</span>}
                  </td>
                  <td
                    className="px-3 py-1.5 text-right tabular-nums font-medium whitespace-nowrap"
                    // A little running gag for the Edmonton GM — everything else in
                    // this column is plain white, his "Retained" figure gets a
                    // temporary pride-flag gradient instead.
                    style={team.code === "EDM" ? { background: "linear-gradient(90deg,#e40303,#ff8c00,#ffed00,#008026,#004dff,#750787)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : undefined}
                  >
                    {money(r.perYear)}
                  </td>
                  {years.map((y, i) => <td key={i} className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{y >= r.startYear && y < r.startYear + r.years ? <span className="text-red-400">{money(r.perYear)}</span> : ""}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Farm cap table — same position split */}
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Farm Roster ({farm.length})</h2>
      {(() => {
        const g = splitByPos(farm);
        return (
          <div className="space-y-4 -mt-2">
            <PosGroup title="Forwards" list={g.forwards} gm={false} />
            <PosGroup title="Defense" list={g.defense} gm={false} />
            <PosGroup title="Goalies" list={g.goalies} gm={false} />
          </div>
        );
      })()}
    </div>
  );
}
