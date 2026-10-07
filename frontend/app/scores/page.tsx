import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import PhaseTabs from "@/components/PhaseTabs";
import { seasonForPhase, normalizePhase } from "@/lib/phase";
import { defaultStatsPhase } from "@/lib/calendar-server";
import { computeStandings } from "@/lib/sim/standings";
import { cleanName } from "@/lib/playerName";
import { getLang } from "@/lib/lang-server";
import type { Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const localeOf = (lang: Lang) => (lang === "cs" ? "sk-SK" : lang === "de" ? "de-DE" : lang === "ru" ? "ru-RU" : "en-US");
const tr = (lang: Lang, en: string, cs: string) => (lang === "cs" ? cs : en);
const gamesWord = (lang: Lang, n: number) =>
  lang === "cs" ? (n === 1 ? "zápas" : n > 1 && n < 5 ? "zápasy" : "zápasov") : n === 1 ? "game" : "games";
const pretty = (d: Date, lang: Lang) =>
  d.toLocaleDateString(localeOf(lang), { weekday: "long", day: "numeric", month: "long", year: "numeric" });

type GoalItem = {
  id: number;
  teamId: number;
  teamCode: string | null;
  scorerName: string;
  period: number;
  strength: string;
  emptyNet: boolean;
};

type GameRow = {
  id: number;
  league: string;
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homeShots: number | null;
  awayShots: number | null;
  homeGoalsByPeriod: number[];
  awayGoalsByPeriod: number[];
  endedIn: string | null;
  attendance: number | null;
  eventTitle: string | null;
  eventVenue: string | null;
  homeTeam: { id: number; name: string; code: string | null; logoUrl: string | null; slug: string; arena: string | null };
  awayTeam: { id: number; name: string; code: string | null; logoUrl: string | null; slug: string };
  goalEvents: GoalItem[];
};

function formatGoalScorers(goals: GoalItem[], teamId: number) {
  const teamGoals = goals.filter((g) => g.teamId === teamId);
  if (teamGoals.length === 0) return null;
  const countMap = new Map<string, { count: number; emptyNet: boolean }>();
  for (const g of teamGoals) {
    const name = cleanName(g.scorerName);
    const cur = countMap.get(name) ?? { count: 0, emptyNet: false };
    cur.count += 1;
    if (g.emptyNet) cur.emptyNet = true;
    countMap.set(name, cur);
  }
  const parts: string[] = [];
  for (const [name, info] of countMap.entries()) {
    let s = name;
    if (info.count > 1) s += ` (${info.count})`;
    if (info.emptyNet) s += ` [ENG]`;
    parts.push(s);
  }
  return parts.join(", ");
}

function formatPeriods(homeByPeriod: number[], awayByPeriod: number[], endedIn: string | null) {
  if (!homeByPeriod || !awayByPeriod || homeByPeriod.length === 0 || awayByPeriod.length === 0) {
    return null;
  }
  const len = Math.min(homeByPeriod.length, awayByPeriod.length);
  const parts: string[] = [];
  for (let i = 0; i < Math.min(3, len); i++) {
    parts.push(`${awayByPeriod[i]}:${homeByPeriod[i]}`);
  }
  let str = parts.join(", ");
  if (endedIn === "OT") str += " (OT)";
  if (endedIn === "SO") str += " (SO)";
  return str;
}

function FeaturedGameHero({
  g,
  homeRecord,
  awayRecord,
  lang,
}: {
  g: GameRow;
  lang: Lang;
  homeRecord?: string | null;
  awayRecord?: string | null;
}) {
  const isFinal = g.status === "FINAL";
  const hw = isFinal && (g.homeGoals ?? 0) > (g.awayGoals ?? 0);
  const aw = isFinal && (g.awayGoals ?? 0) > (g.homeGoals ?? 0);
  const periodsStr = formatPeriods(g.homeGoalsByPeriod, g.awayGoalsByPeriod, g.endedIn);
  const awayScorers = formatGoalScorers(g.goalEvents, g.awayTeam.id);
  const homeScorers = formatGoalScorers(g.goalEvents, g.homeTeam.id);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c162d] via-[#0b1120] to-[#070b12] border-2 border-blue-500/40 p-5 sm:p-7 shadow-2xl mb-8">
      <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
              <span>🔥</span> {tr(lang, "GAME OF THE DAY", "ŠLÁGER DŇA")}
            </span>
            <span className="text-xs text-slate-400">
              {g.eventTitle || g.eventVenue || g.homeTeam.arena || tr(lang, "Arena", "Aréna")}
              {g.attendance ? ` · ${g.attendance.toLocaleString(localeOf(lang))} ${tr(lang, "fans", "divákov")}` : ""}
            </span>
          </div>
          <div>
            {isFinal ? (
              g.endedIn === "OT" ? (
                <span className="px-3 py-1 rounded-lg text-xs font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {tr(lang, "FINAL (OT)", "KONIEC (PO PREDĹŽENÍ)")}
                </span>
              ) : g.endedIn === "SO" ? (
                <span className="px-3 py-1 rounded-lg text-xs font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  {tr(lang, "FINAL (SO)", "KONIEC (PO NÁJAZDOCH)")}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase bg-slate-800 text-slate-200 border border-slate-700">
                  {tr(lang, "FINAL", "KONIEC")}
                </span>
              )
            ) : (
              <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                {tr(lang, "SCHEDULED", "NA PROGRAME")}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Away Team */}
          <div className="md:col-span-4 flex items-center gap-4">
            <div className="rounded-2xl bg-slate-800/80 border border-slate-700/60 p-2.5 flex items-center justify-center shadow-lg shrink-0" style={{ width: 72, height: 72, minWidth: 72 }}>
              {g.awayTeam.logoUrl ? (
                <img src={g.awayTeam.logoUrl} alt={g.awayTeam.name} className="object-contain filter drop-shadow" style={{ width: 52, height: 52, maxWidth: 52, maxHeight: 52 }} />
              ) : (
                <span className="text-sm font-black text-slate-300">{g.awayTeam.code || g.awayTeam.name.slice(0, 3)}</span>
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[11px] uppercase font-bold text-slate-400 block">
                {tr(lang, "Away", "Hosťujúci tím")} {awayRecord ? `(${awayRecord})` : ""}
              </span>
              <h3 className={`text-lg sm:text-xl font-black truncate leading-tight ${isFinal ? (aw ? "text-white" : "text-slate-400") : "text-white"}`}>
                {g.awayTeam.name}
              </h3>
              {g.awayShots != null && (
                <span className="text-xs text-slate-400 mt-0.5 block">{tr(lang, "Shots", "Strely")}: {g.awayShots}</span>
              )}
            </div>
          </div>

          {/* Score Center */}
          <div className="md:col-span-4 flex flex-col items-center justify-center text-center py-2 sm:py-0">
            <div className="flex items-center gap-4 sm:gap-6">
              <span className={`text-4xl sm:text-5xl font-black tabular-nums ${isFinal ? (aw ? "text-white drop-shadow-lg" : "text-slate-400") : "text-slate-500"}`}>
                {isFinal ? (g.awayGoals ?? 0) : "–"}
              </span>
              <span className="text-xl font-bold text-slate-600">:</span>
              <span className={`text-4xl sm:text-5xl font-black tabular-nums ${isFinal ? (hw ? "text-white drop-shadow-lg" : "text-slate-400") : "text-slate-500"}`}>
                {isFinal ? (g.homeGoals ?? 0) : "–"}
              </span>
            </div>
            {periodsStr && (
              <div className="mt-2">
                <span className="px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono">
                  {tr(lang, "Periods", "Tretiny")}: ({periodsStr})
                </span>
              </div>
            )}
          </div>

          {/* Home Team */}
          <div className="md:col-span-4 flex items-center justify-end gap-4 text-right">
            <div className="min-w-0">
              <span className="text-[11px] uppercase font-bold text-slate-400 block">
                {tr(lang, "Home", "Domáci tím")} {homeRecord ? `(${homeRecord})` : ""}
              </span>
              <h3 className={`text-lg sm:text-xl font-black truncate leading-tight ${isFinal ? (hw ? "text-white" : "text-slate-400") : "text-white"}`}>
                {g.homeTeam.name}
              </h3>
              {g.homeShots != null && (
                <span className="text-xs text-slate-400 mt-0.5 block">{tr(lang, "Shots", "Strely")}: {g.homeShots}</span>
              )}
            </div>
            <div className="rounded-2xl bg-slate-800/80 border border-slate-700/60 p-2.5 flex items-center justify-center shadow-lg shrink-0" style={{ width: 72, height: 72, minWidth: 72 }}>
              {g.homeTeam.logoUrl ? (
                <img src={g.homeTeam.logoUrl} alt={g.homeTeam.name} className="object-contain filter drop-shadow" style={{ width: 52, height: 52, maxWidth: 52, maxHeight: 52 }} />
              ) : (
                <span className="text-sm font-black text-slate-300">{g.homeTeam.code || g.homeTeam.name.slice(0, 3)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Spodná lišta: Strelci gólov a Tlačidlo zápisu */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-300 space-y-1 min-w-0 flex-1">
            {awayScorers && (
              <div className="flex items-center gap-2 truncate">
                <span className="text-blue-400 font-bold shrink-0">{g.awayTeam.code || tr(lang, "AWAY", "HOSTIA")}:</span>
                <span className="truncate text-slate-300">{awayScorers}</span>
              </div>
            )}
            {homeScorers && (
              <div className="flex items-center gap-2 truncate">
                <span className="text-amber-400 font-bold shrink-0">{g.homeTeam.code || tr(lang, "HOME", "DOMÁCI")}:</span>
                <span className="truncate text-slate-300">{homeScorers}</span>
              </div>
            )}
          </div>

          <Link
            href={`/games/${g.id}`}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all shrink-0 self-end sm:self-auto"
          >
            <span>{tr(lang, "Full Boxscore", "Detailný zápis zo zápasu (Boxscore)")}</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ScoreCard({
  g,
  homeRecord,
  awayRecord,
  lang,
}: {
  g: GameRow;
  lang: Lang;
  homeRecord?: string | null;
  awayRecord?: string | null;
}) {
  const isFinal = g.status === "FINAL";
  const hw = isFinal && (g.homeGoals ?? 0) > (g.awayGoals ?? 0);
  const aw = isFinal && (g.awayGoals ?? 0) > (g.homeGoals ?? 0);
  const awayScorers = formatGoalScorers(g.goalEvents, g.awayTeam.id);
  const homeScorers = formatGoalScorers(g.goalEvents, g.homeTeam.id);
  const periodsStr = formatPeriods(g.homeGoalsByPeriod, g.awayGoalsByPeriod, g.endedIn);

type TeamCardInfo = {
  id: number;
  name: string;
  code: string | null;
  logoUrl: string | null;
  slug: string;
  arena?: string | null;
};

  const TeamRow = ({
    t,
    goals,
    shots,
    record,
    win,
  }: {
    t: TeamCardInfo;
    goals: number | null;
    shots: number | null;
    record?: string | null;
    win: boolean;
  }) => (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="rounded-xl bg-slate-800/80 border border-slate-700/60 p-1 flex items-center justify-center shrink-0 shadow-sm" style={{ width: 36, height: 36, minWidth: 36 }}>
          {t.logoUrl ? (
            <img src={t.logoUrl} alt={t.name} className="object-contain" style={{ width: 26, height: 26, maxWidth: 26, maxHeight: 26 }} />
          ) : (
            <span className="text-[10px] font-bold text-slate-400">{t.code || t.name.slice(0, 3)}</span>
          )}
        </div>
        <div className="min-w-0">
          <span className={`truncate text-sm leading-tight block ${isFinal ? (win ? "font-black text-white" : "font-medium text-slate-400") : "font-semibold text-slate-200"}`}>
            {t.name}
          </span>
          {record && <span className="text-[10px] text-slate-500 font-mono block leading-none mt-0.5">{record}</span>}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {shots != null && (
          <span className="text-[11px] text-slate-500 tabular-nums font-mono">{shots} {tr(lang, "SOG", "str")}</span>
        )}
        <span className={`tabular-nums text-2xl font-black min-w-[24px] text-right ${isFinal ? (win ? "text-white" : "text-slate-500") : "text-slate-600 font-normal"}`}>
          {isFinal ? (goals ?? "–") : "–"}
        </span>
      </div>
    </div>
  );

  return (
    <Link
      href={`/games/${g.id}`}
      className="group block bg-[#0b1120] hover:bg-[#0e172a] border border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 shadow-xl shadow-black/20 transition-all"
    >
      <div className="space-y-3">
        {/* Horná lišta: Stav & Aréna */}
        <div className="flex items-center justify-between text-[11px]">
          {isFinal ? (
            g.endedIn === "OT" ? (
              <span className="px-2 py-0.5 rounded font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] tracking-wide">
                {tr(lang, "Final (OT)", "Koniec (OT)")}
              </span>
            ) : g.endedIn === "SO" ? (
              <span className="px-2 py-0.5 rounded font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] tracking-wide">
                {tr(lang, "Final (SO)", "Koniec (SO)")}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded font-bold uppercase bg-slate-800/90 text-slate-300 border border-slate-700/60 text-[10px]">
                {tr(lang, "Final", "Koniec")}
              </span>
            )
          ) : (
            <span className="px-2 py-0.5 rounded font-bold uppercase bg-sky-500/20 text-sky-400 border border-sky-500/40 text-[10px] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              {tr(lang, "Scheduled", "Na programe")}
            </span>
          )}

          <span className="text-slate-400 text-[11px] truncate max-w-[170px] text-right">
            {g.eventTitle || g.eventVenue || g.homeTeam.arena || tr(lang, "Game", "Zápas")}
          </span>
        </div>

        {/* Tímy */}
        <div className="space-y-2">
          <TeamRow t={g.awayTeam} goals={g.awayGoals} shots={g.awayShots} record={awayRecord} win={aw} />
          <TeamRow t={g.homeTeam} goals={g.homeGoals} shots={g.homeShots} record={homeRecord} win={hw} />
        </div>

        {/* Tretiny a odkaz na Boxscore */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
          {periodsStr ? (
            <span className="text-slate-400 font-mono text-[10px]">{tr(lang, "Periods", "Tretiny")}: ({periodsStr})</span>
          ) : (
            <span className="text-slate-500 text-[10px]">{g.league} {tr(lang, "Game", "Zápas")}</span>
          )}
          <span className="text-blue-400 font-bold text-[11px] group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
            {isFinal ? "Boxscore" : "Preview"} <span className="text-xs">→</span>
          </span>
        </div>

        {/* Strelci gólov */}
        {(awayScorers || homeScorers) && (
          <div className="pt-2 border-t border-slate-800/60 text-[11px] space-y-1">
            {awayScorers && (
              <div className="flex items-start gap-1.5">
                <span className="text-blue-400 font-bold shrink-0">{g.awayTeam.code || tr(lang, "AWAY", "HOSTIA")}:</span>
                <span className="truncate text-slate-300">{awayScorers}</span>
              </div>
            )}
            {homeScorers && (
              <div className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold shrink-0">{g.homeTeam.code || tr(lang, "HOME", "DOMÁCI")}:</span>
                <span className="truncate text-slate-300">{homeScorers}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; league?: string; phase?: string }>;
}) {
  const sp = await searchParams;
  const lang = await getLang();
  const auto = sp.phase ? null : await defaultStatsPhase();
  const phase = sp.phase ? (normalizePhase(sp.phase) === "pre" ? "pre" : "regular") : (auto === "pre" ? "pre" : "regular");
  const SEASON = seasonForPhase(phase);

  const onlyAhl = sp.league === "AHL";
  const onlyNhl = sp.league === "NHL";
  const leagueFilter = onlyAhl ? { league: "AHL" } : onlyNhl ? { league: "NHL" } : {};
  const qPhase = phase === "pre" ? "&phase=pre" : "";
  const qLeague = onlyAhl ? "&league=AHL" : onlyNhl ? "&league=NHL" : "";

  // 1. Získať všetky herné dni pre kalendár
  const dates = await prisma.game.findMany({
    where: { season: SEASON, seriesId: null, gameDate: { not: null }, ...leagueFilter },
    select: { gameDate: true, status: true },
    orderBy: { gameDate: "asc" },
  });

  const dayList = dates.map((d) => iso(d.gameDate!));
  const uniqueDays = [...new Set(dayList)];
  const playedDays = [...new Set(dates.filter((d) => d.status === "FINAL").map((d) => iso(d.gameDate!)))];

  if (uniqueDays.length === 0) {
    return (
      <div className="space-y-4 py-2">
        <PageHeader title={phase === "pre" ? "Pre-season Scores" : "Scores"} subtitle={tr(lang, "No games have been scheduled yet.", "Zatiaľ nie sú naplánované žiadne zápasy.")} />
        <PhaseTabs active={phase} league={onlyAhl ? "AHL" : "NHL"} basePath="/scores" />
      </div>
    );
  }

  // Počet zápasov na každý deň pre kalendárový pás
  const dayCountMap = new Map<string, { total: number; played: number }>();
  for (const d of dates) {
    if (!d.gameDate) continue;
    const dayIso = iso(d.gameDate);
    const cur = dayCountMap.get(dayIso) ?? { total: 0, played: 0 };
    cur.total += 1;
    if (d.status === "FINAL") cur.played += 1;
    dayCountMap.set(dayIso, cur);
  }

  const defaultDay = playedDays.length > 0 ? playedDays[playedDays.length - 1] : uniqueDays[0];
  const date = sp.date;
  const current = date && uniqueDays.includes(date) ? date : defaultDay;
  const isLatest = current === defaultDay;
  const idx = uniqueDays.indexOf(current);
  const prev = idx > 0 ? uniqueDays[idx - 1] : null;
  const next = idx < uniqueDays.length - 1 ? uniqueDays[idx + 1] : null;

  // Viditeľné okno dní v karuseli (okolo vybraného dňa)
  const windowRadius = 6;
  const startIdx = Math.max(0, idx - windowRadius);
  const endIdx = Math.min(uniqueDays.length, idx + windowRadius + 1);
  const visibleDays = uniqueDays.slice(startIdx, endIdx);

  const start = new Date(current + "T00:00:00.000Z");
  const end = new Date(current + "T23:59:59.999Z");

  // 2. Načítať zápasy pre zvolený deň + bilancie tímov
  const [games, standingsNhl, standingsAhl] = await Promise.all([
    prisma.game.findMany({
      where: { season: SEASON, seriesId: null, gameDate: { gte: start, lte: end }, ...leagueFilter },
      select: {
        id: true,
        league: true,
        status: true,
        homeGoals: true,
        awayGoals: true,
        homeShots: true,
        awayShots: true,
        homeGoalsByPeriod: true,
        awayGoalsByPeriod: true,
        endedIn: true,
        attendance: true,
        eventTitle: true,
        eventVenue: true,
        homeTeam: { select: { id: true, name: true, code: true, logoUrl: true, slug: true, arena: true } },
        awayTeam: { select: { id: true, name: true, code: true, logoUrl: true, slug: true } },
        goalEvents: {
          select: {
            id: true,
            teamId: true,
            teamCode: true,
            scorerName: true,
            period: true,
            strength: true,
            emptyNet: true,
          },
          orderBy: { seconds: "asc" },
        },
      },
      orderBy: { id: "asc" },
    }),
    computeStandings(SEASON, "NHL"),
    computeStandings(SEASON, "AHL"),
  ]);

  const recordMap = new Map<number, string>();
  for (const s of standingsNhl) {
    if (s.gp > 0) recordMap.set(s.teamId, `${s.w}-${s.l}-${s.otl}`);
  }
  for (const s of standingsAhl) {
    if (s.gp > 0) recordMap.set(s.teamId, `${s.w}-${s.l}-${s.otl}`);
  }

  const nhl = games.filter((g) => g.league === "NHL");
  const ahl = games.filter((g) => g.league === "AHL");

  // Určenie šlágra dňa (najtesnejší alebo gólovo najbohatší zápas)
  const completedNhl = nhl.filter((g) => g.status === "FINAL");
  const featuredGame: GameRow | null =
    completedNhl.length > 0
      ? completedNhl.slice().sort((a, b) => {
          const aOt = a.endedIn && a.endedIn !== "REG" ? 10 : 0;
          const bOt = b.endedIn && b.endedIn !== "REG" ? 10 : 0;
          const aGoals = (a.homeGoals ?? 0) + (a.awayGoals ?? 0);
          const bGoals = (b.homeGoals ?? 0) + (b.awayGoals ?? 0);
          return bOt + bGoals - (aOt + aGoals);
        })[0]
      : nhl.length > 0
      ? nhl[0]
      : null;

  return (
    <div className="py-2 space-y-6">
      {/* Hlavička stránky */}
      <PageHeader
        title={`${onlyAhl ? "AHL " : onlyNhl ? "NHL " : ""}Scores`}
        subtitle={tr(lang, "Game results, detailed stats and the league calendar", "Výsledky zápasov, podrobné štatistiky a herný kalendár ligy")}
        right={
          <div className="flex items-center gap-2">
            {!isLatest && defaultDay && (
              <Link
                href={`/scores?date=${defaultDay}${qLeague}${qPhase}`}
                className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>⚡ {tr(lang, "Latest played", "Najnovšie odohrané")}</span>
              </Link>
            )}
            {prev ? (
              <Link
                href={`/scores?date=${prev}${qLeague}${qPhase}`}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700/60 transition-colors"
              >
                ◀ {tr(lang, "Previous", "Predchádzajúci")}
              </Link>
            ) : (
              <span className="px-3 py-1.5 rounded-xl bg-slate-900/60 text-slate-600 text-xs font-bold border border-slate-800/60 cursor-not-allowed">
                ◀ {tr(lang, "Previous", "Predchádzajúci")}
              </span>
            )}
            {next ? (
              <Link
                href={`/scores?date=${next}${qLeague}${qPhase}`}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700/60 transition-colors"
              >
                {tr(lang, "Next", "Nasledujúci")} ▶
              </Link>
            ) : (
              <span className="px-3 py-1.5 rounded-xl bg-slate-900/60 text-slate-600 text-xs font-bold border border-slate-800/60 cursor-not-allowed">
                {tr(lang, "Next", "Nasledujúci")} ▶
              </span>
            )}
          </div>
        }
      />

      {/* Prepínač fáz (Pre-season / Regular) */}
      <PhaseTabs active={phase} league={onlyAhl ? "AHL" : "NHL"} basePath="/scores" />

      {/* DÁTUMOVÝ KARUSEL / INTERAKTÍVNY PÁS DNÍ */}
      <div className="bg-[#0b1120] border border-slate-800/90 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wider font-extrabold text-slate-400">{tr(lang, "Date", "Dátum")}:</span>
            <span className="text-sm font-bold text-white capitalize">
              {pretty(new Date(current + "T12:00:00"), lang)}
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
              {games.length} {gamesWord(lang, games.length)}
            </span>
            {phase === "pre" && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {tr(lang, "Pre-season", "Pre-season (Príprava)")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            {startIdx > 0 && (
              <Link
                href={`/scores?date=${uniqueDays[0]}${qLeague}${qPhase}`}
                className="text-slate-400 hover:text-white transition-colors"
              >
                « {tr(lang, "First day", "Prvý deň")}
              </Link>
            )}
            {startIdx > 0 && endIdx < uniqueDays.length && <span className="text-slate-700">·</span>}
            {endIdx < uniqueDays.length && (
              <Link
                href={`/scores?date=${uniqueDays[uniqueDays.length - 1]}${qLeague}${qPhase}`}
                className="text-slate-400 hover:text-white transition-colors"
              >
                {tr(lang, "Last day", "Posledný deň")} »
              </Link>
            )}
          </div>
        </div>

        {/* Pás dní */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
          {visibleDays.map((d) => {
            const isSelected = d === current;
            const dateObj = new Date(d + "T12:00:00");
            const dayName = dateObj.toLocaleDateString(localeOf(lang), { weekday: "short" });
            const dayNum = dateObj.getDate();
            const monthName = dateObj.toLocaleDateString(localeOf(lang), { month: "short" });
            const info = dayCountMap.get(d) ?? { total: 0, played: 0 };

            if (isSelected) {
              return (
                <div
                  key={d}
                  className="shrink-0 flex flex-col items-center justify-center px-4 py-2.5 rounded-xl bg-gradient-to-b from-blue-600/30 to-blue-900/40 border-2 border-blue-500 text-white min-w-[96px] shadow-lg shadow-blue-500/20 relative"
                >
                  <span className="text-[10px] uppercase font-black text-blue-300 capitalize">
                    {dayName} {dayNum}. {monthName}
                  </span>
                  <span className="text-base font-black text-white mt-0.5">{dayNum}</span>
                  <span className="text-[10px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {info.total} {gamesWord(lang, info.total)}
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={d}
                href={`/scores?date=${d}${qLeague}${qPhase}`}
                className="shrink-0 flex flex-col items-center justify-center px-3.5 py-2 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200 min-w-[90px] transition-all"
              >
                <span className="text-[10px] uppercase font-bold text-slate-500 capitalize">
                  {dayName} {dayNum}. {monthName}
                </span>
                <span className="text-sm font-black text-slate-300 mt-0.5">{dayNum}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  {info.total} {gamesWord(lang, info.total)}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Filtre súťaže (Všetky, NHL, AHL) */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800/80">
          <span className="text-xs text-slate-400 font-medium">Filter:</span>
          <Link
            href={`/scores?date=${current}${qPhase}`}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              !onlyAhl && !onlyNhl
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300"
            }`}
          >
            {tr(lang, "All", "Všetky")} ({games.length})
          </Link>
          <Link
            href={`/scores?date=${current}&league=NHL${qPhase}`}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              onlyNhl
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300"
            }`}
          >
            {tr(lang, "NHL only", "Iba NHL")} ({nhl.length})
          </Link>
          <Link
            href={`/scores?date=${current}&league=AHL${qPhase}`}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              onlyAhl
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300"
            }`}
          >
            {tr(lang, "AHL only", "Iba AHL")} ({ahl.length})
          </Link>
        </div>
      </div>

      {/* ŠLÁGER KOLA / ZÁPAS VEČERA HERO BANNER */}
      {featuredGame && !onlyAhl && (
        <FeaturedGameHero
          g={featuredGame}
          homeRecord={recordMap.get(featuredGame.homeTeam.id)}
          awayRecord={recordMap.get(featuredGame.awayTeam.id)}
          lang={lang}
        />
      )}

      {/* NHL ZÁPASY */}
      {!onlyAhl && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black uppercase tracking-wider text-blue-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              {tr(lang, "NHL Games", "NHL Zápasy")} <span className="text-slate-500 font-normal text-xs">({nhl.length})</span>
            </h2>
          </div>

          {nhl.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#0b1120] border border-slate-800 text-center text-slate-500 text-sm">
              {tr(lang, "No NHL games scheduled for this day.", "Na tento deň nie sú naplánované žiadne zápasy NHL.")}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {nhl.map((g) => (
                <ScoreCard
                  key={g.id}
                  g={g}
                  homeRecord={recordMap.get(g.homeTeam.id)}
                  awayRecord={recordMap.get(g.awayTeam.id)}
                  lang={lang}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* AHL ZÁPASY */}
      {(!onlyNhl || onlyAhl) && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              {tr(lang, "AHL Games", "AHL Zápasy")} <span className="text-slate-500 font-normal text-xs">({ahl.length})</span>
            </h2>
          </div>

          {ahl.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#0b1120] border border-slate-800 text-center text-slate-500 text-sm">
              {tr(lang, "No AHL games scheduled for this day.", "Na tento deň nie sú naplánované žiadne zápasy AHL.")}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ahl.map((g) => (
                <ScoreCard
                  key={g.id}
                  g={g}
                  homeRecord={recordMap.get(g.homeTeam.id)}
                  awayRecord={recordMap.get(g.awayTeam.id)}
                  lang={lang}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
