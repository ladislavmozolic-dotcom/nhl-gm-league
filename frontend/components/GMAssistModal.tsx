"use client";

import { useEffect } from "react";
import Image from "next/image";
import type { GMAssistResponse } from "@/app/trades/build/actions";

interface GMAssistModalProps {
  data: GMAssistResponse | null;
  onClose: () => void;
}

export default function GMAssistModal({ data, onClose }: GMAssistModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!data) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#0b1220] border border-slate-700/80 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl shadow-indigo-950/60 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER BAR */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-950/60 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 text-xl">
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  GM Assist
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
                  Trade Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Advanced heuristic analysis of the trade and its impact on the lineup
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors text-lg"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {!data.ok ? (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-sm">
              {data.error}
            </div>
          ) : (
            <>
              {/* HERO VERDICT BANNER */}
              <div
                className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 border transition-all ${
                  data.tilt === "even"
                    ? "bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-teal-950/30 border-emerald-500/40 text-emerald-200 shadow-lg shadow-emerald-950/20"
                    : "bg-gradient-to-br from-amber-950/40 via-slate-900/90 to-slate-950 border-amber-500/40 text-amber-200 shadow-lg shadow-amber-950/20"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">
                      {data.tilt === "even" ? "⚖️" : "📊"}
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                      Trade verdict
                    </span>
                  </div>
                  {data.archetype && (
                    <span className="px-2.5 py-1 rounded-xl text-xs font-black tracking-wide bg-slate-900/90 border border-slate-700 text-slate-200 shadow-sm">
                      {data.archetype.badge}
                    </span>
                  )}
                </div>

                <div className="text-base sm:text-xl font-black text-white tracking-tight">
                  {data.verdict}
                </div>

                {data.archetype?.description && (
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {data.archetype.description}
                  </p>
                )}

                {/* VISUAL VALUE DUEL BAR */}
                {data.shares && (
                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                      <div className="flex items-center gap-2">
                        {data.fromTeam?.logoUrl && (
                          <div className="relative w-4 h-4">
                            <Image
                              src={data.fromTeam.logoUrl}
                              alt=""
                              fill
                              className="object-contain"
                            />
                          </div>
                        )}
                        <span className="text-slate-300">{data.fromName}</span>
                        <span className="font-mono text-indigo-400">
                          {data.meGives} pts ({data.shares.fromPct}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-cyan-400">
                          ({data.shares.toPct}%) {data.meGets} pts
                        </span>
                        <span className="text-slate-300">{data.toName}</span>
                        {data.toTeam?.logoUrl && (
                          <div className="relative w-4 h-4">
                            <Image
                              src={data.toTeam.logoUrl}
                              alt=""
                              fill
                              className="object-contain"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress duel bar */}
                    <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500"
                        style={{ width: `${data.shares.fromPct}%` }}
                      />
                      <div
                        className="bg-gradient-to-r from-cyan-400 to-cyan-500 transition-all duration-500"
                        style={{ width: `${data.shares.toPct}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1 font-mono">
                      <span>Index vyrovnanosti: {data.shares.fairnessScore}%</span>
                      {data.shares.diff > 0 && (
                        <span className="text-amber-400 font-semibold">
                          Rozdiel: {data.shares.diff} bodov
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ASSET SIDES GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* FROM TEAM SIDE */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800">
                      <div className="flex items-center gap-2 font-bold text-sm text-white">
                        {data.fromTeam?.logoUrl && (
                          <div className="relative w-5 h-5">
                            <Image
                              src={data.fromTeam.logoUrl}
                              alt=""
                              fill
                              className="object-contain"
                            />
                          </div>
                        )}
                        <span>{data.fromName} gives:</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/40 border border-indigo-900/50 px-2 py-0.5 rounded-lg">
                        {data.meGives} pts
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {data.fromItems.length === 0 ? (
                        <div className="text-xs text-slate-600 italic py-2">
                          — no assets —
                        </div>
                      ) : (
                        data.fromItems.map((it, i) => (
                          <div
                            key={i}
                            className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-2.5 py-2 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1.5">
                                <span>
                                  {it.type === "PLAYER"
                                    ? "🏒"
                                    : it.type === "PICK"
                                    ? "🎫"
                                    : it.type === "PROSPECT"
                                    ? "⭐"
                                    : "💵"}
                                </span>
                                <span className="truncate">{it.label}</span>
                              </div>
                              {it.sub && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {it.sub}
                                </div>
                              )}
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-400 tabular-nums shrink-0">
                              {it.value}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* TO TEAM SIDE */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800">
                      <div className="flex items-center gap-2 font-bold text-sm text-white">
                        {data.toTeam?.logoUrl && (
                          <div className="relative w-5 h-5">
                            <Image
                              src={data.toTeam.logoUrl}
                              alt=""
                              fill
                              className="object-contain"
                            />
                          </div>
                        )}
                        <span>{data.toName} gives:</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-900/50 px-2 py-0.5 rounded-lg">
                        {data.meGets} pts
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {data.toItems.length === 0 ? (
                        <div className="text-xs text-slate-600 italic py-2">
                          — no assets —
                        </div>
                      ) : (
                        data.toItems.map((it, i) => (
                          <div
                            key={i}
                            className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-2.5 py-2 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1.5">
                                <span>
                                  {it.type === "PLAYER"
                                    ? "🏒"
                                    : it.type === "PICK"
                                    ? "🎫"
                                    : it.type === "PROSPECT"
                                    ? "⭐"
                                    : "💵"}
                                </span>
                                <span className="truncate">{it.label}</span>
                              </div>
                              {it.sub && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {it.sub}
                                </div>
                              )}
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-400 tabular-nums shrink-0">
                              {it.value}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* EDITORIAL NARRATIVE & GAP CLOSER */}
              {data.editorialNarrative && (
                <div className="rounded-2xl bg-gradient-to-br from-indigo-950/30 via-slate-900/60 to-slate-950 border border-indigo-500/20 p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎙️</span>
                    <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">
                      Analyst view (AI GM commentary)
                    </h4>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed font-sans">
                    {data.editorialNarrative}
                  </p>

                  {/* GAP CLOSER BOX */}
                  {data.gapCloser && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 flex items-start gap-2.5 text-xs text-amber-200">
                      <span className="text-amber-400 text-sm mt-0.5">💡</span>
                      <div>
                        <span className="font-bold block text-amber-300 mb-0.5">
                          Suggestion to even out the value:
                        </span>
                        <span>{data.gapCloser}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ROSTER FIT (ZAPADNUTIE DO TÍMU) */}
              {data.fit && data.fit.length > 0 && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🧩</span>
                    <h4 className="text-xs font-black uppercase tracking-wider text-sky-400">
                      Team fit and lineup hierarchy
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {data.fit.map((f, i) => (
                      <li
                        key={i}
                        className="text-xs sm:text-sm text-slate-200 flex items-start gap-2.5 bg-slate-950/40 border border-slate-800/50 rounded-xl p-2.5 leading-relaxed"
                      >
                        <span className="text-sky-400 font-bold shrink-0 mt-0.5">
                          ▸
                        </span>
                        <span dangerouslySetInnerHTML={{ __html: f }} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* STRATEGIC INTEL & CAP INSIGHTS */}
              {data.reasoning && data.reasoning.length > 0 && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <h4 className="text-xs font-black uppercase tracking-wider text-violet-400">
                      Strategic factors and salary impact
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.reasoning.map((r, i) => (
                      <div
                        key={i}
                        className="text-xs text-slate-300 flex items-start gap-2 bg-slate-950/50 border border-slate-800/60 rounded-xl p-2.5"
                      >
                        <span className="text-violet-400 shrink-0 mt-0.5 font-bold">
                          •
                        </span>
                        <span
                          className="leading-snug"
                          dangerouslySetInnerHTML={{ __html: r }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FOOTER NOTE */}
              <p className="text-[11px] text-slate-500 leading-normal">
                Heuristic analysis (CK/PA/SC/DF parameters, age, real NHL/AHL
                development, salary cap, value of draft picks and prospects) —
                serves as an advisory tool before confirming a trade.
              </p>
            </>
          )}
        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-all shadow-md hover:shadow-slate-700/20"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
