"use client";

import { useState } from "react";
import { clauseOf, cleanName } from "@/lib/playerName";
import { ClauseModal, type ClauseTeam } from "@/components/ClauseBadge";
import { CURRENT_SEASON_START, seasonLabel } from "@/lib/finance";

let teamCache: ClauseTeam[] | null = null;

/** Gold ★ after a player's name when his contract carries a trade clause. Click opens the clause window. */
export default function ClauseStar({ player }: { player: { tradeClause?: unknown; extClause?: unknown; noTradeTeams?: unknown; extNoTradeTeams?: unknown; contractYears?: number | null; name?: string | null } }) {
  const cur = clauseOf(player);
  const ext = !cur ? clauseOf({ tradeClause: player.extClause }) : null;
  const clause = cur ?? ext;
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<ClauseTeam[]>(teamCache ?? []);
  if (!clause) return null;

  const ids = ((cur ? player.noTradeTeams : player.extNoTradeTeams) as number[] | undefined) ?? [];
  const show = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setOpen(true);
    if (!teamCache) {
      try { teamCache = await (await fetch("/api/teams")).json(); setTeams(teamCache ?? []); } catch { /* modal still shows without logos */ }
    }
  };
  const protectedTeams = teams.filter((t) => ids.includes(t.id));
  const from = seasonLabel(CURRENT_SEASON_START + (player.contractYears ?? 0));

  return (
    <>
      <span role="button" tabIndex={0} onClick={show} onKeyDown={(e) => e.key === "Enter" && show(e as unknown as React.MouseEvent)}
        className="ml-1 text-amber-400 cursor-pointer hover:text-amber-300" title="Click for clause details" aria-label="Trade clause details">★</span>
      {open && (
        <ClauseModal clause={clause} pending={!cur} effectiveFrom={from} teams={protectedTeams} playerName={cleanName(player.name ?? "")} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
