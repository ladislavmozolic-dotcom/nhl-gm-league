import Link from "next/link";
import { dailyDigest, playedNights } from "@/lib/digest-server";
import { defaultStatsPhase } from "@/lib/calendar-server";
import { REGULAR_SEASON, PRE_SEASON } from "@/lib/phase";
import { getLang } from "@/lib/lang-server";
import PlayerAvatar from "@/components/playerAvatar";

export const dynamic = "force-dynamic";

function TeamCrest({
  logo,
  code,
  size = 32,
}: {
  logo?: string | null;
  code?: string | null;
  size?: number;
}) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={code ?? "Team"}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-contain shrink-0 drop-shadow select-none"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.35)) }}
      className="rounded-lg bg-slate-800 border border-slate-700/80 font-black flex items-center justify-center text-slate-300 shrink-0 font-mono shadow-inner select-none"
    >
      {code?.slice(0, 3) ?? "—"}
    </div>
  );
}

const t = {
  en: {
    title: "Tonight's Best",
    subtitle: (dateStr: string, count: number) =>
      `The story of the night — ${dateStr} · ${count} game${count === 1 ? "" : "s"}`,
    prevNight: "Previous night",
    nextNight: "Next night",
    leagueRecord: "League Record",
    noGames: "No games played on this day.",
    gameOfNight: "Game of the Night",
    playerOfNight: "Player of the Night",
    bestGoalie: "Best Goalie",
    upsetOfNight: "Upset of the Night",
    biggestHit: "Biggest Hit",
    hotCold: "Hot & Cold",
    powerRanking: "Power Ranking",
    milestones: "Milestones",
    injuryReport: "Injury Report",
    cleanNight: "Clean night — no injuries sustained.",
    allScores: "All Scores",
    boxScore: "Box Score",
    won: "won",
    straight: "straight",
    winless: "winless in",
    pts: "pts",
    gp: "GP",
    svPct: "SV%",
    saves: "Saves",
    gsax: "GSAx",
    goals: "G",
    assists: "A",
    points: "PTS",
    hitBy: "hit by",
    days: "d",
    hottestTitle: "On Fire",
    coldestTitle: "Cold Ice",
    skater: "Skater",
    goalie: "Goalie",
    hitter: "Hitter",
    victim: "Victim",
  },
  cs: {
    title: "Najlepšie z noci",
    subtitle: (dateStr: string, count: number) =>
      `Príbeh dnešnej noci — ${dateStr} · ${count} ${
        count === 1 ? "zápas" : count >= 2 && count <= 4 ? "zápasy" : "zápasov"
      }`,
    prevNight: "Predchádzajúca noc",
    nextNight: "Nasledujúca noc",
    leagueRecord: "Ligový rekord",
    noGames: "V tento deň sa neodohrali žiadne zápasy.",
    gameOfNight: "Zápas noci",
    playerOfNight: "Hráč noci",
    bestGoalie: "Najlepší brankár",
    upsetOfNight: "Prekvapenie noci",
    biggestHit: "Najtvrdší hit",
    hotCold: "Forma tímov",
    powerRanking: "Sila tímov (Power Ranking)",
    milestones: "Míľniky",
    injuryReport: "Správa o zraneniach",
    cleanNight: "Čistá noc — bez žiadnych zranení.",
    allScores: "Všetky výsledky",
    boxScore: "Detail zápasu",
    won: "séria výhier:",
    straight: "v rade",
    winless: "bez výhry:",
    pts: "b.",
    gp: "Z",
    svPct: "Úsp.%",
    saves: "zákrokov",
    gsax: "GSAx",
    goals: "G",
    assists: "A",
    points: "BOD",
    hitBy: "hit od hráča",
    days: "dní",
    hottestTitle: "Na víťaznej vlne",
    coldestTitle: "V kríze",
    skater: "Hráč",
    goalie: "Brankár",
    hitter: "Útočiaci",
    victim: "Zranený",
  },
};

