"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { groupRoster, RosterSection, salaryOf, fmtM } from "@/components/TeamRosterTable";
import { cleanName } from "@/lib/playerName";
import { Card } from "@/components/ui";
import { useLang } from "@/components/LangProvider";

type OfferResult = { ok: boolean; error?: string; name?: string };

export default function RosterView({
  players,
  dressedIds,
  hideAttrs = false,
  farm = false,
  teamSlug,
  offerTwoWayAction,
}: {
  players: any[];
  dressedIds?: number[];
  hideAttrs?: boolean;
  farm?: boolean;
  teamSlug?: string;
  offerTwoWayAction?: (slug: string, playerId: number, salary: number, years: number) => Promise<OfferResult>;
}) {
  const [q, setQ] = useState("");
  const [posFilter, setPosFilter] = useState<"ALL" | "F" | "D" | "G">("ALL");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const lang = useLang();
  const isEn = lang === "en";

  const query = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    return players.filter((p) => {
      if (query && !cleanName(p.name ?? "").toLowerCase().includes(query)) return false;
      if (posFilter === "F" && (p.isGoalie || (!p.position?.includes("C") && !p.position?.includes("W") && !p.position?.includes("F"))))
        return false;
      if (posFilter === "D" && (p.isGoalie || (!p.position?.includes("D") && !/(^|\/)D(\/|$)/.test(p.position ?? ""))))
        return false;
      if (posFilter === "G" && !p.isGoalie) return false;
      return true;
    });
  }, [players, query, posFilter]);

  // Non-roster = injured players, plus (when lines are set) anyone on the roster not iced in the current lineup.
  const dressed = useMemo(() => new Set(dressedIds ?? []), [dressedIds]);
  const hasLines = filtered.some((p) => !p.isGoalie && dressed.has(p.id));
  const isNonRoster = (p: any) => (p.injuryDaysLeft ?? 0) > 0 || (hasLines && !dressed.has(p.id));

  const active = filtered.filter((p) => !isNonRoster(p));
  const nonRoster = filtered.filter(isNonRoster);

  const g = groupRoster(active);
  const gn = groupRoster(nonRoster);

  // Overall quick stats
  const totalSal = players.reduce((s, p) => s + salaryOf(p), 0);
  const avgAge = players.length > 0 ? (players.reduce((s, p) => s + (p.age || 0), 0) / players.length).toFixed(1) : "—";
  const avgOv = players.length > 0 ? (players.reduce((s, p) => s + (p.overall || 0), 0) / players.length).toFixed(1) : "—";

  const offerTwoWay =
    offerTwoWayAction && teamSlug
      ? (player: any) => {
          const salaryPrompt = isEn
            ? `NHL salary for ${player.name} (minimum $775,000; AHL salary stays $100,000):`
            : `NHL plat pre hráča ${player.name} (minimum $775,000; AHL plat zostáva $100,000):`;
          const salaryRaw = window.prompt(salaryPrompt, "800000");
          if (salaryRaw == null) return;
          const yearsPrompt = isEn ? "Contract length in years:" : "Dĺžka zmluvy v rokoch:";
          const yearsRaw = window.prompt(yearsPrompt, "1");
          if (yearsRaw == null) return;
          const salary = Number(salaryRaw.replace(/[^0-9.]/g, ""));
          const years = Number(yearsRaw);
          setMessage(null);
          startTransition(async () => {
            try {
              const result = await offerTwoWayAction(teamSlug, player.id, salary, years);
              setMessage(
                result.ok
                  ? isEn
                    ? `✓ ${result.name ?? player.name} accepted the two-way contract.`
                    : `✓ ${result.name ?? player.name} prijal dvojcestnú zmluvu.`
                  : result.error ?? (isEn ? "The player rejected the offer." : "Hráč ponuku odmietol.")
              );
              if (result.ok) router.refresh();
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : isEn ? "The offer couldn't be sent." : "Ponuku sa nepodarilo odoslať."
              );
            }
          });
        }
      : undefined;

  return (
    <div className="space-y-6">
      {/* Top HUD Overview & Search bar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur-md space-y-4">
        {/* KPI Mini Deck */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-850/60 border border-slate-800 rounded-xl px-3.5 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              {isEn ? "TOTAL PLAYERS" : "POČET HRÁČOV"}
            </span>
            <span className="text-xl font-black text-white tabular-nums mt-0.5 block">
              {players.length}
            </span>
            <span className="text-[11px] text-slate-400">
              {active.length} {isEn ? "active" : "aktívnych"} · {nonRoster.length} {isEn ? "non-roster" : "mimo"}
            </span>
          </div>

          <div className="bg-slate-850/60 border border-slate-800 rounded-xl px-3.5 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              {isEn ? "AVG OVERALL" : "PRIEMER OVR"}
            </span>
            <span className="text-xl font-black text-emerald-400 tabular-nums mt-0.5 block">
              {avgOv}
            </span>
            <span className="text-[11px] text-slate-400">
              {isEn ? "Across roster" : "Celá súpiska"}
            </span>
          </div>

          <div className="bg-slate-850/60 border border-slate-800 rounded-xl px-3.5 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              {isEn ? "AVG AGE" : "PRIEMER VEKU"}
            </span>
            <span className="text-xl font-black text-amber-400 tabular-nums mt-0.5 block">
              {avgAge} <span className="text-xs font-normal text-slate-500">{isEn ? "yrs" : "rokov"}</span>
            </span>
            <span className="text-[11px] text-slate-400">
              {isEn ? "Roster core" : "Vekový priemer"}
            </span>
          </div>

          <div className="bg-slate-850/60 border border-slate-800 rounded-xl px-3.5 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              {isEn ? (farm ? "AHL PAYROLL" : "CAP COMMITTED") : farm ? "AHL VÝPLATY" : "CAP ZÁVÄZKY"}
            </span>
            <span className="text-xl font-black text-sky-400 tabular-nums mt-0.5 block">
              {fmtM(totalSal)}
            </span>
            <span className="text-[11px] text-slate-400">
              {isEn ? (farm ? "Farm contracts" : "Active cap sum") : farm ? "Farmárske zmluvy" : "Súčet cap hitov"}
            </span>
          </div>
        </div>

        {/* Search & Position Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={isEn ? "Search player by name…" : "Hľadať hráča podľa mena…"}
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Position Quick Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/60 text-xs self-start sm:self-auto">
            {(
              [
                { id: "ALL", label: isEn ? "All" : "Všetci" },
                { id: "F", label: isEn ? "Forwards" : "Útočníci" },
                { id: "D", label: isEn ? "Defense" : "Obrana" },
                { id: "G", label: isEn ? "Goalies" : "Brankári" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPosFilter(tab.id)}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  posFilter === tab.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {query && (
          <div className="text-xs text-slate-400">
            {filtered.length}{" "}
            {isEn
              ? filtered.length === 1
                ? "match"
                : "matches"
              : filtered.length === 1
              ? "zhoda"
              : "zhôd"}
          </div>
        )}
      </div>

      {pending && (
        <div className="text-xs text-blue-300 animate-pulse">
          {isEn ? "Sending offer…" : "Odosielam ponuku…"}
        </div>
      )}
      {message && (
        <div
          className={`text-sm rounded-xl border px-4 py-3 shadow-md ${
            message.startsWith("✓")
              ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-300"
              : "border-rose-800/50 bg-rose-950/30 text-rose-300"
          }`}
        >
          {message}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <p className="text-slate-500 text-center py-10 text-sm">
            {isEn ? `No players match “${q}”.` : `Žiaden hráč nezodpovedá hľadaniu „${q}“.`}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {g.forwards.length > 0 && (
            <RosterSection
              title={isEn ? "Forwards" : "Útočníci"}
              players={g.forwards}
              farm={farm}
              hideAttrs={hideAttrs}
              onOfferTwoWay={offerTwoWay}
            />
          )}
          {g.defense.length > 0 && (
            <RosterSection
              title={isEn ? "Defensemen" : "Obrancovia"}
              players={g.defense}
              farm={farm}
              hideAttrs={hideAttrs}
              onOfferTwoWay={offerTwoWay}
            />
          )}
          {g.goalies.length > 0 && (
            <RosterSection
              title={isEn ? "Goalies" : "Brankári"}
              players={g.goalies}
              farm={farm}
              hideAttrs={hideAttrs}
              onOfferTwoWay={offerTwoWay}
            />
          )}

          {nonRoster.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-800/80">
              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/70 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="text-sm">🩹</span>
                  <span>
                    {isEn
                      ? "Injured or healthy scratches (not in the active lineup). Dressed players appear above."
                      : "Zranení hráči alebo zdraví náhradníci (mimo zápasovej zostavy). Nasadení hráči sú uvedení vyššie."}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {nonRoster.length} {isEn ? "players" : "hráčov"}
                </span>
              </div>

              {gn.forwards.length > 0 && (
                <RosterSection
                  title={isEn ? "Non-roster · Forwards" : "Mimo zostavy · Útočníci"}
                  players={gn.forwards}
                  hideAttrs={hideAttrs}
                  accent="text-slate-300"
                />
              )}
              {gn.defense.length > 0 && (
                <RosterSection
                  title={isEn ? "Non-roster · Defensemen" : "Mimo zostavy · Obrancovia"}
                  players={gn.defense}
                  hideAttrs={hideAttrs}
                  accent="text-slate-300"
                />
              )}
              {gn.goalies.length > 0 && (
                <RosterSection
                  title={isEn ? "Non-roster · Goalies" : "Mimo zostavy · Brankári"}
                  players={gn.goalies}
                  hideAttrs={hideAttrs}
                  accent="text-slate-300"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
