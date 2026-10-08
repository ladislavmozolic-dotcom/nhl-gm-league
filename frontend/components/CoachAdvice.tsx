"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyCoachSuggestionAction } from "@/app/teams/[slug]/tactics/actions";
import type { CoachSuggestion } from "@/lib/coach-advice";
import { useLang } from "@/components/LangProvider";

const PRE_EN: Record<string, string> = {
  confident: "The coach is confident:",
  leaning: "The coach is leaning towards:",
  hunch: "The coach's hunch:",
};

const PRE_CS: Record<string, string> = {
  confident: "Tréner si je istý:",
  leaning: "Tréner sa prikláňa k:",
  hunch: "Trénerovo tušenie:",
};

const CONF_BADGE_EN: Record<string, { label: string; cls: string }> = {
  confident: { label: "High Confidence", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  leaning: { label: "Moderate", cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  hunch: { label: "Hunch", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
};

const CONF_BADGE_CS: Record<string, { label: string; cls: string }> = {
  confident: { label: "Vysoká dôvera", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  leaning: { label: "Mierne odporúčanie", cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  hunch: { label: "Tušenie", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
};

export default function CoachAdvice({
  teamId,
  suggestions,
  canManage,
  coachName,
  coachEx,
}: {
  teamId: number;
  suggestions: CoachSuggestion[];
  canManage: boolean;
  coachName?: string | null;
  coachEx?: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const lang = useLang();
  const isCs = lang === "cs";

  const preMap = isCs ? PRE_CS : PRE_EN;
  const badgeMap = isCs ? CONF_BADGE_CS : CONF_BADGE_EN;

  if (suggestions.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-xl shrink-0">
            👔
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-tight">
                {isCs ? "Pohľad hlavného trénera" : "Head Coach Advice"}
              </h3>
              {coachName && (
                <span className="text-xs font-mono text-slate-400">({coachName})</span>
              )}
            </div>
            <p className="text-xs text-emerald-400 font-semibold mt-0.5">
              {isCs
                ? "Tréner je spokojný s aktuálnym systémom — výborne sedí zostave tímu."
                : "The coach is satisfied with the current system — it fits the group well."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const apply = (s: CoachSuggestion) =>
    start(async () => {
      setMsg(null);
      const r = await applyCoachSuggestionAction(teamId, s.dial as string, s.to);
      if (r.ok) {
        setMsg(isCs ? `✓ Aplikované: ${s.toLabel}.` : `✓ Applied: ${s.toLabel}.`);
        router.refresh();
      } else {
        setMsg(r.error ?? (isCs ? "Chyba pri aplikovaní." : "Failed."));
      }
    });

  return (
    <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950/90 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/60 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-xl shrink-0 shadow-sm">
            👔
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                {isCs ? "Odporúčania hlavného trénera" : "Head Coach Recommendations"}
              </h3>
              {coachName && (
                <span className="text-xs font-semibold text-sky-400">({coachName})</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isCs
                ? "Tréner vyhodnotil profil hráčov vo vašom kádri a odporúča nasledovné úpravy:"
                : "The coach evaluated your roster attributes and suggests the following adjustments:"}
            </p>
          </div>
        </div>

        {coachEx != null && (
          <div className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-slate-850 border border-slate-700/60 text-slate-300">
            {isCs ? "Skúsenosti (EX):" : "Coach Exp:"} <span className="font-bold text-amber-400">{coachEx}</span>
          </div>
        )}
      </div>

      {/* Suggestion Items */}
      <div className="space-y-3">
        {suggestions.map((s, i) => {
          const badge = badgeMap[s.confidence];
          return (
            <div
              key={i}
              className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-850/50 border border-slate-800/80 hover:border-slate-700 transition-colors flex-wrap sm:flex-nowrap"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${badge.cls}`}>
                    {badge.label}
                  </span>
                  <span className="text-xs text-slate-400">{preMap[s.confidence]}</span>
                  <span className="text-xs font-black text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {s.toLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {s.reason}
                </p>
              </div>

              {canManage && (
                <button
                  onClick={() => apply(s)}
                  disabled={pending}
                  className="shrink-0 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-bold text-white transition-all shadow-md shadow-blue-600/30 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span>⚡</span>
                  <span>{isCs ? "Aplikovať" : "Apply"}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {msg && (
        <div className="text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-3.5 py-2 rounded-xl">
          {msg}
        </div>
      )}

      <p className="text-[11px] text-slate-500 italic">
        {isCs
          ? "Odporúčanie vychádza zo skúseností trénera a charakteru hráčov — ide o taktický náhľad, nie garantovanú cestu k víťazstvu."
          : "Suggestions reflect the coach's perspective and roster fit — advice is strategic guidance, not an absolute guarantee."}
      </p>
    </div>
  );
}
