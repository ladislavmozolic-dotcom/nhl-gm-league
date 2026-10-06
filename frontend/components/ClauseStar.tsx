import { clauseTooltip } from "@/lib/playerName";

/** Gold ★ after a player's name when his contract carries a trade clause. Hover shows exactly which. */
export default function ClauseStar({ player }: { player: { tradeClause?: unknown; extClause?: unknown; noTradeTeams?: unknown; name?: string | null } }) {
  const tip = clauseTooltip(player);
  if (!tip) return null;
  return <span className="ml-1 text-amber-400 cursor-help" title={tip} aria-label={tip}>★</span>;
}
