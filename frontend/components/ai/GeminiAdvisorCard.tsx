"use client";

import React, { useState } from "react";

interface GeminiAdvisorCardProps {
  teamId: number;
  teamName: string;
}

const PRESET_PROMPTS = [
  { label: "🎯 Celkový audit kádra", question: "Urob celkový strategický audit kádra, pomenuj kľúčové diery a odporuč 3 konkrétne manažérske kroky.", focus: "general" },
  { label: "🚨 Slabiny a ciele pred uzávierkou (Deadline)", question: "Zameraj sa detailne na naše slabiny a odporuč konkrétne pozície a profily hráčov, ktorých by sme mali získať výmenou.", focus: "deadline" },
  { label: "💰 Platový strop a končiace zmluvy", question: "Analyzuj náš platový strop, končiace zmluvy (pending UFA/RFA) a odporuč, koho predĺžiť a koho nechať odísť.", focus: "cap" },
  { label: "🏒 Taktické odporúčania pre trénera", question: "Aké taktické nastavenie a roly hráčov by najlepšie vyhovovali súčasnému zloženiu nášho mužstva?", focus: "tactics" },
];

export default function GeminiAdvisorCard({ teamId, teamName }: GeminiAdvisorCardProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const fetchAdvice = async (q: string, focus: string = "general") => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const res = await fetch("/api/ai/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, question: q, focus }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503 && data.configured === false) {
          setNotConfigured(true);
          setError("Pre aktiváciu je potrebné nastaviť GEMINI_API_KEY v .env na serveri.");
          return;
        }
        throw new Error(data.error || "Chyba pri generovaní odpovede.");
      }

      setAnalysis(data.analysis);
      setModelUsed(data.model);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodarilo sa spojiť s AI.");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;
    fetchAdvice(question.trim(), "custom");
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 p-5 shadow-2xl relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <h3 className="text-base font-black text-white uppercase tracking-wide">
              Gemini 4 Argon AI Strategický Radca
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-300 text-[10px] font-black uppercase tracking-wider animate-pulse">
              Frontier Reasoning
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Hĺbkový rozbor kádra tímu <strong className="text-slate-200">{teamName}</strong> s priamym vyhodnotením platového stropu, zmlúv a taktiky.
          </p>
        </div>

        {modelUsed && (
          <div className="text-[11px] font-mono text-slate-400 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800 shrink-0">
            Model: <span className="text-emerald-400 font-bold">{modelUsed}</span>
          </div>
        )}
      </div>

      {/* Preset Action Chips */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Rýchle analýzy:</span>
        {PRESET_PROMPTS.map((p, idx) => (
          <button
            key={idx}
            onClick={() => {
              setQuestion(p.question);
              fetchAdvice(p.question, p.focus);
            }}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition disabled:opacity-50 shadow-sm"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom Question Form */}
      <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Opýtaj sa Gemini čokoľvek na mieru o svojom tíme..."
          disabled={loading}
          className="flex-1 bg-slate-950/90 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none transition shadow-inner"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-emerald-950"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>Uvažujem...</span>
            </>
          ) : (
            <>
              <span>Analyzovať</span>
              <span>➔</span>
            </>
          )}
        </button>
      </form>

      {/* Loading state message */}
      {loading && (
        <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col items-center justify-center gap-3 text-center my-4">
          <div className="w-10 h-10 rounded-full border-3 border-emerald-500/20 border-t-emerald-400 animate-spin"></div>
          <div>
            <div className="text-xs font-bold text-slate-200">Gemini 4 Argon analyzuje dáta klubu...</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Prebieha hĺbkový rozbor kádra, platového stropu a herných parametrov.</div>
          </div>
        </div>
      )}

      {/* Error / Not configured notice */}
      {error && !loading && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-300 mb-4">
          <div className="font-bold flex items-center gap-1.5">
            <span>⚠️</span>
            <span>Upozornenie:</span>
          </div>
          <p className="mt-1">{error}</p>
          {notConfigured && (
            <p className="mt-2 text-[11px] text-slate-400 font-mono">
              Do súboru <code>.env</code> stačí pridať: <code>GEMINI_API_KEY=vaš_klúč_z_google_ai_studio</code>
            </p>
          )}
        </div>
      )}

      {/* Analysis Output Area */}
      {analysis && !loading && (
        <div className="mt-4 p-5 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs text-slate-200 shadow-inner space-y-3 leading-relaxed">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
              Výsledok strategického rozboru
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(analysis)}
              className="text-[10px] font-bold text-slate-400 hover:text-white transition bg-slate-900 px-2 py-0.5 rounded border border-slate-800"
            >
              📋 Kopírovať
            </button>
          </div>
          <div className="whitespace-pre-wrap font-sans text-slate-200 space-y-2">
            {analysis}
          </div>
        </div>
      )}
    </div>
  );
}
