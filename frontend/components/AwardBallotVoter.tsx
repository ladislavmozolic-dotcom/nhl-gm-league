"use client";

import { useState, useTransition } from "react";
import { submitBallotAction } from "@/app/awards/vote/actions";

export type VoteCand = { key: string; name: string; subline: string; detail: string; photoUrl?: string | null; logoUrl?: string | null };
export type VoteCategory = { key: string; label: string; subtitle: string; icon: string; picks: number; points: number[]; candidates: VoteCand[]; myPicks: string[] };

function Avatar({ c }: { c: VoteCand }) {
  if (c.photoUrl) return <img src={c.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover bg-slate-800 ring-1 ring-slate-700" />;
  if (c.logoUrl) return <img src={c.logoUrl} alt="" className="w-9 h-9 rounded-full object-contain bg-slate-800 ring-1 ring-slate-700 p-1" />;
  const ini = c.name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return <div className="w-9 h-9 rounded-full bg-slate-800 ring-1 ring-slate-700 grid place-items-center text-xs text-slate-400 font-semibold">{ini}</div>;
}

function CategoryBallot({ season, league, cat }: { season: string; league: string; cat: VoteCategory }) {
  const [picks, setPicks] = useState<string[]>(cat.myPicks);
  const [saved, setSaved] = useState<null | { ok: boolean; msg: string }>(null);
  const [pending, start] = useTransition();

  const toggle = (key: string) => {
    setSaved(null);
    setPicks((p) => {
      if (p.includes(key)) return p.filter((k) => k !== key);
      if (p.length >= cat.picks) return p; // ballot full
      return [...p, key];
    });
  };
  const rankOf = (key: string) => picks.indexOf(key);

  const submit = () => start(async () => {
    const r = await submitBallotAction(season, league, cat.key, picks);
    setSaved(r.ok ? { ok: true, msg: `Ballot saved (${r.saved} picks).` } : { ok: false, msg: r.error ?? "Failed." });
  });

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>{cat.icon}</span>
          <div>
            <div className="font-semibold text-slate-100">{cat.label}</div>
            <div className="text-xs text-slate-500">{cat.subtitle} · rank {cat.picks} ({cat.points.join("-")})</div>
          </div>
        </div>
        <div className="text-xs text-slate-500">{picks.length}/{cat.picks}</div>
      </div>

      <div className="mt-2 space-y-1.5">
        {cat.candidates.map((c) => {
          const r = rankOf(c.key);
          const picked = r >= 0;
          return (
            <button
              key={c.key}
              onClick={() => toggle(c.key)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${picked ? "bg-amber-500/15 ring-1 ring-amber-500/40" : "bg-slate-800/30 hover:bg-slate-800/60"}`}
            >
              <span className={`w-7 h-7 shrink-0 grid place-items-center rounded-full text-xs font-bold ${picked ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-500"}`}>
                {picked ? cat.points[r] : "+"}
              </span>
              <Avatar c={c} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-200 truncate">{c.name}</div>
                <div className="text-xs text-slate-500 truncate">{c.subline}{c.subline && c.detail ? " · " : ""}{c.detail}</div>
              </div>
              {picked && <span className="text-[10px] uppercase tracking-wider text-amber-400">#{r + 1}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button onClick={submit} disabled={pending || picks.length === 0} className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 transition-colors">
          {pending ? "Saving…" : "Submit ballot"}
        </button>
        {picks.length > 0 && <button onClick={() => { setPicks([]); setSaved(null); }} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>}
        {saved && <span className={`text-xs ${saved.ok ? "text-emerald-400" : "text-red-400"}`}>{saved.msg}</span>}
      </div>
    </div>
  );
}

export default function AwardBallotVoter({ season, league, categories }: { season: string; league: string; categories: VoteCategory[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {categories.map((cat) => <CategoryBallot key={cat.key} season={season} league={league} cat={cat} />)}
    </div>
  );
}
