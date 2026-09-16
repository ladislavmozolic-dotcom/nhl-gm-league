"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { groupRoster, RosterSection } from "@/components/TeamRosterTable";
import { cleanName } from "@/lib/playerName";
import { Card } from "@/components/ui";

/** Client roster with a name-search box over the Forwards/Defensemen/Goalies tables. */
type OfferResult = { ok: boolean; error?: string; name?: string };

export default function RosterView({ players, dressedIds, hideAttrs = false, farm = false, teamSlug, offerTwoWayAction }: {
  players: any[]; dressedIds?: number[]; hideAttrs?: boolean; farm?: boolean; teamSlug?: string;
  offerTwoWayAction?: (slug: string, playerId: number, salary: number, years: number) => Promise<OfferResult>;
}) {
  const [q, setQ] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const query = q.trim().toLowerCase();

  const filtered = useMemo(
    () => (query ? players.filter((p) => cleanName(p.name ?? "").toLowerCase().includes(query)) : players),
    [players, query]
  );

  // Non-roster = injured players, plus (when lines are set) anyone on the roster
  // not iced in the current lineup. They come out of the main tables and list
  // together below the goalies.
  const dressed = useMemo(() => new Set(dressedIds ?? []), [dressedIds]);
  // "lines are set" only if at least one SKATER is dressed — a lineup with just the
  // two goalies filled (empty forward/defense lines) must NOT flag every skater as
  // non-roster.
  const hasLines = filtered.some((p) => !p.isGoalie && dressed.has(p.id));
  const isNonRoster = (p: any) => (p.injuryDaysLeft ?? 0) > 0 || (hasLines && !dressed.has(p.id));
  const active = filtered.filter((p) => !isNonRoster(p));
  const nonRoster = filtered.filter(isNonRoster);

  const g = groupRoster(active);
  const gn = groupRoster(nonRoster);

  const offerTwoWay = offerTwoWayAction && teamSlug ? (player: any) => {
    const salaryRaw = window.prompt(`NHL salary for ${player.name} (minimum $775,000; AHL salary stays $100,000):`, "800000");
    if (salaryRaw == null) return;
    const yearsRaw = window.prompt("Contract length in years:", "1");
    if (yearsRaw == null) return;
    const salary = Number(salaryRaw.replace(/[^0-9.]/g, ""));
    const years = Number(yearsRaw);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await offerTwoWayAction(teamSlug, player.id, salary, years);
        setMessage(result.ok ? `✓ ${result.name ?? player.name} accepted the two-way contract.` : result.error ?? "The player rejected the offer.");
        if (result.ok) router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "The offer couldn't be sent.");
      }
    });
  } : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 px-1">
        <div className="relative">
          <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search player…"
            className="w-56 max-w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
        </div>
        {query && <span className="text-xs text-slate-500">{filtered.length} match{filtered.length === 1 ? "" : "es"}</span>}
        {pending && <span className="text-xs text-blue-300">Sending offer…</span>}
      </div>
      {message && <div className={`text-sm rounded-lg border px-3 py-2 ${message.startsWith("✓") ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-300" : "border-red-800/50 bg-red-950/30 text-red-300"}`}>{message}</div>}

      {filtered.length === 0 ? (
        <Card><p className="text-slate-500 text-center py-8">No players match “{q}”.</p></Card>
      ) : (
        <div className="space-y-6">
          {g.forwards.length > 0 && <RosterSection title="Forwards" players={g.forwards} farm={farm} hideAttrs={hideAttrs} onOfferTwoWay={offerTwoWay} />}
          {g.defense.length > 0 && <RosterSection title="Defensemen" players={g.defense} farm={farm} hideAttrs={hideAttrs} onOfferTwoWay={offerTwoWay} />}
          {g.goalies.length > 0 && <RosterSection title="Goalies" players={g.goalies} farm={farm} hideAttrs={hideAttrs} onOfferTwoWay={offerTwoWay} />}
          {nonRoster.length > 0 && (
            <div className="space-y-4">
              <div className="px-1 pt-2 border-t border-slate-800">
                <p className="text-xs text-slate-500 pt-3">Injured or not in the current lineup — dressed players show above.</p>
              </div>
              {gn.forwards.length > 0 && <RosterSection title="Non-roster · Forwards" players={gn.forwards} hideAttrs={hideAttrs} />}
              {gn.defense.length > 0 && <RosterSection title="Non-roster · Defensemen" players={gn.defense} hideAttrs={hideAttrs} />}
              {gn.goalies.length > 0 && <RosterSection title="Non-roster · Goalies" players={gn.goalies} hideAttrs={hideAttrs} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
