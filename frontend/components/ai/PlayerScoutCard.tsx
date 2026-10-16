"use client";

import { useState } from "react";
import { useLang } from "@/components/LangProvider";
import { Card } from "@/components/ui";
import AiArticleView from "@/components/ai/AiArticleView";

export default function PlayerScoutCard({ playerId, playerName }: { playerId: number; playerName: string }) {
  const lang = useLang();
  const cs = lang === "cs";

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchScoutReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/player-scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chyba pri generovaní posudku");
      setReport(data.scoutingReport);
      setModelUsed(data.model);
    } catch (err: any) {
      setError(err?.message || "Nepodarilo sa načítať posudok skauta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title={cs ? `🕵️‍♂️ Skautský posudok — ${playerName}` : `🕵️‍♂️ Scouting Report — ${playerName}`}
      right={
        modelUsed ? (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/40 font-normal">
            {modelUsed}
          </span>
        ) : undefined
      }
      accent="text-blue-400"
      bodyClassName="p-4 flex flex-col gap-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
        <p className="text-xs text-slate-300">
          {cs
            ? "Umelá inteligencia v role hlavného skauta analyzuje herné atribúty, ligové porovnania, plat a ideálnu rolu hráča."
            : "AI acting as Director of Pro Scouting synthesizes ratings, league comparables, cap hit, and ideal role into an authentic report."}
        </p>
        <button
          onClick={fetchScoutReport}
          disabled={loading}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-500/30 transition shadow disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>{cs ? "Skaut pripravuje správu…" : "Scouting player…"}</span>
            </>
          ) : (
            <>
              <span>✨</span>
              <span>{report ? (cs ? "Pregenerovať posudok" : "Regenerate report") : (cs ? "Vypracovať posudok skauta" : "Generate Scouting Report")}</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-xs text-red-300">
          ⚠️ {error}
        </div>
      )}

      {report && (
        <div className="mt-2">
          <AiArticleView
            content={report}
            category={cs ? `SKAUTSKÝ REPORT: ${playerName}` : `PRO SCOUTING REPORT: ${playerName}`}
            model={modelUsed}
            lang={lang}
          />
        </div>
      )}
    </Card>
  );
}
