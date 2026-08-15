import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { dailyDigest, latestDigestRound, playedRounds } from "@/lib/digest-server";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

function Card({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
      <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wide ${accent}`}>{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}
const plink = (name: string, slug: string | null) => slug ? <Link href={`/players/${slug}`} className="font-semibold hover:text-blue-400">{name}</Link> : <span className="font-semibold">{name}</span>;
const tlink = (code: string | null, slug: string | null) => slug ? <Link href={`/teams/${slug}`} className="text-slate-400 hover:text-blue-400">{code}</Link> : <span className="text-slate-400">{code}</span>;

export default async function DigestPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const sp = await searchParams;
  const rounds = await playedRounds(SEASON);
  const latest = await latestDigestRound(SEASON);
  const round = sp.round ? Number(sp.round) : latest;
  const d = await dailyDigest(SEASON, round);

  const idx = rounds.indexOf(round);
  const prev = idx > 0 ? rounds[idx - 1] : null;
  const next = idx >= 0 && idx < rounds.length - 1 ? rounds[idx + 1] : null;
  const dateStr = d.date ? new Date(d.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : `Day ${round}`;

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Tonight's Best" subtitle={`The story of the night — ${dateStr} · ${d.gameCount} games`} />

      <div className="flex items-center justify-between">
        {prev != null ? <Link href={`/league/digest?round=${prev}`} className="px-3 py-1.5 rounded-md bg-slate-800/60 text-sm hover:bg-slate-800">← Previous night</Link> : <span />}
        <span className="text-slate-500 text-sm">{dateStr}</span>
        {next != null ? <Link href={`/league/digest?round=${next}`} className="px-3 py-1.5 rounded-md bg-slate-800/60 text-sm hover:bg-slate-800">Next night →</Link> : <span />}
      </div>

      {d.gameCount === 0 ? (
        <p className="text-slate-500 text-center py-10">No games on this day.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {d.gameOfNight && (
            <Card title="🌟 Game of the Night" accent="text-amber-400 bg-amber-950/20">
              <div className="text-lg font-bold">{tlink(d.gameOfNight.away, d.gameOfNight.awaySlug)} {d.gameOfNight.awayGoals} — {d.gameOfNight.homeGoals} {tlink(d.gameOfNight.home, d.gameOfNight.homeSlug)}{d.gameOfNight.endedIn !== "REG" && <span className="text-amber-400 text-sm ml-1">({d.gameOfNight.endedIn})</span>}</div>
              <p className="text-sm text-slate-400 mt-1 capitalize">{d.gameOfNight.note}</p>
              <Link href={`/games/${d.gameOfNight.id}`} className="text-xs text-blue-400 hover:underline">box score →</Link>
            </Card>
          )}
          {d.playerOfNight && (
            <Card title="⭐ Player of the Night" accent="text-sky-400 bg-sky-950/20">
              <div className="text-lg">{plink(d.playerOfNight.name, d.playerOfNight.slug)} <span className="text-slate-500">({tlink(d.playerOfNight.team, d.playerOfNight.teamSlug)})</span></div>
              <p className="text-sm text-slate-300 mt-1">{d.playerOfNight.line}</p>
            </Card>
          )}
          {d.bestGoalie && (
            <Card title="🧤 Best Goalie" accent="text-emerald-400 bg-emerald-950/20">
              <div className="text-lg">{plink(d.bestGoalie.name, d.bestGoalie.slug)} <span className="text-slate-500">({tlink(d.bestGoalie.team, d.bestGoalie.teamSlug)})</span></div>
              <p className="text-sm text-slate-300 mt-1">{d.bestGoalie.line}</p>
            </Card>
          )}
          {d.upset && (
            <Card title="😱 Upset of the Night" accent="text-purple-400 bg-purple-950/20">
              <div className="text-lg font-bold">{tlink(d.upset.away, d.upset.awaySlug)} {d.upset.awayGoals} — {d.upset.homeGoals} {tlink(d.upset.home, d.upset.homeSlug)}</div>
              <p className="text-sm text-slate-400 mt-1">{d.upset.note}</p>
            </Card>
          )}
          {d.biggestHit && (
            <Card title="💥 Biggest Hit" accent="text-red-400 bg-red-950/20">
              <div className="text-lg">{plink(d.biggestHit.hitter, d.biggestHit.hitterSlug)}</div>
              <p className="text-sm text-slate-400 mt-1">{d.biggestHit.note}</p>
            </Card>
          )}
          <Card title="✚ Injury Report" accent="text-red-300 bg-red-950/10">
            {d.injuries.length === 0 ? <p className="text-emerald-400 text-sm">No injuries — a clean night.</p> : (
              <ul className="space-y-1 text-sm">
                {d.injuries.map((inj, i) => (
                  <li key={i}><span className="text-red-400">✚</span> {plink(inj.name, inj.slug)} <span className="text-slate-500">({inj.team})</span> — {inj.part}{inj.mechanism === "Hit" && inj.byName ? <span className="text-slate-500"> (hit by {inj.byName})</span> : ""} · <span className="text-slate-400">{inj.severity}, ~{inj.days}d</span></li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">All scores — {dateStr}</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {d.scores.map((g) => (
            <Link key={g.id} href={`/games/${g.id}`} className="flex items-center justify-between bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2 text-sm hover:border-slate-600">
              <span>{g.away} {g.awayGoals} — {g.homeGoals} {g.home}</span>
              {g.endedIn !== "REG" && <span className="text-slate-500 text-xs">{g.endedIn}</span>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
