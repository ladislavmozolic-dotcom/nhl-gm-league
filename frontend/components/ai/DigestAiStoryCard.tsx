"use client";

import { useState } from "react";
import { useLang } from "@/components/LangProvider";

export default function DigestAiStoryCard({
  season,
  target,
  hasGames,
}: {
  season: string;
  target: string | number | null;
  hasGames: boolean;
}) {
  const lang = useLang();
  const cs = lang === "cs";

  const [loading, setLoading] = useState(false);
  const [story, setStory] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!hasGames) return null;

  const fetchDigestStory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/digest-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season, target, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chyba pri generovaní článku");
      setStory(data.story);
      setModelUsed(data.model);
    } catch (err: any) {
      setError(err?.message || "Nepodarilo sa vygenerovať príbeh noci");
    } finally {
      setLoading(false);
    }
  };

  const copyStory = () => {
    if (!story) return;
    navigator.clipboard.writeText(story);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/80 p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🎙️</span>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>{cs ? "Príbeh dnešnej noci (Redakcia UNHL)" : "Story of the Night (UNHL Editorial)"}</span>
              {modelUsed && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/40 font-normal">
                  {modelUsed}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              {cs
                ? "AI novinár prepojí výsledky zápasov, hrdinov noci, prekvapenia a zranenia do jedného článku."
                : "AI journalist synthesizes scores, stars, upsets, and injuries into a cohesive narrative."}
            </p>
          </div>
        </div>

        <button
          onClick={fetchDigestStory}
          disabled={loading}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-500/30 transition shadow-lg shadow-blue-900/20 disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>{cs ? "Píšem príbeh noci…" : "Drafting story…"}</span>
            </>
          ) : (
            <>
              <span>✨</span>
              <span>{story ? (cs ? "Pregenerovať článok" : "Regenerate story") : (cs ? "Vygenerovať príbeh noci" : "Generate Story of the Night")}</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-xs text-red-300">
          ⚠️ {error}
        </div>
      )}

      {story && (
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-end mb-2">
            <button
              onClick={copyStory}
              className="text-xs text-slate-400 hover:text-slate-200 transition"
            >
              {copied ? (cs ? "✓ Skopírované" : "✓ Copied") : (cs ? "Kopírovať článok" : "Copy story")}
            </button>
          </div>
          <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed space-y-3 bg-slate-950/70 p-5 rounded-xl border border-slate-800/90 whitespace-pre-line text-xs sm:text-sm shadow-inner">
            {story}
          </div>
        </div>
      )}
    </div>
  );
}
