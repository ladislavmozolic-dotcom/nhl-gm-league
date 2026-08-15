"use client";

import { useMemo, useState } from "react";
import { groupRoster, RosterSection } from "@/components/TeamRosterTable";
import { cleanName } from "@/lib/playerName";
import { Card } from "@/components/ui";

/** Client roster with a name-search box over the Forwards/Defensemen/Goalies tables. */
export default function RosterView({ players }: { players: any[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const filtered = useMemo(
    () => (query ? players.filter((p) => cleanName(p.name ?? "").toLowerCase().includes(query)) : players),
    [players, query]
  );

  const g = groupRoster(filtered);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 px-1">
        <div className="relative">
          <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search player…"
            className="w-56 max-w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
        </div>
        {query && <span className="text-xs text-slate-500">{filtered.length} match{filtered.length === 1 ? "" : "es"}</span>}
      </div>

      {filtered.length === 0 ? (
        <Card><p className="text-slate-500 text-center py-8">No players match “{q}”.</p></Card>
      ) : (
        <div className="space-y-6">
          {g.forwards.length > 0 && <RosterSection title="Forwards" players={g.forwards} />}
          {g.defense.length > 0 && <RosterSection title="Defensemen" players={g.defense} />}
          {g.goalies.length > 0 && <RosterSection title="Goalies" players={g.goalies} />}
        </div>
      )}
    </div>
  );
}
