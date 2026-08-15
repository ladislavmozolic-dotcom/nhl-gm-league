"use client";

import { useState } from "react";
import Link from "next/link";

export type Nominee = {
  playerId?: number;
  name: string;
  detail: string;
  teamName?: string;
  teamLogo?: string | null;
  teamSlug?: string | null;
  photoUrl?: string | null;
};
export type CeremonyCategory = {
  category: string;
  label: string;
  subtitle: string;
  icon: string;
  nominees: Nominee[];
};

function Mug({ n, big }: { n: Nominee; big?: boolean }) {
  const size = big ? "w-20 h-20" : "w-11 h-11";
  if (n.photoUrl) return <img src={n.photoUrl} alt="" className={`${size} rounded-full object-cover bg-slate-800 ring-1 ring-slate-700`} />;
  const initials = n.name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return <div className={`${size} rounded-full bg-slate-800 ring-1 ring-slate-700 grid place-items-center text-slate-400 ${big ? "text-lg" : "text-xs"} font-semibold`}>{initials}</div>;
}

function NomineeRow({ n }: { n: Nominee }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/30">
      <Mug n={n} />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-slate-200 truncate">{n.name}</div>
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          {n.teamLogo && <img src={n.teamLogo} alt="" className="w-4 h-4 object-contain" />}
          <span className="truncate">{n.detail}</span>
        </div>
      </div>
    </div>
  );
}

function WinnerSpotlight({ n }: { n: Nominee }) {
  const inner = (
    <div className="flex items-center gap-4">
      <Mug n={n} big />
      <div className="min-w-0">
        <div className="text-[10px] font-bold tracking-widest text-amber-400/90 uppercase">Winner</div>
        <div className="text-lg font-bold text-white truncate">{n.name}</div>
        <div className="text-sm text-amber-200/80 flex items-center gap-1.5 mt-0.5">
          {n.teamLogo && <img src={n.teamLogo} alt="" className="w-4 h-4 object-contain" />}
          <span className="truncate">{n.detail}</span>
        </div>
      </div>
    </div>
  );
  return (
    <div className="rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-700/5 ring-1 ring-amber-500/40 px-4 py-3 animate-[fadeIn_0.4s_ease]">
      {n.teamSlug ? <Link href={`/teams/${n.teamSlug}`} className="block hover:opacity-90">{inner}</Link> : inner}
    </div>
  );
}

function TrophyCard({ c, revealed, onReveal, locked }: { c: CeremonyCategory; revealed: boolean; onReveal: () => void; locked?: boolean }) {
  const winner = c.nominees[0];
  const rest = c.nominees.slice(1);
  if (locked) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 flex flex-col gap-3">
        <div>
          <div className="text-2xl leading-none mb-1" aria-hidden>{c.icon}</div>
          <div className="font-semibold text-slate-100">{c.label}</div>
          <div className="text-xs text-slate-500">{c.subtitle}</div>
        </div>
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-slate-600 px-1">Nominees</div>
          {c.nominees.map((n, i) => <NomineeRow key={n.playerId ?? `${n.name}-${i}`} n={n} />)}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-2xl leading-none mb-1" aria-hidden>{c.icon}</div>
          <div className="font-semibold text-slate-100">{c.label}</div>
          <div className="text-xs text-slate-500">{c.subtitle}</div>
        </div>
      </div>

      {revealed ? (
        <>
          {winner && <WinnerSpotlight n={winner} />}
          {rest.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-600 px-1">Finalists</div>
              {rest.map((n, i) => <NomineeRow key={n.playerId ?? `${n.name}-${i}`} n={n} />)}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-600 px-1">Nominees</div>
            {c.nominees.map((n, i) => <NomineeRow key={n.playerId ?? `${n.name}-${i}`} n={n} />)}
          </div>
          <button onClick={onReveal} className="mt-1 w-full rounded-lg bg-amber-500/15 hover:bg-amber-500/25 ring-1 ring-amber-500/40 text-amber-300 text-sm font-medium py-2 transition-colors">
            🏆 Reveal winner
          </button>
        </>
      )}
    </div>
  );
}

export default function AwardsCeremony({ categories, locked }: { categories: CeremonyCategory[]; locked?: boolean }) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const allRevealed = revealed.size === categories.length && categories.length > 0;
  const reveal = (cat: string) => setRevealed((s) => new Set(s).add(cat));

  return (
    <div className="space-y-4">
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
      {!locked && (
        <div className="flex items-center justify-end gap-2">
          {!allRevealed ? (
            <button onClick={() => setRevealed(new Set(categories.map((c) => c.category)))} className="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold px-4 py-2 transition-colors">
              Reveal all winners
            </button>
          ) : (
            <button onClick={() => setRevealed(new Set())} className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium px-4 py-2 transition-colors">
              ↺ Reset ceremony
            </button>
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <TrophyCard key={c.category} c={c} locked={locked} revealed={revealed.has(c.category)} onReveal={() => reveal(c.category)} />
        ))}
      </div>
    </div>
  );
}
