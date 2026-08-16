import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { canManageTeam } from "@/lib/auth";
import { loadSettings } from "@/lib/sim/settings";
import { cleanName } from "@/lib/playerName";
import TeamCapView from "@/components/TeamCapView";
import ContractSection from "@/components/ContractSection";
import ClauseEditor from "@/components/ClauseEditor";

export const dynamic = "force-dynamic";

// Team-scoped salary-cap view — lives under the team layout so the team
// sub-nav stays visible when switching to "Salary". Includes the Contract
// section (renewals split into UFA / RFA / ELC) and, for the GM/admin, the
// no-trade / no-movement clause editor.
export default async function TeamSalaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true } });
  if (!team) notFound();

  const [canManage, settings] = await Promise.all([canManageTeam(team.id), loadSettings()]);
  let clauseUi: { players: { id: number; name: string; position: string; clause: string | null; noTradeTeams: number[] }[]; teams: { id: number; code: string }[] } | null = null;
  if (canManage && settings.clausesEnabled) {
    const [roster, teams] = await Promise.all([
      prisma.player.findMany({ where: { teamId: team.id, rosterType: "NHL" }, select: { id: true, name: true, position: true, tradeClause: true, noTradeTeams: true }, orderBy: [{ capHit: "desc" }] }),
      prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true }, orderBy: { code: "asc" } }),
    ]);
    clauseUi = {
      players: roster.map((p) => ({ id: p.id, name: cleanName(p.name), position: p.position ?? "", clause: p.tradeClause, noTradeTeams: p.noTradeTeams ?? [] })),
      teams: teams.map((t) => ({ id: t.id, code: t.code ?? String(t.id) })),
    };
  }

  return (
    <div className="space-y-5">
      <TeamCapView slug={slug} />
      <ContractSection teamId={team.id} />
      {clauseUi && <ClauseEditor teamId={team.id} players={clauseUi.players} teams={clauseUi.teams} />}
    </div>
  );
}
