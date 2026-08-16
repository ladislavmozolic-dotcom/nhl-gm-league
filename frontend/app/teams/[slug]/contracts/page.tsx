import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { loadSettings } from "@/lib/sim/settings";
import { cleanName } from "@/lib/playerName";
import ContractSection from "@/components/ContractSection";
import ClauseEditor from "@/components/ClauseEditor";

export const dynamic = "force-dynamic";

// Team Contracts — your own players whose deals are ending (re-sign them), plus
// the no-trade / no-movement clause editor. The salary-cap view is its own page.
export default async function TeamContractsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true } });
  if (!team) notFound();

  // clauses are anchored to the player at signing — only the commissioner edits them
  const [admin, settings] = await Promise.all([isAdmin(), loadSettings()]);
  let clauseUi: { players: { id: number; name: string; position: string; clause: string | null; noTradeTeams: number[] }[]; teams: { id: number; code: string }[] } | null = null;
  if (admin && settings.clausesEnabled) {
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
      <ContractSection teamId={team.id} />
      {clauseUi && <ClauseEditor teamId={team.id} players={clauseUi.players} teams={clauseUi.teams} />}
    </div>
  );
}
