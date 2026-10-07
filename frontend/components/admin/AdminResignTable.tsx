"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cleanName } from "@/lib/playerName";
import ResignInterventionModal, { type ResignPlayerData } from "./ResignInterventionModal";
import ResetResignButton from "@/components/ResetResignButton";

export type ResignRowData = ResignPlayerData & {
  slug: string | null;
  teamLogoUrl?: string | null;
  disgruntled?: boolean;
  tradeRequested?: boolean;
  iceWarnedAt?: Date | string | null;
  promiseWarnGame?: number | null;
};

const fmtM = (c: number | null | undefined) => {
  if (c == null || !Number.isFinite(c)) return "—";
  return `$${(c / 1e6).toFixed(2)}M`;
};

const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (!date || isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdminResignTable({ rows }: { rows: ResignRowData[] }) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "active" | "countered" | "stalled">("all");
  const [activePlayer, setActivePlayer] = useState<ResignRowData | null>(null);

  const filtered = rows.filter((r) => {
    // Tab filter
    if (tab === "active" && !["open", "countered"].includes(r.resignStatus ?? "")) return false;
    if (tab === "countered" && r.resignStatus !== "countered") return false;
    if (tab === "stalled" && !["walkedToUFA", "osEligible"].includes(r.resignStatus ?? "")) return false;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = cleanName(r.name).toLowerCase().includes(q);
      const matchClub = (r.teamCode ?? "").toLowerCase().includes(q) || (r.teamName ?? "").toLowerCase().includes(q);
      const matchPos = (r.position ?? "").toLowerCase().includes(q);
      return matchName || matchClub || matchPos;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 pt-2">
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              tab === "all" ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All ({rows.length})
          </button>
          <button
            onClick={() => setTab("active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              tab === "active" ? "bg-sky-950/80 text-sky-300 border border-sky-800/60 shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Active ({rows.filter((r) => ["open", "countered"].includes(r.resignStatus ?? "")).length})
          </button>
          <button
            onClick={() => setTab("countered")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              tab === "countered" ? "bg-amber-950/80 text-amber-300 border border-amber-800/60 shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Counter-offers ({rows.filter((r) => r.resignStatus === "countered").length})
          </button>
          <button
            onClick={() => setTab("stalled")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              tab === "stalled" ? "bg-rose-950/80 text-rose-300 border border-rose-800/60 shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Broken off ({rows.filter((r) => ["walkedToUFA", "osEligible"].includes(r.resignStatus ?? "")).length})
          </button>
        </div>

        <div className="w-full sm:w-72 relative">
          <input
            type="text"
            placeholder="Search player, club or position…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-2xl mx-4 my-2">
          <p className="text-slate-400 text-sm font-medium">No negotiations match the selected filter.</p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="mt-2 text-xs text-sky-400 hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-800 bg-slate-800/40">
                <th className="text-left px-4 py-3 font-semibold">Player & CBA</th>
                <th className="text-left px-3 py-3 font-semibold">Klub</th>
                <th className="text-left px-3 py-3 font-semibold">Stav & Kolo</th>
                <th className="text-right px-3 py-3 font-semibold">Ponuka klubu</th>
                <th className="text-right px-3 py-3 font-semibold">Player counter-offer</th>
                <th className="text-right px-3 py-3 font-semibold">Submitted</th>
                <th className="text-left px-4 py-3 font-semibold">AI Benchmark & Mood</th>
                <th className="text-right px-4 py-3 font-semibold">Admin</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const lowballPct = Math.round((p.lowballBump - 1) * 100);
                const hasCounter = p.resignCounterSalary != null && p.resignCounterSalary > 0;
                const hasOffer = p.resignOfferSalary != null && p.resignOfferSalary > 0;
                // A regular RFA gets 1 round before OS; if OS doesn't land him elsewhere
                // he negotiates on, uncapped, directly with just his club (rfaOsUsed) —
                // no fixed "/N" cap or Final tag applies to him anymore at that point.
                const postOs = p.cbaStatus === "RFA" && !p.franchiseTag && p.rfaOsUsed;
                const roundCap = p.cbaStatus === "RFA" && !p.franchiseTag ? (postOs ? null : 1) : 2;

                // Gap calculation
                let gapText = null;
                let gapColor = "text-slate-400";
                if (hasOffer && hasCounter) {
                  const diff = p.resignOfferSalary! - p.resignCounterSalary!;
                  const diffPct = Math.round((diff / p.resignCounterSalary!) * 100);
                  if (diff < 0) {
                    gapText = `${fmtM(diff)} (${diffPct}%)`;
                    gapColor = "text-rose-400";
                  } else {
                    gapText = `+${fmtM(diff)} (+${diffPct}%)`;
                    gapColor = "text-emerald-400";
                  }
                }

                return (
                  <tr
                    key={p.id}
                    className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/30 transition group"
                  >
                    {/* Player column */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/bids/${p.id}`}
                          className="font-bold text-white hover:text-sky-400 transition"
                          title="View offer history"
                        >
                          {cleanName(p.name)}
                        </Link>
                        {p.position && (
                          <span className="text-[11px] font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                            {p.position}
                          </span>
                        )}
                        {p.overall && (
                          <span className="text-[11px] font-black px-1.5 py-0.2 rounded bg-blue-950/60 text-blue-300 border border-blue-900/50">
                            {p.overall}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                        <span
                          className={`font-semibold px-1 rounded text-[10px] ${
                            p.cbaStatus === "RFA"
                              ? "bg-amber-950/70 text-amber-300 border border-amber-800/50"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {p.cbaStatus}
                          {p.franchiseTag ? " · Tag" : ""}
                        </span>
                        <span>•</span>
                        <span>
                          {p.capHit ? fmtM(p.capHit) : "—"} ({p.contractYears ?? 0}r)
                        </span>
                        <span>•</span>
                        <Link
                          href={`/players/${p.slug ?? p.id}`}
                          className="text-slate-500 hover:text-sky-400 transition"
                        >
                          profil →
                        </Link>
                      </div>
                    </td>

                    {/* Team column */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {p.teamLogoUrl ? (
                          <Image
                            src={p.teamLogoUrl}
                            alt={p.teamCode ?? "Team"}
                            width={22}
                            height={22}
                            className="object-contain shrink-0"
                          />
                        ) : null}
                        <div>
                          <span className="font-bold text-slate-200">
                            {p.teamCode ?? "—"}
                          </span>
                          {p.teamName && (
                            <span className="text-[11px] text-slate-500 block truncate max-w-[130px]">
                              {p.teamName}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status & Round column */}
                    <td className="px-3 py-3">
                      <div className="space-y-1">
                        <div>
                          {p.resignStatus === "countered" && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Counter-offer
                            </span>
                          )}
                          {p.resignStatus === "open" && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                              In progress
                            </span>
                          )}
                          {p.resignStatus === "walkedToUFA" && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Odmietol / UFA
                            </span>
                          )}
                          {p.resignStatus === "osEligible" && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Offer Sheets
                            </span>
                          )}
                          {!p.resignStatus && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-400">
                              Kolo {p.resignRound}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <span>
                            Kolo {p.resignRound}
                            {roundCap != null ? `/${roundCap}` : ""}
                          </span>
                          {postOs && (
                            <span className="text-purple-400 font-semibold">(po OS, priamo s klubom)</span>
                          )}
                          {roundCap != null && p.resignRound === roundCap && (
                            <span className="text-amber-400 font-semibold">(Final)</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Club Offer */}
                    <td className="px-3 py-3 text-right tabular-nums font-mono">
                      {p.resignOfferSalary ? (
                        <div>
                          <span className="font-bold text-slate-200">
                            {fmtM(p.resignOfferSalary)}
                          </span>
                          <span className="text-[10px] text-slate-500 block">last offer</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Player Counter */}
                    <td className="px-3 py-3 text-right tabular-nums font-mono">
                      {p.resignCounterSalary ? (
                        <div>
                          <span className="font-bold text-amber-300">
                            {fmtM(p.resignCounterSalary)} × {p.resignCounterYears ?? "?"}r
                          </span>
                          {gapText && (
                            <span className={`text-[10px] font-semibold block ${gapColor}`}>
                              {gapText}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Offer Date */}
                    <td className="px-3 py-3 text-right text-xs text-slate-400 font-mono whitespace-nowrap">
                      {p.resignOfferAt ? (
                        <span className="text-slate-200 font-medium">
                          {fmtDate(p.resignOfferAt)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* AI Valuation & Morale Alerts */}
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-300 flex items-center gap-2">
                          <span className="text-slate-500">Floor:</span>
                          <span className="font-mono font-semibold text-slate-200">
                            {fmtM(p.aiFloorSalary)}
                          </span>
                          <span className="text-slate-500">• Ask:</span>
                          <span className="font-mono font-semibold text-emerald-400">
                            {fmtM(p.aiAskSalary)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {lowballPct > 0 && (
                            <span
                              className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-rose-950/70 border border-rose-800/50 text-rose-300"
                              title="The player was insulted by a low offer and is asking for a premium."
                            >
                              😠 +{lowballPct}% ask
                            </span>
                          )}
                          {p.tradeRequested && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-red-950/80 border border-red-800/60 text-red-300">
                              🚨 Requests a trade
                            </span>
                          )}
                          {p.disgruntled && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-amber-950/80 border border-amber-800/60 text-amber-300">
                              ⚠️ Unhappy
                            </span>
                          )}
                          {(p.iceWarnedAt || p.promiseWarnGame != null) && !p.disgruntled && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-orange-950/80 border border-orange-800/60 text-orange-300">
                              ⏱️ Ice-time
                            </span>
                          )}
                          {p.faDemandOverride && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-purple-950/80 border border-purple-800/60 text-purple-300">
                              Manual cap: {fmtM(p.faDemandOverride)}
                            </span>
                          )}
                          {!lowballPct && !p.tradeRequested && !p.disgruntled && !p.iceWarnedAt && !p.faDemandOverride && (
                            <span className="text-[11px] text-slate-500">
                              {p.desiredRole ?? "Standard negotiation"}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Actions column */}
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActivePlayer(p)}
                          className="px-3 py-1.5 rounded-lg bg-sky-600/90 hover:bg-sky-500 text-white text-xs font-semibold whitespace-nowrap shadow-sm hover:shadow transition flex items-center gap-1.5"
                        >
                          <span>🛠️</span>
                          <span>Intervene</span>
                        </button>
                        <ResetResignButton
                          playerId={p.id}
                          name={cleanName(p.name)}
                          label={p.resignStatus === "walkedToUFA" || p.resignStatus === "osEligible" ? "Delete" : "Reset"}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Intervention Modal */}
      {activePlayer && (
        <ResignInterventionModal
          player={activePlayer}
          onClose={() => setActivePlayer(null)}
        />
      )}
    </div>
  );
}
