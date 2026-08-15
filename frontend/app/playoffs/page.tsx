import Link from "next/link";
import { getBracket, roundName, type BracketSeries } from "@/lib/sim/playoffs";
import { PageHeader } from "@/components/ui";

const SEASON = "2026-27";
export const dynamic = "force-dynamic";

export default async function PlayoffsPage({ searchParams }: { searchParams: Promise<{ league?: string; conf?: string }> }) {
  const sp = await searchParams;
  const league = sp.league === "AHL" ? "AHL" : "NHL";
  const bracket = await getBracket(SEASON, league);
  const title = league === "AHL" ? "Calder Cup Playoffs" : "Stanley Cup Playoffs";
  const toggle = (
    <Link href={`/playoffs${league === "AHL" ? "" : "?league=AHL"}`} className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm">
      {league === "AHL" ? "NHL" : "AHL"} playoffs
    </Link>
  );

  if (!bracket.length) {
    return (
      <div className="space-y-4 py-2">
        <PageHeader title={title} right={toggle} />
        <p className="text-slate-400">No {league} playoff bracket yet. Run the playoffs from Admin → Season Control.</p>
      </div>
    );
  }

  const confs = [...new Set(bracket.filter((s) => s.round <= 3).map((s) => s.conference).filter(Boolean))] as string[];
  const east = confs.find((c) => /east/i.test(c)) ?? confs[0] ?? null;
  const west = confs.find((c) => /west/i.test(c)) ?? confs.find((c) => c !== east) ?? null;
  const conf: "east" | "west" = sp.conf === "west" ? "west" : "east";
  const activeConf = conf === "west" ? west : east;

  const champ = bracket.find((s) => s.round === 4 && s.status === "DONE")?.winnerTeamId;
  const champTeam = champ ? bracket.find((s) => s.high.id === champ || s.low.id === champ) : null;
  const champInfo = champTeam ? (champTeam.high.id === champ ? champTeam.high : champTeam.low) : null;

  const confRounds = [...new Set(bracket.filter((s) => s.round <= 3 && s.conference === activeConf).map((s) => s.round))].sort((a, b) => a - b);
  const cupFinal = bracket.filter((s) => s.round === 4);
  const q = (c: "east" | "west") => `/playoffs?${league === "AHL" ? "league=AHL&" : ""}conf=${c}`;

  const ConfTab = ({ c, label, color }: { c: "east" | "west"; label: string; color: string }) => (
    <Link href={q(c)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${conf === c ? `${color} text-white` : "border border-slate-700 text-slate-400 hover:bg-slate-800"}`}>{label}</Link>
  );

  return (
    <div className="space-y-6 py-2">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <PageHeader title={title} subtitle={SEASON} />
          {toggle}
        </div>
        {champInfo && (
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2">
            <span className="text-2xl">🏆</span>
            {champInfo.logoUrl && <img src={champInfo.logoUrl} alt="" className="w-8 h-8 object-contain" />}
            <div><div className="text-[11px] uppercase tracking-wider text-amber-400">Champion</div>
              <div className="font-bold">{champInfo.name}</div></div>
          </div>
        )}
      </div>

      {/* conference switcher */}
      <div className="flex gap-2">
        <ConfTab c="east" label={east ? "Eastern Conference" : "Conference A"} color="bg-blue-600" />
        <ConfTab c="west" label={west ? "Western Conference" : "Conference B"} color="bg-red-600" />
      </div>

      {/* full-width bracket for the selected conference + Cup Final */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-stretch gap-4 min-w-max lg:min-w-full">
          {confRounds.map((r) => (
            <Column
              key={r}
              label={roundName(r).replace(/ Conference/i, "")}
              color={conf === "west" ? "text-red-400" : "text-blue-400"}
              series={bracket.filter((s) => s.round === r && s.conference === activeConf)}
            />
          ))}
          <Column label={`🏆 ${roundName(4)}`} color="text-amber-400" series={cupFinal} champion />
        </div>
      </div>
    </div>
  );
}

function Column({ label, color, series, champion }: { label: string; color: string; series: BracketSeries[]; champion?: boolean }) {
  return (
    <div className="flex-1 min-w-[240px] flex flex-col justify-around gap-4">
      <h3 className={`text-xs font-bold uppercase tracking-wider ${color} text-center`}>{label}</h3>
      {series.map((s) => <SeriesCard key={s.id} s={s} champion={champion} />)}
      {series.length === 0 && <div className="text-center text-slate-600 text-sm">—</div>}
    </div>
  );
}

function SeriesCard({ s, champion }: { s: BracketSeries; champion?: boolean }) {
  const need = Math.ceil(s.bestOf / 2);
  const Row = ({ team, seed, wins, isWinner }: { team: BracketSeries["high"]; seed: number; wins: number; isWinner: boolean }) => (
    <div className={`flex items-center gap-2.5 px-3.5 py-2.5 ${isWinner ? "bg-slate-800/60" : ""}`}>
      <span className="text-[11px] text-slate-500 w-4 text-center">{seed}</span>
      {team.logoUrl
        ? <img src={team.logoUrl} alt="" className="w-7 h-7 object-contain" />
        : <div className="w-7 h-7 rounded bg-slate-800" />}
      <Link href={`/teams/${team.slug}`} className={`flex-1 truncate text-sm ${isWinner ? "font-bold" : "text-slate-300"} hover:text-blue-400`}>{team.name}</Link>
      <span className={`tabular-nums text-base font-bold ${wins === need ? "text-green-400" : ""}`}>{wins}</span>
    </div>
  );
  const shrt = (t: BracketSeries["high"]) => t.code ?? t.name.slice(0, 3).toUpperCase();
  return (
    <div className={`bg-slate-900/50 border rounded-xl overflow-hidden divide-y divide-slate-800 ${champion ? "border-amber-500/50 ring-1 ring-amber-500/30" : "border-slate-800"}`}>
      <Row team={s.high} seed={s.highSeed} wins={s.highWins} isWinner={s.winnerTeamId === s.high.id} />
      <Row team={s.low} seed={s.lowSeed} wins={s.lowWins} isWinner={s.winnerTeamId === s.low.id} />
      {s.status !== "DONE" && s.games.length === 0 && <div className="px-3 py-1 text-[10px] text-slate-500 uppercase tracking-wide">In progress</div>}
      {s.games.length > 0 && (
        <div className="bg-slate-950/40 px-3 py-2 space-y-1">
          {s.games.map((g) => {
            const home = g.homeTeamId === s.high.id ? s.high : s.low;
            const away = g.awayTeamId === s.high.id ? s.high : s.low;
            const homeWon = g.homeGoals > g.awayGoals;
            const badge = g.otPeriods === 1 ? "OT" : g.otPeriods > 1 ? `${g.otPeriods}OT` : g.endedIn === "SO" ? "SO" : "";
            return (
              <Link key={g.id} href={`/games/${g.id}`} className="flex items-center gap-2 text-[11px] hover:text-blue-400">
                <span className="text-slate-600 w-6">G{g.gameNum}</span>
                <span className="flex-1 truncate text-slate-400">
                  {shrt(away)} <span className={`tabular-nums ${!homeWon ? "font-bold text-slate-100" : ""}`}>{g.awayGoals}</span>
                  <span className="text-slate-600"> @ </span>
                  {shrt(home)} <span className={`tabular-nums ${homeWon ? "font-bold text-slate-100" : ""}`}>{g.homeGoals}</span>
                </span>
                {badge && <span className={`font-bold ${g.otPeriods > 1 ? "text-amber-400" : "text-sky-400"}`}>{badge}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
