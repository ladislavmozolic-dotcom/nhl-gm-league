import { CLAUSE_LABEL, clauseOf } from "@/lib/playerName";

/** Gold ★ after a player's name when his contract carries a trade clause. Hover shows which. */
export default function ClauseStar({ player }: { player: { tradeClause?: unknown; name?: string | null } }) {
  const c = clauseOf(player);
  if (!c) return null;
  return <span className="ml-1 text-amber-400" title={CLAUSE_LABEL[c]} aria-label={CLAUSE_LABEL[c]}>★</span>;
}
