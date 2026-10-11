"use client";

import { cleanName } from "@/lib/playerName";
import { fmtClock } from "@/lib/sim/live-text";

type Side = { id: number; code: string | null; name: string };

export type LiveGoalItem = {
  seq: number;
  period: number;
  seconds: number;
  teamId?: number;
  teamCode?: string;
  scorerName: string;
  strength: string;
  emptyNet: boolean;
  assists: string[];
  seasonGoal?: number;
};

export type LivePenaltyItem = {
  seq: number;
  period: number;
  seconds: number;
  teamId?: number;
  teamCode?: string;
  playerName: string;
  penalty: string;
  minutes: number;
  severity: string;
  givesPP: boolean;
};

type Props = {
  periods: number[];
  goals: LiveGoalItem[];
  penalties: LivePenaltyItem[];
  home: Side;
  away: Side;
  logos: Record<number, string>;
};

const PENALTY_SK: Record<string, string> = {
  Tripping: "Podrazenie",
  Hooking: "Hákovanie",
  Roughing: "Hrubosť",
  Slashing: "Sekanie",
  "High-sticking": "Vysoká hokejka",
  "Cross-checking": "Krosček",
  Boarding: "Narazenie na mantinel",
  Interference: "Nedovolené bránenie",
  Holding: "Držanie",
  "Delay of game": "Zdržiavanie hry",
  Elbowing: "Faul lakťom",
  Charging: "Napadnutie",
  Fighting: "Bitka",
  Misconduct: "Osobný trest (10 min)",
  "Game Misconduct": "Trest do konca zápasu",
};

function formatPenaltyName(p: string) {
  return PENALTY_SK[p] ? `${PENALTY_SK[p]} (${p})` : p;
}

