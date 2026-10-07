import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import StatsTabs from "@/components/StatsTabs";
import StatHeroDeck, { type HeroCardItem } from "@/components/StatHeroDeck";
import { PageHeader, Card } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import { leagueStarLeaderboard } from "@/lib/star-power-server";
import { tierAccent } from "@/lib/star-power";
import { getLang } from "@/lib/lang-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function StarPowerPage() {
  const lang = await getLang();
  const sessionTeamId = await getTeamSession();
  const [rows, managedTeams] = await Promise.all([
    leagueStarLeaderboard(60),
    sessionTeamId == null
      ? Promise.resolve([])
      : prisma.team.findMany({ where: { OR: [{ id: sessionTeamId }, { parentTeamId: sessionTeamId }] }, select: { id: true } }),
  ]);
  const managedTeamIds = new Set(managedTeams.map((t) => t.id));

  // Top 3 Star Power Spotlight Cards
  const top3 = rows.slice(0, 3);
  const heroCards: HeroCardItem[] = top3.map((r, idx) => ({
    badge: idx === 0 ? t(lang, "stats.badge.franchiseIcon") : idx === 1 ? t(lang, "stats.badge.superstar") : t(lang, "stats.badge.marqueeAttraction"),
    subBadge: `#${idx + 1} ${t(lang, "stats.subBadge.starRank")}`,
    playerId: r.playerId,
    slug: r.slug,
    name: r.name,
    photoUrl: r.photoUrl,
    position: r.position,
    teamId: r.teamId,
    teamCode: r.teamCode,
    teamSlug: r.teamSlug,
    teamLogo: r.teamLogo,
    value: r.score,
    unit: "PWR",
    sub: r.reasons.slice(0, 2).join(" · ") || r.tier,
    accentColor: idx === 0 ? "amber" : idx === 1 ? "purple" : "sky",
  }));

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Statistics" subtitle={t(lang, "stats.starPower.subtitle")} />
      <StatsTabs active="star-power" />

      {/* Top 3 Spotlight Podium */}
      {heroCards.length > 0 && (
        <StatHeroDeck cards={heroCards} managedTeamIds={managedTeamIds} />
      )}

      <Card>
        <p className="text-sm text-slate-400">
          Star Power is a player&apos;s <b>business and media</b> value — it has <b>zero effect on the ice</b>.
          <InfoTip text="Computed automatically from on-ice talent, recent production, career legend status, trophy pedigree and rookie hype. It drives merchandise, jersey sales, fan interest, ticket demand and sponsor appeal — never gameplay. An ageing legend can still sell jerseys; a hyped rookie can rate high before he produces." />
          {" "}It powers merchandise, jersey sales, fan interest, ticket demand and sponsorships in the Detailed Finance system.
        </p>
      </Card>

      <div className="bg-[#0b1120] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 bg-slate-950/80">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-3 py-3">Team</th>
                <th className="px-3 py-3">Tier</th>
                <th className="px-3 py-3 text-right">Star Power</th>
                <th className="px-4 py-3 hidden sm:table-cell">Main reasons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {rows.map((r, i) => {
                const isMine = r.teamId != null && managedTeamIds.has(r.teamId);
                return (
                  <tr
                    key={r.playerId}
                    className={`transition-colors ${
                      isMine
                        ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                        : "hover:bg-slate-800/30"
                    }`}
                  >
                    <td className="px-4 py-2.5 tabular-nums text-slate-500 font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/players/${r.slug || r.playerId}`}
                        className={`font-bold transition-colors ${
                          isMine ? "text-emerald-300 hover:text-emerald-200" : "text-white hover:text-blue-400"
                        }`}
                      >
                        {r.name}
                      </Link>
                      <span className="ml-1.5 text-[11px] text-slate-500 font-mono">· {r.position}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">
                      {r.teamCode ? (
                        <Link
                          href={r.teamSlug ? `/teams/${r.teamSlug}` : "#"}
                          className="inline-flex items-center gap-1.5 hover:text-blue-400 font-bold transition-colors"
                        >
                          {r.teamLogo && <img src={r.teamLogo} alt="" className="w-4 h-4 object-contain shrink-0" />}
                          <span>{r.teamCode}</span>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`px-3 py-2.5 font-bold ${tierAccent(r.tier)}`}>{r.tier}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden hidden sm:block">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-fuchsia-500" style={{ width: `${r.score}%` }} />
                        </div>
                        <span className="tabular-nums font-black font-mono w-8 text-right text-white">{r.score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 hidden sm:table-cell">{r.reasons.join(" · ") || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
