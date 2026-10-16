"use client";

import React, { useState } from "react";
import { useLang } from "@/components/LangProvider";
import AiArticleView from "@/components/ai/AiArticleView";

interface GeminiAdvisorCardProps {
  teamId: number;
  teamName: string;
}

export default function GeminiAdvisorCard({ teamId, teamName }: GeminiAdvisorCardProps) {
  const lang = useLang();
  const cs = lang === "cs";

  const presetPrompts = cs
    ? [
        { label: "🎯 Celkový audit kádra", question: "Urob celkový strategický audit kádra, pomenuj kľúčové diery a odporuč 3 konkrétne manažérske kroky.", focus: "general" },
        { label: "⚔️ Príprava na najbližšieho súpera", question: "Zameraj sa na náš najbližší zápas. Zanalyzuj silné a slabé stránky súpera a navrhni herný plán a zloženie formácií.", focus: "opponent" },
        { label: "🚨 Slabiny a ciele pred uzávierkou (Deadline)", question: "Zameraj sa detailne na naše slabiny a odporuč konkrétne pozície a profily hráčov, ktorých by sme mali získať výmenou.", focus: "deadline" },
        { label: "💰 Platový strop a končiace zmluvy", question: "Analyzuj náš platový strop, končiace zmluvy (pending UFA/RFA) a odporuč, koho predĺžiť a koho nechať odísť.", focus: "cap" },
        { label: "🏒 Taktické odporúčania pre trénera", question: "Aké taktické nastavenie a roly hráčov by najlepšie vyhovovali súčasnému zloženiu nášho mužstva?", focus: "tactics" },
      ]
    : [
        { label: "🎯 Full Roster Audit", question: "Perform a comprehensive roster audit, highlight key vulnerabilities, and recommend 3 immediate GM steps.", focus: "general" },
        { label: "⚔️ Next Opponent Scouting", question: "Analyze our next scheduled opponent. Break down their strengths, weaknesses, and recommend an effective tactical game plan.", focus: "opponent" },
        { label: "🚨 Trade Deadline Targets", question: "Focus on our role score deficiencies and recommend specific target archetypes to acquire before the deadline.", focus: "deadline" },
        { label: "💰 Salary Cap & Expiring Deals", question: "Analyze our cap space, pending UFAs/RFAs, and advise on who to extend versus let walk into free agency.", focus: "cap" },
        { label: "🏒 Tactical Coaching Plan", question: "What tactical system, dials, and forward line roles best suit our personnel?", focus: "tactics" },
      ];

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
        body: JSON.stringify({ teamId, question: q, focus, lang }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503 && data.configured === false) {
          setNotConfigured(true);
          setError(cs ? "Pre aktiváciu je potrebné nastaviť GEMINI_API_KEY v .env na serveri." : "GEMINI_API_KEY is not configured.");
          return;
        }
        throw new Error(data.error || (cs ? "Chyba pri generovaní odpovede." : "Failed to generate analysis."));
      }

      setAnalysis(data.analysis);
      setModelUsed(data.model);
    } catch (err) {
      setError(err instanceof Error ? err.message : (cs ? "Nepodarilo sa spojiť s AI." : "Could not reach AI advisor."));
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
              {cs ? "Gemini 4 Argon AI Strategický Radca" : "Gemini 4 Argon AI Strategic Advisor"}
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-300 text-[10px] font-black uppercase tracking-wider animate-pulse">
              LIVE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {cs
              ? `Generatívna AI v reálnom čase analyzuje súpisku tímu ${teamName}, platový strop a herné ukazovatele.`
              : `Generative AI actively evaluating ${teamName}'s roster, cap breakdown, and role-score indicators.`}
          </p>
        </div>
        {modelUsed && (
          <div className="text-right">
            <span className="text-[11px] font-mono text-slate-400 block">{cs ? "Aktívny model:" : "Active Model:"}</span>
            <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950/60 border border-sky-800/40 px-2 py-0.5 rounded">
              {modelUsed}
            </span>
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="mb-4">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
          {cs ? "⚡ Rýchle strategické analýzy:" : "⚡ Instant Strategic Briefings:"}
        </label>
        <div className="flex flex-wrap gap-2">
          {presetPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => fetchAdvice(p.question, p.focus)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/60 hover:border-slate-500 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom question input */}
      <form onSubmit={handleCustomSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={
            cs
              ? "Opýtajte sa čokoľvek na zmluvu, hráča, formácie alebo plán prestavby..."
              : "Ask anything about contracts, players, forward lines, or rebuild strategy..."
          }
          disabled={loading}
          className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition shadow-inner"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-sky-900/30 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? (cs ? "Analyzujem…" : "Analyzing…") : (cs ? "Odoslať" : "Submit")}
        </button>
      </form>

      {/* Error / Not configured notice */}
      {notConfigured && (
        <div className="rounded-xl bg-amber-950/40 border border-amber-600/50 p-4 text-xs text-amber-200 mb-4">
          <p className="font-bold mb-1">{cs ? "ℹ️ AI Radca zatiaľ nie je aktívny" : "ℹ️ AI Advisor not active yet"}</p>
          <p>
            {cs
              ? "Pre odomknutie funkcie stačí do súboru .env na serveri doplniť platný GEMINI_API_KEY z Google AI Studio."
              : "To enable, add GEMINI_API_KEY from Google AI Studio to .env on the server."}
          </p>
        </div>
      )}

      {error && !notConfigured && (
        <div className="rounded-xl bg-rose-950/40 border border-rose-600/50 p-3 text-xs text-rose-200 mb-4">
          ⚠️ {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-6 flex flex-col items-center justify-center gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-sky-400 uppercase tracking-wider">
            {cs ? "Riaditeľ hokejových operácií prepočítava dáta kádra..." : "Director of Hockey Ops synthesizing roster data..."}
          </p>
        </div>
      )}

      {/* Result Display */}
      {analysis && !loading && (
        <div className="mt-4">
          <AiArticleView
            content={analysis}
            category={cs ? "STRATEGICKÝ ROZBOR KÁDRA" : "DIRECTOR OF HOCKEY OPS BRIEFING"}
            model={modelUsed}
            lang={lang}
          />
        </div>
      )}
    </div>
  );
}
