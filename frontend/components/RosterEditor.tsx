"use client";

import { useMemo, useState, useTransition } from "react";
import PlayerLink from "@/components/PlayerLink";
import Link from "next/link";
import { BackPill } from "@/components/ui";
import type { RosterRow } from "@/app/teams/[slug]/roster/actions";
import { useLang } from "@/components/LangProvider";

type Player = {
  id: number;
  name: string;
  position: string;
  number: number | null;
  overall: number;
  captaincy: "C" | "A" | null;
  isGoalie: boolean;
};

type Props = {
  teamName: string;
  teamSlug: string;
  players: Player[];
  onSave: (slug: string, rows: RosterRow[]) => Promise<{ ok: boolean; error?: string } | void>;
  embedded?: boolean;
};

function RosterTable({
  title,
  list,
  dupNums,
  onChange,
  isCs,
}: {
  title: string;
  list: Player[];
  dupNums: Set<number>;
  onChange: (id: number, patch: Partial<Player>) => void;
  isCs: boolean;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2.5 px-1">
        <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <span>{title.includes("Brank") || title.includes("Goal") ? "🥅" : "🏒"}</span>
          <span>{title}</span>
        </h2>
        <span className="text-xs font-mono font-bold text-slate-500">
          {list.length} {isCs ? (list.length === 1 ? "hráč" : list.length < 5 ? "hráči" : "hráčov") : list.length === 1 ? "player" : "players"}
        </span>
      </div>

      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-x-auto shadow-xl backdrop-blur-md">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800 bg-slate-850/60 font-semibold">
              <th className="text-left px-4 py-3 w-28">{isCs ? "Číslo" : "Number"}</th>
              <th className="text-left px-4 py-3">{isCs ? "Hráč" : "Player"}</th>
              <th className="text-center px-3 py-3 w-16">{isCs ? "Poz" : "Pos"}</th>
              <th className="text-center px-3 py-3 w-16">OVR</th>
              <th className="text-right px-4 py-3 w-48">{isCs ? "Funkcia (C/A)" : "Leadership"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {list.map((p) => {
              const isDuplicate = p.number != null && dupNums.has(p.number);
              return (
                <tr key={p.id} className="hover:bg-slate-800/40 transition-colors group">
                  {/* Jersey number */}
                  <td className="px-4 py-2.5">
                    <div className="relative inline-flex items-center">
                      <span className="absolute left-2.5 text-[10px] font-mono font-bold text-slate-500 pointer-events-none">
                        #
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={p.number ?? ""}
                        onChange={(e) =>
                          onChange(p.id, { number: e.target.value ? Number(e.target.value) : null })
                        }
                        className={`w-16 bg-slate-850/90 border rounded-xl pl-6 pr-2.5 py-1 text-right tabular-nums text-xs font-black transition-all focus:outline-none focus:ring-2 ${
                          isDuplicate
                            ? "border-rose-500 text-rose-300 bg-rose-950/30 focus:ring-rose-500/50"
                            : "border-slate-700/80 text-white focus:border-blue-500 focus:ring-blue-500/30"
                        }`}
                      />
                    </div>
                  </td>

                  {/* Player Name */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <PlayerLink id={p.id} name={p.name} className="font-semibold text-xs sm:text-sm text-slate-100 group-hover:text-blue-400 transition-colors" />
                      {p.captaincy && (
                        <span
                          className={`text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border shadow-sm ${
                            p.captaincy === "C"
                              ? "bg-amber-500 text-black border-amber-300 font-extrabold"
                              : "bg-slate-300 text-slate-900 border-white font-bold"
                          }`}
                        >
                          {p.captaincy}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Position */}
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                      {p.position}
                    </span>
                  </td>

                  {/* Overall */}
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-xs font-black tabular-nums text-slate-200">
                      {p.overall}
                    </span>
                  </td>

                  {/* Captaincy Segmented Buttons */}
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {!p.isGoalie ? (
                      <div className="inline-flex rounded-xl bg-slate-800/80 p-0.5 border border-slate-700/60 text-xs">
                        <button
                          type="button"
                          onClick={() => onChange(p.id, { captaincy: null })}
                          className={`px-2.5 py-0.5 rounded-lg font-bold text-[10px] transition-all ${
                            !p.captaincy
                              ? "bg-slate-700 text-slate-200 shadow-sm"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          —
                        </button>
                        <button
                          type="button"
                          onClick={() => onChange(p.id, { captaincy: "C" })}
                          className={`px-2.5 py-0.5 rounded-lg font-black text-[10px] transition-all flex items-center gap-1 ${
                            p.captaincy === "C"
                              ? "bg-amber-500 text-black shadow-md shadow-amber-500/30"
                              : "text-amber-400/80 hover:text-amber-300"
                          }`}
                        >
                          <span>C</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onChange(p.id, { captaincy: "A" })}
                          className={`px-2.5 py-0.5 rounded-lg font-black text-[10px] transition-all flex items-center gap-1 ${
                            p.captaincy === "A"
                              ? "bg-slate-200 text-slate-900 shadow-md shadow-slate-300/30"
                              : "text-slate-300/80 hover:text-white"
                          }`}
                        >
                          <span>A</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-600 text-xs font-mono">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RosterEditor({ teamName, teamSlug, players, onSave, embedded = false }: Props) {
  const lang = useLang();
  const isCs = lang === "cs";

  const [rows, setRows] = useState<Player[]>(players);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (id: number, patch: Partial<Player>) => {
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSaved(false);
  };

  const captain = rows.find((r) => r.captaincy === "C");
  const alternates = rows.filter((r) => r.captaincy === "A");
  const caps = captain ? 1 : 0;
  const alts = alternates.length;

  const dupNums = useMemo(() => {
    const seen = new Map<number, number>();
    for (const r of rows) if (r.number != null) seen.set(r.number, (seen.get(r.number) ?? 0) + 1);
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([num]) => num));
  }, [rows]);

  const problems: string[] = [];
  if (rows.filter((r) => r.captaincy === "C").length > 1)
    problems.push(isCs ? "Povolený je len jeden kapitán (C)." : "Only one captain (C) allowed.");
  if (alts > 2) problems.push(isCs ? "Maximálne dvaja asistenti (A)." : "At most two alternates (A).");
  if (dupNums.size)
    problems.push(
      isCs
        ? `Duplicitné čísla dresov: ${[...dupNums].join(", ")}.`
        : `Duplicate jersey numbers: ${[...dupNums].join(", ")}.`
    );

  const save = () =>
    start(async () => {
      setErr(null);
      try {
        const res = await onSave(
          teamSlug,
          rows.map((r) => ({ id: r.id, number: r.number, captaincy: r.captaincy }))
        );
        if (res && !res.ok) {
          setErr(res.error ?? (isCs ? "Súpisku sa nepodarilo uložiť." : "Couldn't save."));
          return;
        }
        setSaved(true);
      } catch (e) {
        setErr((e as Error).message);
      }
    });

  const skaters = rows.filter((r) => !r.isGoalie);
  const goalies = rows.filter((r) => r.isGoalie);

  return (
    <div className={embedded ? "pb-32" : "max-w-4xl mx-auto px-4 pb-32 space-y-6"}>
      {/* Leadership Deck */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md">
        {!embedded && (
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
                {teamName} — {isCs ? "Čísla dresov a lídri" : "Roster Leadership"}
              </h1>
              <div className="flex gap-4 text-xs mt-1.5 items-center">
                <BackPill href={`/teams/${teamSlug}`}>{isCs ? "tím" : "team"}</BackPill>
                <Link href={`/teams/${teamSlug}/lines`} className="text-slate-400 hover:text-blue-400 transition-colors">
                  {isCs ? "Editor formácií →" : "Line editor →"}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Leadership Preview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Captain Slot */}
          <div className="p-3.5 rounded-xl bg-slate-850/60 border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-black text-sm shadow-sm">
                C
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  {isCs ? "KAPITÁN TÍMU" : "TEAM CAPTAIN"}
                </span>
                <span className="text-sm font-bold text-white block">
                  {captain ? (
                    <>
                      {captain.number != null && <span className="text-slate-400 font-mono mr-1">#{captain.number}</span>}
                      {captain.name}
                    </>
                  ) : (
                    <span className="text-slate-500 italic">{isCs ? "Nepriradený (0/1)" : "Unassigned (0/1)"}</span>
                  )}
                </span>
              </div>
            </div>
            <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-full ${caps === 1 ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-slate-800 text-slate-500"}`}>
              {caps}/1
            </span>
          </div>

          {/* Alternates Slot */}
          <div className="p-3.5 rounded-xl bg-slate-850/60 border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-slate-300/20 text-slate-200 border border-slate-300/40 flex items-center justify-center font-black text-sm shadow-sm">
                A
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  {isCs ? "ASISTENTI KAPITÁNA" : "ALTERNATE CAPTAINS"}
                </span>
                <span className="text-sm font-bold text-white block">
                  {alternates.length > 0 ? (
                    alternates.map((a) => a.name).join(", ")
                  ) : (
                    <span className="text-slate-500 italic">{isCs ? "Nepriradení (0/2)" : "Unassigned (0/2)"}</span>
                  )}
                </span>
              </div>
            </div>
            <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-full ${alts === 2 ? "bg-slate-200/20 text-slate-200 border border-slate-300/30" : "bg-slate-800 text-slate-500"}`}>
              {alts}/2
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-3">
          {isCs
            ? "Zadajte čísla dresov od 0 do 99 (nesmú byť duplicitné) a vyberte jedného kapitána (C) a najviac dvoch asistentov (A)."
            : "Set jersey numbers from 0 to 99 (no duplicates allowed) and designate one captain (C) and up to two alternates (A)."}
        </p>
      </div>

      {problems.length > 0 && (
        <div className="text-sm text-rose-300 bg-rose-950/50 border border-rose-800/80 rounded-2xl px-5 py-3 font-semibold shadow-lg">
          ⚠️ {problems.join(" ")}
        </div>
      )}

      <RosterTable
        title={isCs ? "Korčuliari" : "Skaters"}
        list={skaters}
        dupNums={dupNums}
        onChange={set}
        isCs={isCs}
      />
      <RosterTable
        title={isCs ? "Brankári" : "Goaltenders"}
        list={goalies}
        dupNums={dupNums}
        onChange={set}
        isCs={isCs}
      />

      {/* Floating Save Toolbar */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 border-t border-slate-800/90 backdrop-blur-xl px-4 py-3 z-30 shadow-2xl">
        <div className="max-w-4xl mx-auto flex items-center gap-3.5 flex-wrap">
          <button
            onClick={save}
            disabled={pending || problems.length > 0}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-extrabold text-sm disabled:opacity-50 transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2"
          >
            {pending ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{isCs ? "Ukladá sa…" : "Saving…"}</span>
              </>
            ) : (
              <span>{isCs ? "Uložiť zmeny" : "Save changes"}</span>
            )}
          </button>

          {problems.length > 0 && (
            <span className="text-rose-400 text-xs font-semibold">
              {isCs ? "Pred uložením opravte chyby" : "Fix issues to save"}
            </span>
          )}
          {saved && <span className="text-emerald-400 text-sm font-bold">{isCs ? "✓ Uložené" : "✓ Saved"}</span>}
          {err && <span className="text-rose-400 text-sm font-medium">{err}</span>}
        </div>
      </div>
    </div>
  );
}
