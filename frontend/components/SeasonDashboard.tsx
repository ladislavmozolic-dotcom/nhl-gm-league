"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { GmDashboard } from "@/lib/gm-dashboard-server";

const money = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

// Full-screen GM command center shown once per session (on login / a game day).
export default function SeasonDashboard({ data }: { data: GmDashboard }) {
  const [show, setShow] = useState(false);
  const [greeting, setGreeting] = useState("Welcome");
  useEffect(() => {
    if (sessionStorage.getItem("gmDashSeen") === "1") return;
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
    setShow(true);
  }, []);
  if (!show) return null;
  const dismiss = () => { sessionStorage.setItem("gmDashSeen", "1"); setShow(false); };

  const Check = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm"><span>{ok ? "✅" : "⚠️"}</span><span className={ok ? "text-slate-200" : "text-amber-400"}>{label}</span></div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-6">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Season Dashboard</div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">{greeting}, {data.team.code ?? data.team.name} GM</h1>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Next game + readiness */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Next Game</div>
              {data.nextGame ? (
                <>
                  <div className="text-xl font-black text-white">{data.nextGame.home ? "vs" : "@"} {data.nextGame.opp}</div>
                  <div className="text-sm text-blue-400 mb-3">{data.nextGame.when}</div>
                </>
              ) : <div className="text-sm text-slate-500 mb-3">No game scheduled.</div>}
              <div className="space-y-1.5 border-t border-slate-800 pt-3">
                <Check ok={data.ready.lines} label={data.ready.lines ? "Lines submitted" : "Lines not set"} />
                <Check ok={data.ready.roster} label={`Roster ${data.ready.rosterNote}`} />
                <Check ok={data.ready.capOk} label={`Cap ${data.ready.capSpace >= 0 ? `${money(data.ready.capSpace)} available` : `over by ${money(-data.ready.capSpace)}`}`} />
              </div>
            </div>

            {/* Team form + latest */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Team Form</div>
              {data.form ? (
                <>
                  <div className="text-xl font-black text-white">{data.form.last10} <span className="text-xs font-normal text-slate-500">last 10</span></div>
                  <div className="text-sm mb-3">{data.form.streakType === "W" && data.form.streakLen >= 3 ? <span className="text-emerald-400">🔥 {data.form.streakLen} wins straight</span> : data.form.streakType === "L" && data.form.streakLen >= 3 ? <span className="text-rose-400">❄ winless in {data.form.streakLen}</span> : <span className="text-slate-500">{data.form.points} pts</span>}</div>
                </>
              ) : <div className="text-sm text-slate-500 mb-3">No games yet.</div>}
              {data.latest.length > 0 && (
                <div className="border-t border-slate-800 pt-3 space-y-1">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Latest</div>
                  {data.latest.map((l, i) => <div key={i} className="text-sm text-slate-300">{l}</div>)}
                </div>
              )}
            </div>
          </div>

          {/* Attention */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 mt-4">
            <div className="text-xs uppercase tracking-wide text-amber-400 mb-2">Attention Required</div>
            {data.attention.length === 0 ? (
              <p className="text-sm text-emerald-400">✅ All clear — nothing needs your attention.</p>
            ) : (
              <div className="space-y-1.5">
                {data.attention.map((a, i) => {
                  const inner = <span className={`text-sm ${a.tone}`}><span className="mr-1.5">{a.icon}</span>{a.text}</span>;
                  return <div key={i}>{a.href ? <Link href={a.href} onClick={dismiss} className="hover:underline">{inner}</Link> : inner}</div>;
                })}
              </div>
            )}
          </div>

          <div className="text-center mt-6">
            <button onClick={dismiss} className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg shadow-lg shadow-blue-900/30">Continue →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