export default async function DigestPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string; date?: string }>;
}) {
  const lang = await getLang();
  const i18n = lang === "cs" ? t.cs : t.en;

  const sp = await searchParams;
  const season = (await defaultStatsPhase()) === "pre" ? PRE_SEASON : REGULAR_SEASON;
  const nights = await playedNights(season);
  const target = sp.date ?? sp.round ?? (nights.length ? nights[nights.length - 1].id : null);
  const d = await dailyDigest(season, target);

  const curId = d.date
    ? d.date.slice(0, 10)
    : target
    ? String(target)
    : nights[nights.length - 1]?.id ?? "";
  const idx = nights.findIndex(
    (n) =>
      n.id === curId ||
      (d.date && n.date && n.date.slice(0, 10) === d.date.slice(0, 10)) ||
      (sp.round && n.round === Number(sp.round))
  );
  const prev = idx > 0 ? nights[idx - 1] : null;
  const next = idx >= 0 && idx < nights.length - 1 ? nights[idx + 1] : null;

  const dateStr = d.date
    ? new Date(d.date).toLocaleDateString(lang === "cs" ? "sk-SK" : "en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : lang === "cs"
    ? `Hrací deň ${d.round}`
    : `Day ${d.round}`;

  return (
    <div className="space-y-6 py-2 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            <span>✨</span>
            <span>Daily League Digest</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {i18n.title}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {i18n.subtitle(dateStr, d.gameCount)}
          </p>
        </div>

        {/* Date Navigator Strip */}
        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 p-1.5 rounded-xl shadow-lg backdrop-blur-md">
          {prev != null ? (
            <Link
              href={`/league/digest?${prev.date ? `date=${prev.id}` : `round=${prev.round}`}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700/60 hover:border-slate-600 transition-all shadow-sm"
              title={prev.label}
            >
              <span>←</span>
              <span className="hidden md:inline">{i18n.prevNight}</span>
              <span className="text-slate-400 font-mono text-[11px]">({prev.label})</span>
            </Link>
          ) : (
            <div className="px-3 py-1.5 text-xs text-slate-600 border border-transparent select-none">
              ← {i18n.prevNight}
            </div>
          )}

          <div className="px-3 py-1.5 bg-slate-800/40 rounded-lg text-xs font-bold text-amber-300 border border-slate-700/40 font-mono flex items-center gap-1.5 whitespace-nowrap">
            <span>📅</span>
            <span>{dateStr}</span>
          </div>

          {next != null ? (
            <Link
              href={`/league/digest?${next.date ? `date=${next.id}` : `round=${next.round}`}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700/60 hover:border-slate-600 transition-all shadow-sm"
              title={next.label}
            >
              <span className="text-slate-400 font-mono text-[11px]">({next.label})</span>
              <span className="hidden md:inline">{i18n.nextNight}</span>
              <span>→</span>
            </Link>
          ) : (
            <div className="px-3 py-1.5 text-xs text-slate-600 border border-transparent select-none">
              {i18n.nextNight} →
            </div>
          )}
        </div>
      </div>

      {/* Record Alerts Banner */}
      {d.recordAlerts.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900/40 px-5 py-4 shadow-xl shadow-amber-950/20">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-400 mb-2">
            <span className="text-base">🏆</span>
            <span>{i18n.leagueRecord}</span>
          </div>
          <ul className="space-y-1.5 text-sm font-medium text-amber-100">
            {d.recordAlerts.map((a, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {d.gameCount === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 shadow-lg">
          <div className="text-4xl mb-3">🏒</div>
          <p className="text-base font-semibold text-slate-300">{i18n.noGames}</p>
        </div>
      ) : (
        <>
          {/* Top Featured 2-Column Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* 🌟 Game of the Night */}
            {d.gameOfNight && (
              <div className="bg-gradient-to-br from-amber-950/30 via-slate-900/80 to-slate-950 border border-amber-500/30 shadow-xl rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider">
                      <span>🌟</span>
                      <span>{i18n.gameOfNight}</span>
                    </span>
                    {d.gameOfNight.endedIn !== "REG" && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-black font-mono">
                        {d.gameOfNight.endedIn}
                      </span>
                    )}
                  </div>

                  {/* Scoreboard display */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 mb-4">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                      {/* Away Team */}
                      <div className="flex items-center gap-3">
                        <TeamCrest
                          logo={d.gameOfNight.awayLogo}
                          code={d.gameOfNight.away}
                          size={46}
                        />
                        <div className="min-w-0">
                          <Link
                            href={d.gameOfNight.awaySlug ? `/teams/${d.gameOfNight.awaySlug}` : "#"}
                            className="font-bold text-white hover:text-amber-300 transition-colors block truncate text-base"
                          >
                            {d.gameOfNight.awayName ?? d.gameOfNight.away}
                          </Link>
                          <span className="text-xs text-slate-400 font-mono uppercase">
                            {d.gameOfNight.away}
                          </span>
                        </div>
                      </div>

                      {/* Scores */}
                      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800">
                        <span
                          className={`text-2xl font-black font-mono ${
                            d.gameOfNight.awayGoals > d.gameOfNight.homeGoals
                              ? "text-amber-300 drop-shadow"
                              : "text-slate-400"
                          }`}
                        >
                          {d.gameOfNight.awayGoals}
                        </span>
                        <span className="text-slate-600 font-bold">:</span>
                        <span
                          className={`text-2xl font-black font-mono ${
                            d.gameOfNight.homeGoals > d.gameOfNight.awayGoals
                              ? "text-amber-300 drop-shadow"
                              : "text-slate-400"
                          }`}
                        >
                          {d.gameOfNight.homeGoals}
                        </span>
                      </div>

                      {/* Home Team */}
                      <div className="flex items-center justify-end gap-3 text-right">
                        <div className="min-w-0">
                          <Link
                            href={d.gameOfNight.homeSlug ? `/teams/${d.gameOfNight.homeSlug}` : "#"}
                            className="font-bold text-white hover:text-amber-300 transition-colors block truncate text-base"
                          >
                            {d.gameOfNight.homeName ?? d.gameOfNight.home}
                          </Link>
                          <span className="text-xs text-slate-400 font-mono uppercase">
                            {d.gameOfNight.home}
                          </span>
                        </div>
                        <TeamCrest
                          logo={d.gameOfNight.homeLogo}
                          code={d.gameOfNight.home}
                          size={46}
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 capitalize italic mb-4">
                    "{d.gameOfNight.note}"
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Game #{d.gameOfNight.id}
                  </span>
                  <Link
                    href={`/games/${d.gameOfNight.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30 hover:border-amber-500/50 transition-all shadow-sm"
                  >
                    <span>{i18n.boxScore}</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            )}

            {/* ⭐ Player of the Night */}
            {d.playerOfNight && (
              <div className="bg-gradient-to-br from-sky-950/30 via-slate-900/80 to-slate-950 border border-sky-500/30 shadow-xl rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-bold uppercase tracking-wider">
                      <span>⭐</span>
                      <span>{i18n.playerOfNight}</span>
                    </span>
                    {d.playerOfNight.position && (
                      <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 text-xs font-black font-mono">
                        {d.playerOfNight.position}
                      </span>
                    )}
                  </div>

                  {/* Player Card Layout */}
                  <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 mb-4">
                    <div className="relative shrink-0">
                      <PlayerAvatar
                        src={d.playerOfNight.photoUrl ?? null}
                        alt={d.playerOfNight.name}
                        size={64}
                        className="ring-2 ring-sky-500/40 shadow-lg shadow-sky-950/50"
                      />
                      {d.playerOfNight.teamLogo && (
                        <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-0.5 border border-slate-700 shadow-md">
                          <TeamCrest
                            logo={d.playerOfNight.teamLogo}
                            code={d.playerOfNight.team}
                            size={20}
                          />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={d.playerOfNight.slug ? `/players/${d.playerOfNight.slug}` : "#"}
                        className="text-lg font-bold text-white hover:text-sky-300 transition-colors block truncate"
                      >
                        {d.playerOfNight.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        {d.playerOfNight.teamSlug ? (
                          <Link
                            href={`/teams/${d.playerOfNight.teamSlug}`}
                            className="hover:text-sky-300 transition-colors font-semibold"
                          >
                            {d.playerOfNight.teamName ?? d.playerOfNight.team}
                          </Link>
                        ) : (
                          <span>{d.playerOfNight.team}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stat chips */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {d.playerOfNight.points != null && (
                      <div className="px-3 py-1.5 rounded-lg bg-sky-500/20 text-sky-200 border border-sky-500/30 text-sm font-bold flex items-center gap-1.5">
                        <span className="text-base font-black font-mono">{d.playerOfNight.points}</span>
                        <span className="text-xs uppercase">{i18n.points}</span>
                      </div>
                    )}
                    {d.playerOfNight.goals != null && (
                      <div className="px-3 py-1.5 rounded-lg bg-slate-800/90 text-slate-200 border border-slate-700 text-sm font-bold flex items-center gap-1.5">
                        <span className="text-base font-black font-mono text-white">
                          {d.playerOfNight.goals}
                        </span>
                        <span className="text-xs uppercase text-slate-400">{i18n.goals}</span>
                      </div>
                    )}
                    {d.playerOfNight.assists != null && (
                      <div className="px-3 py-1.5 rounded-lg bg-slate-800/90 text-slate-200 border border-slate-700 text-sm font-bold flex items-center gap-1.5">
                        <span className="text-base font-black font-mono text-white">
                          {d.playerOfNight.assists}
                        </span>
                        <span className="text-xs uppercase text-slate-400">{i18n.assists}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-400 italic">
                    {d.playerOfNight.line}
                  </span>
                  {d.playerOfNight.slug && (
                    <Link
                      href={`/players/${d.playerOfNight.slug}`}
                      className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-semibold transition-colors"
                    >
                      <span>Profile</span>
                      <span>→</span>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* 🧤 Best Goalie */}
            {d.bestGoalie && (
              <div className="bg-gradient-to-br from-emerald-950/30 via-slate-900/80 to-slate-950 border border-emerald-500/30 shadow-xl rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
                      <span>🧤</span>
                      <span>{i18n.bestGoalie}</span>
                    </span>
                    {d.bestGoalie.gsax != null && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black font-mono">
                        {d.bestGoalie.gsax >= 0 ? "+" : ""}
                        {d.bestGoalie.gsax.toFixed(2)} GSAx
                      </span>
                    )}
                  </div>

                  {/* Goalie Card Layout */}
                  <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 mb-4">
                    <div className="relative shrink-0">
                      <PlayerAvatar
                        src={d.bestGoalie.photoUrl ?? null}
                        alt={d.bestGoalie.name}
                        size={64}
                        className="ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-950/50"
                      />
                      {d.bestGoalie.teamLogo && (
                        <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-0.5 border border-slate-700 shadow-md">
                          <TeamCrest
                            logo={d.bestGoalie.teamLogo}
                            code={d.bestGoalie.team}
                            size={20}
                          />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={d.bestGoalie.slug ? `/players/${d.bestGoalie.slug}` : "#"}
                        className="text-lg font-bold text-white hover:text-emerald-300 transition-colors block truncate"
                      >
                        {d.bestGoalie.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        {d.bestGoalie.teamSlug ? (
                          <Link
                            href={`/teams/${d.bestGoalie.teamSlug}`}
                            className="hover:text-emerald-300 transition-colors font-semibold"
                          >
                            {d.bestGoalie.teamName ?? d.bestGoalie.team}
                          </Link>
                        ) : (
                          <span>{d.bestGoalie.team}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stat chips */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {d.bestGoalie.svPct != null && (
                      <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 text-sm font-bold flex items-center gap-1.5">
                        <span className="text-base font-black font-mono">
                          {d.bestGoalie.svPct.toFixed(1)}%
                        </span>
                        <span className="text-xs uppercase">{i18n.svPct}</span>
                      </div>
                    )}
                    {d.bestGoalie.saves != null && (
                      <div className="px-3 py-1.5 rounded-lg bg-slate-800/90 text-slate-200 border border-slate-700 text-sm font-bold flex items-center gap-1.5">
                        <span className="text-base font-black font-mono text-white">
                          {d.bestGoalie.saves}/{d.bestGoalie.shotsAgainst}
                        </span>
                        <span className="text-xs uppercase text-slate-400">{i18n.saves}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-400 italic">
                    {d.bestGoalie.line}
                  </span>
                  {d.bestGoalie.slug && (
                    <Link
                      href={`/players/${d.bestGoalie.slug}`}
                      className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                    >
                      <span>Profile</span>
                      <span>→</span>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* 😱 Upset of the Night */}
            {d.upset && (
              <div className="bg-gradient-to-br from-purple-950/30 via-slate-900/80 to-slate-950 border border-purple-500/30 shadow-xl rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold uppercase tracking-wider">
                      <span>😱</span>
                      <span>{i18n.upsetOfNight}</span>
                    </span>
                    {d.upset.endedIn !== "REG" && (
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-black font-mono">
                        {d.upset.endedIn}
                      </span>
                    )}
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 mb-4">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                      {/* Away */}
                      <div className="flex items-center gap-3">
                        <TeamCrest logo={d.upset.awayLogo} code={d.upset.away} size={42} />
                        <div className="min-w-0">
                          <Link
                            href={d.upset.awaySlug ? `/teams/${d.upset.awaySlug}` : "#"}
                            className="font-bold text-white hover:text-purple-300 transition-colors block truncate text-sm"
                          >
                            {d.upset.awayName ?? d.upset.away}
                          </Link>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800">
                        <span
                          className={`text-xl font-black font-mono ${
                            d.upset.awayGoals > d.upset.homeGoals
                              ? "text-purple-300"
                              : "text-slate-400"
                          }`}
                        >
                          {d.upset.awayGoals}
                        </span>
                        <span className="text-slate-600 font-bold">:</span>
                        <span
                          className={`text-xl font-black font-mono ${
                            d.upset.homeGoals > d.upset.awayGoals
                              ? "text-purple-300"
                              : "text-slate-400"
                          }`}
                        >
                          {d.upset.homeGoals}
                        </span>
                      </div>

                      {/* Home */}
                      <div className="flex items-center justify-end gap-3 text-right">
                        <div className="min-w-0">
                          <Link
                            href={d.upset.homeSlug ? `/teams/${d.upset.homeSlug}` : "#"}
                            className="font-bold text-white hover:text-purple-300 transition-colors block truncate text-sm"
                          >
                            {d.upset.homeName ?? d.upset.home}
                          </Link>
                        </div>
                        <TeamCrest logo={d.upset.homeLogo} code={d.upset.home} size={42} />
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 italic mb-4">
                    {d.upset.note}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Game #{d.upset.id}</span>
                  <Link
                    href={`/games/${d.upset.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-semibold border border-purple-500/30 transition-colors"
                  >
                    <span>{i18n.boxScore}</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            )}

            {/* 💥 Biggest Hit */}
            {d.biggestHit && (
              <div className="bg-gradient-to-br from-rose-950/30 via-slate-900/80 to-slate-950 border border-rose-500/30 shadow-xl rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold uppercase tracking-wider">
                      <span>💥</span>
                      <span>{i18n.biggestHit}</span>
                    </span>
                  </div>

                  {/* Dual avatar layout */}
                  <div className="flex items-center justify-around bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 mb-4">
                    {/* Hitter */}
                    <div className="text-center">
                      <PlayerAvatar
                        src={d.biggestHit.hitterPhoto ?? null}
                        alt={d.biggestHit.hitter}
                        size={52}
                        className="mx-auto ring-2 ring-rose-500/40 shadow-lg shadow-rose-950/50 mb-2"
                      />
                      <Link
                        href={d.biggestHit.hitterSlug ? `/players/${d.biggestHit.hitterSlug}` : "#"}
                        className="text-sm font-bold text-white hover:text-rose-300 transition-colors block max-w-[130px] truncate mx-auto"
                      >
                        {d.biggestHit.hitter}
                      </Link>
                      <span className="text-[11px] uppercase tracking-wider font-bold text-rose-400">
                        {i18n.hitter}
                      </span>
                    </div>

                    <div className="text-2xl font-black text-rose-500 animate-pulse">
                      ⚡
                    </div>

                    {/* Victim */}
                    <div className="text-center">
                      <PlayerAvatar
                        src={d.biggestHit.victimPhoto ?? null}
                        alt={d.biggestHit.victim}
                        size={52}
                        className="mx-auto ring-2 ring-slate-600/40 shadow-lg mb-2 opacity-80"
                      />
                      <Link
                        href={d.biggestHit.victimSlug ? `/players/${d.biggestHit.victimSlug}` : "#"}
                        className="text-sm font-bold text-slate-300 hover:text-white transition-colors block max-w-[130px] truncate mx-auto"
                      >
                        {d.biggestHit.victim}
                      </Link>
                      <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                        {i18n.victim}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 italic mb-4">
                    {d.biggestHit.note}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-right">
                  <span className="text-xs text-rose-400/80 font-medium">Physical Play Highlight</span>
                </div>
              </div>
            )}

            {/* 🌡️ Hot & Cold */}
            {(d.hottest || d.coldest) && (
              <div className="bg-slate-900/80 border border-slate-800 shadow-xl rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-bold uppercase tracking-wider">
                      <span>🌡️</span>
                      <span>{i18n.hotCold}</span>
                    </span>
                  </div>

                  <div className="space-y-3 mb-2">
                    {d.hottest && (
                      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-orange-950/20 via-slate-950/60 to-slate-950/60 border border-orange-500/20 rounded-xl p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <TeamCrest logo={d.hottest.logoUrl} code={d.hottest.code} size={38} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-base">🔥</span>
                              <Link
                                href={d.hottest.slug ? `/teams/${d.hottest.slug}` : "#"}
                                className="font-bold text-white hover:text-orange-300 transition-colors text-sm truncate"
                              >
                                {d.hottest.name}
                              </Link>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {i18n.won} <strong className="text-emerald-400">{d.hottest.streakLen}</strong> {i18n.straight} · {d.hottest.last10} L10
                            </div>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black font-mono text-xs whitespace-nowrap">
                          W{d.hottest.streakLen}
                        </span>
                      </div>
                    )}

                    {d.coldest && (
                      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-sky-950/20 via-slate-950/60 to-slate-950/60 border border-sky-500/20 rounded-xl p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <TeamCrest logo={d.coldest.logoUrl} code={d.coldest.code} size={38} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-base">🧊</span>
                              <Link
                                href={d.coldest.slug ? `/teams/${d.coldest.slug}` : "#"}
                                className="font-bold text-white hover:text-sky-300 transition-colors text-sm truncate"
                              >
                                {d.coldest.name}
                              </Link>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {i18n.winless} <strong className="text-rose-400">{d.coldest.streakLen}</strong> · {d.coldest.last10} L10
                            </div>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 font-black font-mono text-xs whitespace-nowrap">
                          L{d.coldest.streakLen}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-right">
                  <span className="text-xs text-slate-500">Streak momentum</span>
                </div>
              </div>
            )}

            {/* 📊 Power Ranking */}
            {d.powerRanking.length > 0 && (
              <div className="bg-slate-900/80 border border-slate-800 shadow-xl rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider">
                      <span>📊</span>
                      <span>{i18n.powerRanking}</span>
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Top 5 Clubs</span>
                  </div>

                  <div className="space-y-2 mb-2">
                    {d.powerRanking.map((p) => (
                      <div
                        key={p.rank}
                        className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2 hover:border-slate-700 transition-colors"
                      >
                        <span className="w-5 text-center font-black font-mono text-xs text-indigo-400">
                          #{p.rank}
                        </span>
                        <TeamCrest logo={p.logoUrl} code={p.code} size={24} />
                        <div className="flex-1 min-w-0">
                          <Link
                            href={p.slug ? `/teams/${p.slug}` : "#"}
                            className="font-bold text-white hover:text-indigo-300 transition-colors text-sm block truncate"
                          >
                            {p.name ?? p.code}
                          </Link>
                        </div>
                        <span className="tabular-nums font-mono text-xs text-slate-300">
                          <strong>{p.points}</strong> {i18n.pts} · {p.gp} {i18n.gp}
                        </span>
                        {p.streakType && p.streakLen >= 2 && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                              p.streakType === "W"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {p.streakType}
                            {p.streakLen}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-right">
                  <span className="text-xs text-slate-500">Sorted by PTS%</span>
                </div>
              </div>
            )}

            {/* 🎖️ Milestones */}
            {d.milestones.length > 0 && (
              <div className="bg-slate-900/80 border border-slate-800 shadow-xl rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-xs font-bold uppercase tracking-wider">
                      <span>🎖️</span>
                      <span>{i18n.milestones}</span>
                    </span>
                  </div>

                  <ul className="space-y-2 mb-2">
                    {d.milestones.map((m, i) => (
                      <li
                        key={i}
                        className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-sm text-yellow-100 flex items-center gap-2.5"
                      >
                        <span className="text-lg">🏅</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="pt-2 border-t border-slate-800/80 text-right">
                  <span className="text-xs text-slate-500">Career milestones</span>
                </div>
              </div>
            )}

            {/* ✚ Injury Report */}
            <div className="bg-slate-900/80 border border-slate-800 shadow-xl rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold uppercase tracking-wider">
                    <span>✚</span>
                    <span>{i18n.injuryReport}</span>
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {d.injuries.length} {d.injuries.length === 1 ? "injury" : "injuries"}
                  </span>
                </div>

                {d.injuries.length === 0 ? (
                  <div className="flex items-center gap-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4 text-emerald-300 text-sm">
                    <span className="text-xl">🛡️</span>
                    <span>{i18n.cleanNight}</span>
                  </div>
                ) : (
                  <div className="space-y-2.5 mb-2">
                    {d.injuries.map((inj, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 hover:border-slate-700 transition-colors"
                      >
                        <PlayerAvatar
                          src={inj.photoUrl ?? null}
                          alt={inj.name}
                          size={36}
                          className="ring-1 ring-rose-500/40"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Link
                              href={inj.slug ? `/players/${inj.slug}` : "#"}
                              className="font-bold text-white hover:text-rose-300 transition-colors text-sm truncate"
                            >
                              {inj.name}
                            </Link>
                            {inj.team && (
                              <span className="text-xs text-slate-400 font-mono">
                                ({inj.team})
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 truncate">
                            <span className="text-rose-300 font-medium">{inj.part}</span>
                            {inj.mechanism === "Hit" && inj.byName ? (
                              <span> · {i18n.hitBy} {inj.byName}</span>
                            ) : (
                              <span> · {inj.mechanism}</span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="inline-block px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs font-mono font-bold">
                            ~{inj.days}{i18n.days}
                          </span>
                          <span className="block text-[10px] text-slate-500 uppercase mt-0.5">
                            {inj.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/80 text-right">
                <Link
                  href="/players/injuries"
                  className="text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors"
                >
                  Full League Injury Report →
                </Link>
              </div>
            </div>
          </div>

          {/* All Scores Grid */}
          <div className="pt-4">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏒</span>
                <h2 className="text-base font-bold uppercase tracking-wider text-slate-200">
                  {i18n.allScores} — {dateStr}
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono font-bold">
                {d.scores.length} {lang === "cs" ? "zápasov" : "games"}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {d.scores.map((g) => {
                const awayWon = g.awayGoals > g.homeGoals;
                const homeWon = g.homeGoals > g.awayGoals;

                return (
                  <Link
                    key={g.id}
                    href={`/games/${g.id}`}
                    className="bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700/80 rounded-xl p-3.5 transition-all group shadow-md flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      {/* Away row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <TeamCrest logo={g.awayLogo} code={g.away} size={24} />
                          <span
                            className={`text-sm truncate ${
                              awayWon
                                ? "font-bold text-white group-hover:text-amber-300 transition-colors"
                                : "text-slate-400"
                            }`}
                          >
                            {g.awayName ?? g.away}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-base font-black px-2 py-0.5 rounded ${
                            awayWon
                              ? "text-white bg-slate-800"
                              : "text-slate-500"
                          }`}
                        >
                          {g.awayGoals}
                        </span>
                      </div>

                      {/* Home row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <TeamCrest logo={g.homeLogo} code={g.home} size={24} />
                          <span
                            className={`text-sm truncate ${
                              homeWon
                                ? "font-bold text-white group-hover:text-amber-300 transition-colors"
                                : "text-slate-400"
                            }`}
                          >
                            {g.homeName ?? g.home}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-base font-black px-2 py-0.5 rounded ${
                            homeWon
                              ? "text-white bg-slate-800"
                              : "text-slate-500"
                          }`}
                        >
                          {g.homeGoals}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono">
                        {g.endedIn !== "REG" ? (
                          <span className="text-amber-400 font-bold">{g.endedIn}</span>
                        ) : (
                          "FINAL"
                        )}
                      </span>
                      <span className="text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-semibold">
                        <span>{i18n.boxScore}</span>
                        <span>→</span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

