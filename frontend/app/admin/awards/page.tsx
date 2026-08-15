import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import { buildBallots, tallyVotes, VOTED_AWARDS } from "@/lib/award-voting";
import { cleanName } from "@/lib/playerName";
import AwardVotingAdmin from "@/components/AwardVotingAdmin";

export const dynamic = "force-dynamic";

export default async function AdminAwardsPage() {
  if (!(await isAdmin())) redirect("/login");

  const latest = await prisma.awardVoting.findFirst({ orderBy: { updatedAt: "desc" } });
  const season = latest?.season ?? "2026-27";
  const league = latest?.league ?? "NHL";
  const status = (latest?.status as "OPEN" | "CLOSED" | "RESOLVED") ?? "NONE";

  const [ballots, tally, voterRows, teams] = await Promise.all([
    buildBallots(season, league),
    tallyVotes(season, league),
    prisma.awardVote.groupBy({ by: ["voterTeamId", "isAi"], where: { season, league }, _count: { _all: true } }),
    prisma.team.findMany({ where: { league, isAffiliate: false }, select: { id: true } }),
  ]);
  const humanVoters = new Set(voterRows.filter((v) => !v.isAi).map((v) => v.voterTeamId)).size;
  const totalVoters = new Set(voterRows.map((v) => v.voterTeamId)).size;

  const nameByKey = new Map<string, string>();
  for (const list of Object.values(ballots)) for (const c of list) nameByKey.set(c.key, cleanName(c.name));

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Award Voting — Admin" subtitle={`${season} · ${league} · running tally (admin-only)`} />
      <AwardVotingAdmin season={season} league={league} status={status} />

      <div className="text-sm text-slate-400">
        Ballots in: <b className="text-slate-200">{totalVoters}</b> clubs · <b className="text-emerald-400">{humanVoters}</b> human GM{humanVoters === 1 ? "" : "s"} · {totalVoters - humanVoters} AI · {teams.length} clubs total.
        <span className="text-slate-600"> GMs never see these totals.</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {VOTED_AWARDS.map((a) => {
          const rows = (tally[a.key] ?? []).slice(0, a.ballot);
          const max = rows[0]?.points || 1;
          return (
            <Card key={a.key} title={`${a.icon} ${a.label}`} bodyClassName="p-3">
              {rows.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No votes yet.</p>
              ) : (
                <div className="space-y-1">
                  {rows.map((r, i) => (
                    <div key={r.key} className="flex items-center gap-2 text-sm">
                      <span className="w-5 text-right text-xs text-slate-500">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate ${i === 0 ? "font-semibold text-amber-300" : "text-slate-300"}`}>{nameByKey.get(r.key) ?? r.key}</span>
                          <span className="text-xs tabular-nums text-slate-400 shrink-0">{r.points} pts · {r.firsts}×1st</span>
                        </div>
                        <div className="h-1.5 rounded bg-slate-800 mt-0.5 overflow-hidden">
                          <div className={`h-full ${i === 0 ? "bg-amber-500" : "bg-slate-600"}`} style={{ width: `${Math.max(3, (r.points / max) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
