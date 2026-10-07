"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/playerAvatar";
import { money } from "@/lib/finance";
import { claimWaiverAction } from "@/app/waivers/actions";
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
}: {
  waivers: WaiverRow[];
  myTeamId: number | null;
  myTeam?: MyTeamInfo;
  inSeason: boolean;
  order: WaiverPriorityRow[];
}) {
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
      setMsg(r.ok ? { t: "ok", s: okMsg } : { t: "err", s: r.error ?? "Nastala chyba." });
    });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-950/60 border border-sky-800/50 text-[11px] font-bold text-sky-400 uppercase tracking-widest mb-2 shadow-sm">
            <span>🛡️</span> UNHL Transactions &bull; 24h Window
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Waiver Wire
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            24-hodinové waiver okno na presun hráčov na farmu v AHL a prioritné poradie nárokov (Claims).
          </p>
        </div>

        {myTeam && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg backdrop-blur-md self-start md:self-auto">
            {myTeam.logoUrl && (
              <img src={myTeam.logoUrl} alt="" className="w-8 h-8 object-contain shrink-0" />
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-400">Váš tím:</span>
                <span className="text-xs font-black text-white">{myTeam.name}</span>
              </div>
              <div className="text-[11px] text-sky-400 font-bold">
                {myPriorityRank ? (
                  <span>#{myPriorityRank} v poradí nárokov</span>
                ) : (
                  <span>Prihlásený GM</span>
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
              Na waiveri
            </span>
            <span className="text-base">📋</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {waivers.length}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {waivers.length === 1
                ? "1 aktívny hráč"
                : waivers.length >= 2 && waivers.length <= 4
                ? `${waivers.length} aktívni hráči`
                : `${waivers.length} aktívnych hráčov`}
            </p>
          </div>
        </div>

        {/* Stat 2: My Priority Rank */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Priorita klubu
            </span>
            <span className="text-base">🎯</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-sky-400 tracking-tight">
              {myPriorityRank ? `#${myPriorityRank}` : myTeam ? myTeam.code : "—"}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {myTeam ? myTeam.name : "Prihláste sa ako GM"}
            </p>
          </div>
        </div>

        {/* Stat 3: Claim Key Rule */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Kľúč priorít
            </span>
            <span className="text-base">⚖️</span>
          </div>
          <div>
            <div className="text-base sm:text-lg font-black text-amber-300 truncate tracking-tight">
              {inSeason ? "Reverse Standings" : "Claim Queue"}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {inSeason ? "Podľa tabuľky (najhorší prvý)" : "Rotujúci rad bez nároku"}
            </p>
          </div>
        </div>

        {/* Stat 4: Window & Recall Pass */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Ochranné okno
            </span>
            <span className="text-base">⏱️</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-purple-300 tracking-tight">
              24 hodín
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Recall pass: 30 dní / 10 zápasov
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
              Aktívni hráči na waiver listine
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
              Momentálne sa na waiver listine nenachádza žiaden hráč
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
              Všetci hráči boli úspešne priradení do zostáv alebo ich 24-hodinové okno vypršalo. Ak klub umiestni hráča na waiver listinu pred odoslaním do AHL, objaví sa tu s možnosťou prednostného nároku.
            </p>
            {myTeam?.slug && (
              <div className="mt-6">
                <Link
                  href={`/teams/${myTeam.slug}/roster/edit`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 transition-colors shadow-sm"
                >
                  <span>📋</span> Prejsť na správu zostavy vášho tímu &rarr;
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
                            {w.age} r.
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                        <span>⏱️</span>
                        {new Date(w.placedAt).toLocaleString("sk-SK", {
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
                          <span>Umiestnil tím:</span>
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
                          <span className="text-[10px] text-slate-400 font-normal ml-0.5">/rok</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Platnosť zmluvy
                        </div>
                        <div className="font-bold text-slate-200">
                          {w.contractYears
                            ? `${w.contractYears} ${w.contractYears === 1 ? "rok" : w.contractYears <= 4 ? "roky" : "rokov"}`
                            : money(w.capHit)}
                        </div>
                      </div>
                    </div>

                    {/* Claims Section */}
                    <div className="pt-1">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>Záujem o hráča</span>
                        <span className="font-mono text-xs text-slate-300">
                          {w.claims.length} {w.claims.length === 1 ? "tím" : w.claims.length >= 2 && w.claims.length <= 4 ? "tímy" : "tímov"}
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
                          Doposiaľ žiadny uplatnený nárok.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Area */}
                  <div className="pt-4 mt-3 border-t border-slate-800/80">
                    {myTeamId != null ? (
                      mine ? (
                        <div className="text-center py-2 px-3 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-400 font-medium">
                          Váš hráč (nevratný waiver)
                        </div>
                      ) : alreadyClaimed ? (
                        <div className="text-center py-2 px-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm">
                          <span>✓</span> Nárokované (Čaká na vyhodnotenie)
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            run(
                              () => claimWaiverAction(w.id, myTeamId),
                              `Nárok na hráča ${w.playerName} bol úspešne odoslaný!`
                            )
                          }
                          disabled={pending}
                          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-sky-600/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <span>⚡</span> Požiadať o hráča (Claim)
                        </button>
                      )
                    ) : (
                      <div className="text-center py-2 px-3 rounded-xl bg-slate-800/30 text-xs text-slate-400">
                        Pre uplatnenie nároku sa prihláste ako GM.
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
                  Prioritné poradie nárokov
                </h2>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                  {order.length} tímov
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Kto vyhrá sporný nárok pri viacerých záujemcoch — {inSeason ? (
                  <>podľa aktuálnej tabuľky (<b>najhorší tím má najvyššiu prioritu</b>)</>
                ) : (
                  <>podľa rotujúcej fronty nárokov</>
                )}. Klub po úspešnom nároku klesá na 32. miesto.
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
                  Všetky ({order.length})
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
                    Váš tím
                  </button>
                )}
              </div>

              {/* Search input */}
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filtrovať tím..."
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
                    title={`${t.name} (Poradie: #${t.rank})`}
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
                        {isTop1 && <span className="text-[10px]" title="1. priorita">👑</span>}
                        {isMine && !isTop1 && (
                          <span className="text-[9px] font-extrabold text-sky-400 tracking-tighter">
                            VÁŠ
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
                Žiadny tím nezodpovedá vyhľadávaniu.
              </div>
            )}
          </div>
        </section>
      )}

      {/* Section 3: Rules & Guide */}
      <section className="space-y-4 pt-2">
        <h2 className="text-lg font-black text-white uppercase tracking-wide flex items-center gap-2">
          <span>📖</span> Ako funguje Waiver Wire &bull; Pravidlá ligy
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Rule 1 */}
          <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center text-lg mb-3">
                ⏱️
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">
                24-Hodinové okno
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Každý hráč s jednocestnou zmluvou musí pred odoslaním do farmárskej AHL stráviť 24 hodín na waiver listine. Počas tejto doby si ho môže nárokovať ktorýkoľvek iný klub.
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
                Prioritný systém nárokov
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                V priebehu sezóny rozhoduje obrátené poradie ligovej tabuľky (najhorší tím má prednosť). Po úspešnom nároku klub automaticky klesá na 32. miesto v poradí.
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
                NMC & NTC Klauzuly
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Doložka o neprenosnosti (NMC) úplne blokuje umiestnenie hráča na waiver. No-trade klauzula (NTC) waiver nezakazuje a hráča je možné ponúknuť.
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
                Pravidlo 30/10 (Recall pass)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Povolaný hráč z AHL môže byť poslaný späť bez waiveru, ak od jeho povolania neuplynulo viac ako 30 kalendárnych dní a neodohral viac ako 10 zápasov NHL.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