export default function LiveBoxscore({
  periods,
  goals,
  penalties,
  home,
  away,
  logos,
}: Props) {
  return (
    <div className="bg-[#0b1120]/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Boxscore Header */}
      <div className="px-4 sm:px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">
            Boxscore Zápasu · Góly &amp; Vylúčenia
          </h2>
        </div>
        <div className="flex items-center gap-2.5 text-xs font-mono">
          <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold">
            🚨 {goals.length} {goals.length === 1 ? "gól" : goals.length >= 2 && goals.length <= 4 ? "góly" : "gólov"}
          </span>
          <span className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold">
            ⏱️ {penalties.length} {penalties.length === 1 ? "trest" : penalties.length >= 2 && penalties.length <= 4 ? "tresty" : "trestov"}
          </span>
        </div>
      </div>

      {/* Periods list */}
      {periods.map((p) => {
        const pGoals = goals.filter((g) => g.period === p);
        const pPens = penalties.filter((x) => x.period === p);
        const pLabel =
          p === 1
            ? "1. TRETINA"
            : p === 2
            ? "2. TRETINA"
            : p === 3
            ? "3. TRETINA"
            : p === 4
            ? "PREDĹŽENIE (OT)"
            : `${p - 3}. PREDĹŽENIE`;

        return (
          <div key={p} className="border-b border-slate-800 last:border-0">
            {/* Period subheader */}
            <div className="px-4 sm:px-5 py-2.5 bg-slate-900/60 border-l-4 border-sky-500 text-xs font-black text-sky-400 uppercase tracking-widest flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                {pLabel}
              </span>
              <span className="text-[11px] font-mono text-slate-400 font-bold bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
                {pGoals.length}G · {pPens.length}P
              </span>
            </div>

            {/* 2-Column Split: Goals & Penalties */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 text-sm">
              {/* Goals Column */}
              <div className="p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-emerald-400 pb-1.5 border-b border-slate-800/60">
                  <span className="flex items-center gap-1.5">
                    <span>🚨</span> GÓLY ({pGoals.length})
                  </span>
                  <span className="text-[10px] text-slate-500 lowercase font-normal">strelec &amp; asistencie</span>
                </div>

                {pGoals.length === 0 && (
                  <div className="text-slate-600 text-xs italic py-3 text-center bg-slate-950/30 rounded-xl border border-slate-900">
                    Žiadny gól v tejto tretine
                  </div>
                )}

                {pGoals.map((g) => {
                  const isHome = g.teamId === home.id;
                  const t = isHome ? home : away;
                  const logo = logos[t.id];
                  const tCode = t.code ?? t.name;

                  return (
                    <div
                      key={g.seq}
                      className="bg-slate-950/90 hover:bg-slate-900/80 border border-slate-800/90 hover:border-slate-700 rounded-xl p-3 flex items-start gap-3 transition-all shadow-sm"
                    >
                      {/* Logo */}
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-900 border border-slate-700/80 p-1 flex items-center justify-center shrink-0 shadow">
                        {logo ? (
                          <img src={logo} alt={t.name} className="w-full h-full object-contain filter drop-shadow" />
                        ) : (
                          <span className="text-xs font-black text-sky-400 font-mono">{tCode}</span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            {fmtClock(g.seconds)}
                          </span>

                          {g.strength === "PP" && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              PP
                            </span>
                          )}
                          {g.strength === "SH" && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40">
                              SH
                            </span>
                          )}
                          {g.emptyNet && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                              EN
                            </span>
                          )}

                          <span className="font-black text-white text-sm sm:text-base">
                            {cleanName(g.scorerName)}
                          </span>

                          {g.seasonGoal != null && (
                            <span className="text-xs font-bold text-amber-400">
                              ({g.seasonGoal})
                            </span>
                          )}

                          <span className="text-xs font-mono font-extrabold text-slate-400 ml-auto bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {tCode}
                          </span>
                        </div>

                        {/* Assists */}
                        <div className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                          {g.assists.length > 0 ? (
                            <>
                              <span className="text-amber-400">🍎</span>
                              <span className="text-slate-200">
                                {g.assists.map(cleanName).join(", ")}
                              </span>
                            </>
                          ) : !g.emptyNet ? (
                            <span className="text-slate-500 italic text-[11px]">(bez asistencie)</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Penalties Column */}
              <div className="p-3 sm:p-4 space-y-3 bg-slate-950/30">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-amber-400 pb-1.5 border-b border-slate-800/60">
                  <span className="flex items-center gap-1.5">
                    <span>⏱️</span> VYLÚČENIA ({pPens.length})
                  </span>
                  <span className="text-[10px] text-slate-500 lowercase font-normal">tresty &amp; presilovky</span>
                </div>

                {pPens.length === 0 && (
                  <div className="text-slate-600 text-xs italic py-3 text-center bg-slate-950/30 rounded-xl border border-slate-900">
                    Žiadne vylúčenia v tejto tretine
                  </div>
                )}

                {pPens.map((x) => {
                  const isHome = x.teamId === home.id;
                  const t = isHome ? home : away;
                  const logo = logos[t.id];
                  const tCode = t.code ?? t.name;

                  return (
                    <div
                      key={x.seq}
                      className="bg-amber-950/15 hover:bg-amber-950/25 border border-amber-900/40 hover:border-amber-700/60 rounded-xl p-3 flex items-start gap-3 transition-all shadow-sm"
                    >
                      {/* Logo */}
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-amber-500/30 p-1 flex items-center justify-center shrink-0 shadow">
                        {logo ? (
                          <img src={logo} alt={t.name} className="w-full h-full object-contain filter drop-shadow" />
                        ) : (
                          <span className="text-xs font-bold text-amber-400 font-mono">{tCode}</span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            {fmtClock(x.seconds)}
                          </span>

                          <span className="font-black text-slate-100 text-sm">
                            {cleanName(x.playerName)}
                          </span>

                          <span className="text-xs font-mono font-extrabold text-slate-400 ml-auto bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {tCode}
                          </span>
                        </div>

                        <div className="text-xs text-amber-200/90 flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{formatPenaltyName(x.penalty)}</span>
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold font-mono text-[10px] border border-amber-500/30">
                            {x.minutes} min
                          </span>
                          {x.givesPP && (
                            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider bg-slate-900/80 px-1.5 py-0.5 rounded border border-amber-500/20">
                              ⚡ Presilovka
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
