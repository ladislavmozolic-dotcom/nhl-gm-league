import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import { cleanName } from "@/lib/playerName";
import { ceremonyFinalists } from "@/lib/award-voting";
import AwardsCeremony, { type CeremonyCategory, type Nominee } from "@/components/AwardsCeremony";

export const dynamic = "force-dynamic";

const AUTO = new Set(["Art Ross", "Rocket Richard"]);
const META: Record<string, { label: string; subtitle: string; icon: string }> = {
  Hart: { label: "Hart Memorial", subtitle: "Most Valuable Player", icon: "🏆" },
  "Ted Lindsay": { label: "Ted Lindsay", subtitle: "Most outstanding player", icon: "⭐" },
  "Art Ross": { label: "Art Ross", subtitle: "Scoring leader", icon: "📈" },
  "Rocket Richard": { label: "Rocket Richard", subtitle: "Goals leader", icon: "🚀" },
  Norris: { label: "Norris", subtitle: "Best defenseman", icon: "🛡️" },
  Vezina: { label: "Vezina", subtitle: "Best goaltender", icon: "🧤" },
  Calder: { label: "Calder", subtitle: "Top rookie", icon: "🌟" },
  Selke: { label: "Selke", subtitle: "Best defensive forward", icon: "🔒" },
  "Lady Byng": { label: "Lady Byng", subtitle: "Skill & sportsmanship", icon: "🕊️" },
  "Conn Smythe": { label: "Conn Smythe", subtitle: "Playoff MVP", icon: "👑" },
  "Jack Adams": { label: "Jack Adams", subtitle: "Coach of the year", icon: "📋" },
  "GM of the Year": { label: "GM of the Year", subtitle: "Best general manager", icon: "🧠" },
};

export default async function AwardsPage({ searchParams }: { searchParams: Promise<{ season?: string; league?: string }> }) {
  const sp = await searchParams;
  const league = sp.league === "AHL" ? "AHL" : "NHL";

  const records = await prisma.seasonRecord.findMany({ select: { season: true }, distinct: ["season"], orderBy: { season: "desc" } });
  const seasons = records.map((r) => r.season);
  const season = sp.season && seasons.includes(sp.season) ? sp.season : (seasons[0] ?? "2026-27");

  if (seasons.length === 0) {
    return (
      <div className="space-y-6 py-2">
        <PageHeader title="Awards Ceremony" subtitle="End-of-season trophies" />
        <ComingSoon title="No season archived yet" points={["Play a season through to the Cup Final", "Then Admin → Season Control → Archive season", "Come back here for the awards ceremony"]} />
      </div>
    );
  }

  const [f, voting] = await Promise.all([
    ceremonyFinalists(season, league),
    prisma.awardVoting.findUnique({ where: { season_league: { season, league } }, select: { status: true } }),
  ]);
  const resolved = f.voted; // vote-decided winners are public only once resolved

  // resolve player photos + team logos in one pass
  const playerIds = [...new Set(f.categories.flatMap((c) => c.finalists.map((n) => n.playerId).filter((x): x is number => !!x)))];
  const teamIds = [...new Set([
    ...f.categories.flatMap((c) => c.finalists.map((n) => n.teamId).filter((x): x is number => !!x)),
    f.championTeamId, f.runnerUpTeamId, f.presidentsTeamId,
  ].filter((x): x is number => !!x))];
  const [players, teams] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, photoUrl: true } }),
    prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true, slug: true, logoUrl: true } }),
  ]);
  const photoOf = new Map(players.map((p) => [p.id, p.photoUrl]));
  const teamOf = new Map(teams.map((t) => [t.id, t]));

  const categories: CeremonyCategory[] = f.categories.map((c) => {
    const meta = META[c.category] ?? { label: c.category, subtitle: "", icon: "🏅" };
    const nominees: Nominee[] = c.finalists.map((n) => {
      const t = n.teamId ? teamOf.get(n.teamId) : undefined;
      return {
        playerId: n.playerId,
        name: n.playerName ? cleanName(n.playerName) : "—",
        detail: n.detail,
        teamName: t?.name, teamLogo: t?.logoUrl, teamSlug: t?.slug,
        photoUrl: n.playerId ? photoOf.get(n.playerId) ?? null : null,
      };
    });
    return { category: c.category, label: meta.label, subtitle: meta.subtitle, icon: meta.icon, nominees };
  });

  const honour = (id: number | null, label: string, icon: string) => {
    if (!id) return null;
    const t = teamOf.get(id);
    if (!t) return null;
    return (
      <Link key={label} href={`/teams/${t.slug}`} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 hover:border-amber-500/40 transition-colors">
        <span className="text-2xl" aria-hidden>{icon}</span>
        {t.logoUrl && <img src={t.logoUrl} alt="" className="w-9 h-9 object-contain" />}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-amber-400/80">{label}</div>
          <div className="font-semibold text-slate-100">{t.name}</div>
        </div>
      </Link>
    );
  };
  const honours = [
    honour(f.championTeamId, league === "AHL" ? "Calder Cup Champion" : "Stanley Cup Champion", "🏆"),
    honour(f.presidentsTeamId, "President's Trophy", "🥇"),
    honour(f.runnerUpTeamId, "Cup Finalist", "🥈"),
  ].filter(Boolean);

  return (
    <div className="space-y-6 py-2">
      <PageHeader title={`${season} Awards Ceremony`} subtitle={`${league} · nominees & trophy winners`} />

      {/* season / league switcher */}
      <div className="flex flex-wrap items-center gap-2">
        {seasons.map((s) => (
          <Link key={s} href={`/awards?season=${s}&league=${league}`} className={`text-xs px-3 py-1.5 rounded-full border ${s === season ? "border-amber-500/50 bg-amber-500/15 text-amber-300" : "border-slate-800 text-slate-400 hover:text-slate-200"}`}>{s}</Link>
        ))}
        <span className="mx-1 text-slate-700">|</span>
        {(["NHL", "AHL"] as const).map((lg) => (
          <Link key={lg} href={`/awards?season=${season}&league=${lg}`} className={`text-xs px-3 py-1.5 rounded-full border ${lg === league ? "border-blue-500/50 bg-blue-500/15 text-blue-300" : "border-slate-800 text-slate-400 hover:text-slate-200"}`}>{lg}</Link>
        ))}
      </div>

      {voting?.status === "OPEN" && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm bg-emerald-950/25 border border-emerald-800/40 rounded-lg px-4 py-3">
          <span className="text-emerald-200"><b>🗳️ Award voting is open.</b> GMs rank their ballots now — winners stay hidden until the vote is resolved.</span>
          <Link href="/awards/vote" className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5">Cast your ballot →</Link>
        </div>
      )}
      {voting?.status === "CLOSED" && (
        <div className="text-sm text-amber-200 bg-amber-950/25 border border-amber-800/40 rounded-lg px-4 py-3">
          <b>Voting closed.</b> Ballots are in — the winners are revealed once the league admin resolves the vote.
        </div>
      )}

      {honours.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{honours}</div>
      )}

      {categories.length > 0 ? (
        <AwardsCeremony categories={categories} locked={!resolved && !!voting && voting.status !== "RESOLVED"} />
      ) : (
        <Card><p className="text-slate-500 text-center py-8">No individual awards for this season yet.</p></Card>
      )}
    </div>
  );
}
