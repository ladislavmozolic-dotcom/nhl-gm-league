"use client";

import { useState } from "react";
import type { GameReport, ReportBit } from "@/lib/game-report-server";
import { useLang } from "@/components/LangProvider";
import AiArticleView from "@/components/ai/AiArticleView";

function Bit({ title, icon, bit }: { title: string; icon: string; bit: ReportBit }) {
  if (!bit) return null;
  return (
    <div className="rounded-lg bg-slate-900/50 border border-slate-800 p-3">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xs font-bold uppercase tracking-wide text-amber-400">{icon} {title}</span>
        <span className="text-[11px] text-slate-500 tabular-nums">{bit.time} · {bit.period <= 3 ? `${bit.period}${["st", "nd", "rd"][bit.period - 1]}` : "OT"}</span>
      </div>
      <p className="text-sm text-slate-300 leading-snug">{bit.text}</p>
    </div>
  );
}

export default function GameReportCard({ report, gameId }: { report: GameReport; gameId?: number }) {
  const lang = useLang();
  const cs = lang === "cs";

  const [loading, setLoading] = useState(false);
  const [aiStory, setAiStory] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateStory = async () => {
    if (!gameId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/game-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chyba pri generovaní reportáže");
      setAiStory(data.story);
      setModelUsed(data.model);
    } catch (err: any) {
      setError(err?.message || "Nepodarilo sa vygenerovať reportáž");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80 border border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
          {cs ? "Zápasový report" : "Game Report"}
        </div>
        {gameId && (
          <button
            onClick={generateStory}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600/80 to-indigo-600/80 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-500/30 transition shadow disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>{cs ? "Píšem reportáž…" : "Drafting recap…"}</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>{aiStory ? (cs ? "Pregenerovať cez AI" : "Regenerate with AI") : (cs ? "Novinárska reportáž (AI)" : "Beat Writer Recap (AI)")}</span>
              </>
            )}
          </button>
        )}
      </div>

      <p className="text-[15px] text-slate-100 leading-relaxed">{report.summary}</p>

      {(report.turningPoint || report.playOfGame || report.saveOfGame) && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          <Bit title={cs ? "Zlomový moment" : "Turning Point"} icon="🔀" bit={report.turningPoint} />
          <Bit title={cs ? "Akcia zápasu" : "Play of the Game"} icon="🎯" bit={report.playOfGame} />
          <Bit title={cs ? "Zákrok zápasu" : "Save of the Game"} icon="🧤" bit={report.saveOfGame} />
        </div>
      )}

      {/* AI Journalism Story Section */}
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-xs text-red-300">
          ⚠️ {error}
        </div>
      )}

      {aiStory && (
        <div className="mt-5">
          <AiArticleView
            content={aiStory}
            category={cs ? "OFICIÁLNA REPORTÁŽ ZÁPASU" : "BEAT WRITER RECAP"}
            model={modelUsed}
            lang={lang}
          />
        </div>
      )}
    </div>
  );
}
