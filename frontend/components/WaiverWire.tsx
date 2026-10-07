"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/playerAvatar";
import { money } from "@/lib/finance";
import { claimWaiverAction } from "@/app/waivers/actions";
import { useLang } from "@/components/LangProvider";
import type { WaiverRow, WaiverPriorityRow } from "@/lib/waivers-server";

export type MyTeamInfo = {
  id: number;
  name: string;
  code: string | null;
  logoUrl: string | null;
  slug?: string | null;
} | null;

const POS_COLORS: Record<string, string> = {
  C: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  LW: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  RW: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  D: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  G: "bg-amber-500/20 text-amber-300 border-amber-500/40",
};

const clauseTag = (c?: string | null) =>
  c === "NMC" ? "NMC" : c === "M_NTC" ? "M-NTC" : c === "NTC" ? "NTC" : null;

function formatCap(cap?: number | null) {
  if (!cap) return "—";
  if (cap >= 1_000_000) {
    return `$${(cap / 1_000_000).toFixed(2).replace(/\.00$/, "")}M`;
  }
  return `$${Math.round(cap / 1000)}k`;
}

export default function WaiverWire({
  waivers,
  myTeamId,
  myTeam,
  inSeason,
  order,
  waiversEnabled = true,
}: {
  waivers: WaiverRow[];
  myTeamId: number | null;
  myTeam?: MyTeamInfo;
  inSeason: boolean;
  order: WaiverPriorityRow[];
  waiversEnabled?: boolean;
}) {
  const lang = useLang();
  const isCs = lang === "cs";

  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: "ok" | "err"; s: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"ALL" | "TOP10" | "MINE">("ALL");

  const myPriorityRank = useMemo(() => {
    if (!myTeamId || order.length === 0) return null;
    return order.find((o) => o.teamId === myTeamId)?.rank ?? null;
  }, [myTeamId, order]);

  const filteredOrder = useMemo(() => {
    let list = order;
    if (filterTab === "TOP10") {
      list = list.slice(0, 10);
    } else if (filterTab === "MINE" && myTeamId) {
      list = list.filter((t) => t.teamId === myTeamId);
    }

    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (t) =>
        t.code.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        String(t.rank) === q
    );
  }, [order, filterTab, myTeamId, search]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      setMsg(r.ok ? { t: "ok", s: okMsg } : { t: "err", s: r.error ?? (isCs ? "Nastala chyba." : "Failed.") });
    });

  if (!waiversEnabled) {
    return (
      <div className="space-y-6">
        <div className="pb-2 border-b border-slate-800/80">
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Waiver Wire</h1>
          <p className="text-sm text-slate-400 mt-1">
            {isCs
              ? "Waiver listina a prioritné poradie nárokov"
              : "24-hour waiver window to assign players to the AHL & full-league claim priority order."}
          </p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-sm text-slate-400">
          {isCs ? (
            <p>
              Waiver listina je v tejto lige <b>vypnutá</b> — kluby presúvajú hráčov medzi NHL a AHL farmou voľne cez správu zostavy bez nutnosti waiveru.
            </p>
          ) : (
            <p>
              The waiver wire is <b>turned off</b> in this league — clubs move players between the NHL and their AHL affiliate freely with no claims. The commissioner can enable waivers in engine settings.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-950/60 border border-sky-800/50 text-[11px] font-bold text-sky-400 uppercase tracking-widest mb-2 shadow-sm">
            <span>🛡️</span> {isCs ? "UNHL Transakcie · 24h Okno" : "UNHL Transactions · 24h Window"}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Waiver Wire
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            {isCs
              ? "24-hodinové waiver okno na presun hráčov na farmu v AHL a prioritné poradie nárokov (Claims)."
              : "24-hour waiver window to assign players to the AHL & full-league claim priority order."}
          </p>
        </div>

        {myTeam && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg backdrop-blur-md self-start md:self-auto">
            {myTeam.logoUrl && (
              <img src={myTeam.logoUrl} alt="" className="w-8 h-8 object-contain shrink-0" />
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-400">{isCs ? "Váš tím:" : "Your club:"}</span>
                <span className="text-xs font-black text-white">{myTeam.name}</span>
              </div>
              <div className="text-[11px] text-sky-400 font-bold">
                {myPriorityRank ? (
                  <span>{isCs ? `#${myPriorityRank} v poradí nárokov` : `#${myPriorityRank} in claim priority`}</span>
                ) : (
                  <span>{isCs ? "Prihlásený GM" : "Signed-in GM"}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stat Tiles Deck */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Stat 1: Active Count */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              {isCs ? "Na waiveri" : "On Waivers"}
            </span>
            <span className="text-base">📋</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {waivers.length}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isCs
                ? waivers.length === 1
                  ? "1 aktívny hráč"
                  : waivers.length >= 2 && waivers.length <= 4
                  ? `${waivers.length} aktívni hráči`
                  : `${waivers.length} aktívnych hráčov`
                : waivers.length === 1
                ? "1 active player"
                : `${waivers.length} active players`}
            </p>
          </div>
        </div>

        {/* Stat 2: My Priority Rank */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              {isCs ? "Priorita klubu" : "Your Priority"}
            </span>
            <span className="text-base">🎯</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-sky-400 tracking-tight">
              {myPriorityRank ? `#${myPriorityRank}` : myTeam ? myTeam.code : "—"}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {myTeam ? myTeam.name : isCs ? "Prihláste sa ako GM" : "Sign in as GM"}
            </p>
          </div>
        </div>

        {/* Stat 3: Claim Key Rule */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              {isCs ? "Kľúč priorít" : "Priority Rule"}
            </span>
            <span className="text-base">⚖️</span>
          </div>
          <div>
            <div className="text-base sm:text-lg font-black text-amber-300 truncate tracking-tight">
              {inSeason ? "Reverse Standings" : "Claim Queue"}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {inSeason
                ? isCs
                  ? "Podľa tabuľky (najhorší prvý)"
                  : "Worst record in standings first"
                : isCs
                ? "Rotujúci rad bez nároku"
                : "Queue (longest since claim)"}
            </p>
          </div>
        </div>

        {/* Stat 4: Window & Recall Pass */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              {isCs ? "Ochranné okno" : "Waiver Window"}
            </span>
            <span className="text-base">⏱️</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-purple-300 tracking-tight">
              {isCs ? "24 hodín" : "24 Hours"}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isCs ? "Recall pass: 30 dní / 10 zápasov" : "Recall pass: 30 days / 10 games"}
            </p>
          </div>
        </div>
      </div>

      {/* Global Action Banner */}
      {msg && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-center justify-between gap-3 shadow-lg ${
            msg.t === "ok"
              ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
              : "bg-rose-950/60 border-rose-500/40 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span>{msg.t === "ok" ? "✓" : "⚠️"}</span>
            <span className="font-semibold">{msg.s}</span>
          </div>
          <button
            onClick={() => setMsg(null)}
            className="text-xs font-bold text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Section 1: Active Waivers */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-black text-white uppercase tracking-wide">
              {isCs ? "Aktívni hráči na waiver listine" : "Active Players on Waivers"}
            </h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
              {waivers.length}
            </span>
          </div>
        </div>

        {waivers.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800/90 rounded-3xl p-8 sm:p-12 text-center shadow-xl backdrop-blur-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-3xl shadow-inner">
              🛡️
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              {isCs
                ? "Momentálne sa na waiver listine nenachádza žiaden hráč"
                : "No players are on waivers right now"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
              {isCs
                ? "Všetci hráči boli úspešne priradení do zostáv alebo ich 24-hodinové okno vypršalo. Ak klub umiestni hráča na waiver listinu pred odoslaním do AHL, objaví sa tu s možnosťou prednostného nároku."
                : "All waived players have cleared to the AHL or were claimed by other clubs. When a club exposes a player on waivers before assigning him to the farm, he will appear here for 24 hours."}
            </p>
            {myTeam?.slug && (
              <div className="mt-6">
                <Link
                  href={`/teams/${myTeam.slug}/roster/edit`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 transition-colors shadow-sm"
                >
                  <span>📋</span> {isCs ? "Prejsť na správu zostavy vášho tímu →" : "Manage your team roster →"}
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {waivers.map((w) => {
              const mine = w.fromTeamId === myTeamId;
              const alreadyClaimed = myTeamId != null && w.claims.some((c) => c.teamId === myTeamId);
              const tag = clauseTag(w.clause);
              const posColor = POS_COLORS[w.position] ?? "bg-slate-800 text-slate-300 border-slate-700";

              return (
                <div
                  key={w.id}
                  className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-xl transition-all hover:shadow-2xl"
                >
                  <div className="space-y-3.5">
                    {/* Card Top: Position & Clause & Timestamp */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg border ${posColor}`}>
                          {w.position || "—"}
                        </span>
                        {tag && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {tag}
                          </span>
                        )}
                        {w.age != null && (
                          <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                            {w.age} {isCs ? "r." : "yo"}
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                        <span>⏱️</span>
                        {new Date(w.placedAt).toLocaleString(isCs ? "sk-SK" : "en-US", {
                          day: "numeric",
                          month: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Player Info */}
                    <div className="flex items-center gap-3">
                      <PlayerAvatar
                        src={w.photoUrl ?? null}
                        alt={w.playerName}
                        size={48}
                      />
                      <div className="min-w-0 flex-1">
                        {w.playerSlug ? (
                          <Link
                            href={`/players/${w.playerSlug}`}
                            className="text-base font-bold text-white hover:text-sky-400 transition-colors truncate block"
                          >
                            {w.playerName}
                          </Link>
                        ) : (
                          <span className="text-base font-bold text-white truncate block">
                            {w.playerName}
                          </span>
                        )}
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <span>{isCs ? "Umiestnil tím:" : "Waived by:"}</span>
                          <span className="font-bold text-slate-200 inline-flex items-center gap-1">
                            {w.fromLogoUrl && (
                              <img src={w.fromLogoUrl} alt="" className="w-3.5 h-3.5 object-contain" />
                            )}
                            {w.fromName ? `${w.fromName} (${w.fromCode})` : w.fromCode}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Cap & Contract Specs */}
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Cap Hit
                        </div>
                        <div className="font-mono font-bold text-amber-300 text-sm">
                          {formatCap(w.capHit)}
                          <span className="text-[10px] text-slate-400 font-normal ml-0.5">{isCs ? "/rok" : "/yr"}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          {isCs ? "Platnosť zmluvy" : "Contract Term"}
                        </div>
                        <div className="font-bold text-slate-200">
                          {w.contractYears
                            ? isCs
                              ? `${w.contractYears} ${w.contractYears === 1 ? "rok" : w.contractYears <= 4 ? "roky" : "rokov"}`
                              : `${w.contractYears} ${w.contractYears === 1 ? "year" : "years"}`
                            : money(w.capHit)}
                        </div>
                      </div>
                    </div>

                    {/* Claims Section */}
                    <div className="pt-1">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>{isCs ? "Záujem o hráča" : "Submitted Claims"}</span>
                        <span className="font-mono text-xs text-slate-300">
                          {w.claims.length} {isCs ? (w.claims.length === 1 ? "tím" : "tímov") : (w.claims.length === 1 ? "claim" : "claims")}
                        </span>
                      </div>
                      {w.claims.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {w.claims.map((c) => (
                            <span
                              key={c.teamId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs font-semibold text-slate-300"
                            >
                              {c.logoUrl && <img src={c.logoUrl} alt="" className="w-3.5 h-3.5 object-contain" />}
                              <span>{c.code}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">
                          {isCs ? "Doposiaľ žiadny uplatnený nárok." : "No claims submitted yet."}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Area */}
                  <div className="pt-4 mt-3 border-t border-slate-800/80">
                    {myTeamId != null ? (
                      mine ? (
                        <div className="text-center py-2 px-3 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-400 font-medium">
                          {isCs ? "Váš hráč (nevratný waiver)" : "Your player (waiving is final)"}
                        </div>
                      ) : alreadyClaimed ? (
                        <div className="text-center py-2 px-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm">
                          <span>✓</span> {isCs ? "Nárokované (Čaká na vyhodnotenie)" : "Claimed ✓ (Awaiting resolution)"}
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            run(
                              () => claimWaiverAction(w.id, myTeamId),
                              isCs
                                ? `Nárok na hráča ${w.playerName} bol úspešne odoslaný!`
                                : `Claim for ${w.playerName} submitted successfully!`
                            )
                          }
                          disabled={pending}
                          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-sky-600/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <span>⚡</span> {isCs ? "Požiadať o hráča (Claim)" : "Submit Claim"}
                        </button>
                      )
                    ) : (
                      <div className="text-center py-2 px-3 rounded-xl bg-slate-800/30 text-xs text-slate-400">
                        {isCs ? "Pre uplatnenie nároku sa prihláste ako GM." : "Sign in as GM to claim players."}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2: Claim Priority Order */}
      {order.length > 0 && (
        <section className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white uppercase tracking-wide">
                  {isCs ? "Prioritné poradie nárokov" : "Claim Priority Order"}
                </h2>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                  {order.length} {isCs ? "tímov" : "clubs"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isCs ? (
                  <>
                    Kto vyhrá sporný nárok pri viacerých záujemcoch — {inSeason ? (
                      <>podľa aktuálnej tabuľky (<b>najhorší tím má najvyššiu prioritu</b>)</>
                    ) : (
                      <>podľa rotujúcej fronty nárokov</>
                    )}. Klub po úspešnom nároku klesá na 32. miesto.
                  </>
                ) : (
                  <>
                    Who wins a contested claim when multiple clubs claim — {inSeason ? (
                      <>currently the <b>worst team in the standings gets priority</b></>
                    ) : (
                      <>currently a <b>claim-order queue</b> (whoever has gone longest without winning a claim)</>
                    )}. A club drops to 32nd the moment it wins a claim.
                  </>
                )}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {/* Filter Tabs */}
              <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold">
                <button
                  onClick={() => setFilterTab("ALL")}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    filterTab === "ALL"
                      ? "bg-blue-600 text-white font-bold shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {isCs ? `Všetky (${order.length})` : `All (${order.length})`}
                </button>
                <button
                  onClick={() => setFilterTab("TOP10")}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    filterTab === "TOP10"
                      ? "bg-blue-600 text-white font-bold shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Top 10
                </button>
                {myTeamId && (
                  <button
                    onClick={() => setFilterTab("MINE")}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      filterTab === "MINE"
                        ? "bg-blue-600 text-white font-bold shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {isCs ? "Váš tím" : "Your Team"}
                  </button>
                )}
              </div>

              {/* Search input */}
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={isCs ? "Filtrovať tím..." : "Filter club..."}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-32 sm:w-40"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Teams Priority Grid */}
          <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-3 sm:p-4 shadow-xl">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2">
              {filteredOrder.map((t) => {
                const isMine = t.teamId === myTeamId;
                const isTop1 = t.rank === 1;
                const isTop3 = t.rank <= 3;

                return (
                  <div
                    key={t.teamId}
                    title={`${t.name} (${isCs ? "Poradie" : "Rank"}: #${t.rank})`}
                    className={`group relative flex items-center gap-2 p-2 rounded-xl border transition-all ${
                      isMine
                        ? "bg-sky-950/60 border-sky-500/80 shadow-[0_0_15px_rgba(14,165,233,0.3)] ring-1 ring-sky-500/50"
                        : isTop1
                        ? "bg-amber-950/30 border-amber-500/50 text-amber-200"
                        : isTop3
                        ? "bg-slate-800/50 border-slate-700 text-slate-200"
                        : "bg-slate-950/40 border-slate-800/70 hover:border-slate-700 text-slate-300"
                    }`}
                  >
                    {/* Rank Badge */}
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-black shrink-0 tabular-nums ${
                        isTop1
                          ? "bg-amber-500 text-slate-950"
                          : t.rank === 2
                          ? "bg-slate-300 text-slate-950"
                          : t.rank === 3
                          ? "bg-amber-700 text-white"
                          : isMine
                          ? "bg-sky-500 text-slate-950 font-black"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {t.rank}
                    </span>

                    {/* Logo */}
                    {t.logoUrl ? (
                      <img
                        src={t.logoUrl}
                        alt=""
                        className="w-5 h-5 object-contain shrink-0 group-hover:scale-110 transition-transform"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-800 shrink-0" />
                    )}

                    {/* Team Code & Indicator */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black truncate ${isMine ? "text-sky-300" : "text-white"}`}>
                          {t.code}
                        </span>
                        {isTop1 && <span className="text-[10px]" title={isCs ? "1. priorita" : "1st priority"}>👑</span>}
                        {isMine && !isTop1 && (
                          <span className="text-[9px] font-extrabold text-sky-400 tracking-tighter">
                            {isCs ? "VÁŠ" : "YOU"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredOrder.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs">
                {isCs ? "Žiadny tím nezodpovedá vyhľadávaniu." : "No teams matching your filter."}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Section 3: Rules & Guide */}
      <section className="space-y-4 pt-2">
        <h2 className="text-lg font-black text-white uppercase tracking-wide flex items-center gap-2">
          <span>📖</span> {isCs ? "Ako funguje Waiver Wire · Pravidlá ligy" : "How the Waiver Wire Works · League Rules"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Rule 1 */}
          <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center text-lg mb-3">
                ⏱️
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">
                {isCs ? "24-Hodinové okno" : "24-Hour Window"}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isCs
                  ? "Každý hráč s jednocestnou zmluvou musí pred odoslaním do farmárskej AHL stráviť 24 hodín na waiver listine. Počas tejto doby si ho môže nárokovať ktorýkoľvek iný klub."
                  : "A player on a one-way contract must spend 24 hours on waivers before being assigned to the AHL affiliate. Any other club can submit a claim during this window."}
              </p>
            </div>
          </div>

          {/* Rule 2 */}
          <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-lg mb-3">
                ⚖️
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">
                {isCs ? "Prioritný systém nárokov" : "Claim Priority Order"}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isCs
                  ? "V priebehu sezóny rozhoduje obrátené poradie ligovej tabuľky (najhorší tím má prednosť). Po úspešnom nároku klub automaticky klesá na 32. miesto v poradí."
                  : "In-season, claims follow reverse standings (worst record gets priority). Winning a claim moves that club to the back of the line (32nd)."}
              </p>
            </div>
          </div>

          {/* Rule 3 */}
          <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-lg mb-3">
                🚫
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">
                {isCs ? "NMC & NTC Klauzuly" : "NMC & NTC Clauses"}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isCs
                  ? "Doložka o neprenosnosti (NMC) úplne blokuje umiestnenie hráča na waiver. No-trade klauzula (NTC) waiver nezakazuje a hráča je možné ponúknuť."
                  : "A No-Movement Clause (NMC) blocks waivers entirely. A No-Trade Clause (NTC) does not block waivers — the player can still be waived."}
              </p>
            </div>
          </div>

          {/* Rule 4 */}
          <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center text-lg mb-3">
                🔄
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">
                {isCs ? "Pravidlo 30/10 (Recall pass)" : "Rule 30/10 (Recall Pass)"}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isCs
                  ? "Povolaný hráč z AHL môže byť poslaný späť bez waiveru, ak od jeho povolania neuplynulo viac ako 30 kalendárnych dní a neodohral viac ako 10 zápasov NHL."
                  : "A player called up from the farm can be returned without waivers if it has been 30 days or fewer and 10 NHL games or fewer since that recall."}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
