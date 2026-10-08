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
  embedded?: boolean; // true when rendered under LinesNav (hide the own title/back links)
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
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">{title}</h2>
        <span className="text-xs text-slate-500">
          {list.length} {isCs ? (list.length === 1 ? "hráč" : list.length < 5 ? "hráči" : "hráčov") : list.length === 1 ? "player" : "players"}
        </span>
      </div>
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-x-auto shadow-md backdrop-blur">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-800 bg-slate-850/50">
              <th className="text-left px-3 py-2.5 w-24">{isCs ? "Číslo" : "Number"}</th>
              <th className="text-left px-3 py-2.5">{isCs ? "Hráč" : "Player"}</th>
              <th className="text-left px-2 py-2.5 w-16">{isCs ? "Poz" : "Pos"}</th>
              <th className="text-left px-2 py-2.5 w-14">OVR</th>
              <th className="text-left px-3 py-2.5 w-36">{isCs ? "Funkcia" : "Letter"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {list.map((p) => (
              <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={p.number ?? ""}
                    onChange={(e) =>
                      onChange(p.id, { number: e.target.value ? Number(e.target.value) : null })
                    }
                    className={`w-16 bg-slate-800 border rounded-lg px-2.5 py-1 text-right tabular-nums text-sm font-bold focus:outline-none focus:border-blue-500 transition-colors ${
                      p.number != null && dupNums.has(p.number)
                        ? "border-rose-500 text-rose-300 bg-rose-950/20"
                        : "border-slate-700 text-slate-200"
                    }`}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <PlayerLink id={p.id} name={p.name} className="font-medium hover:text-blue-400 transition-colors" />
                    {p.captaincy && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm">
                        {p.captaincy}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 text-slate-400 text-xs font-mono">{p.position}</td>
                <td className="px-2 py-2 text-slate-300 tabular-nums font-bold text-xs">{p.overall}</td>
                <td className="px-3 py-2">
                  {!p.isGoalie ? (
                    <select
                      value={p.captaincy ?? ""}
                      onChange={(e) =>
                        onChange(p.id, { captaincy: (e.target.value || null) as "C" | "A" | null })
                      }
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                    >
                      <option value="">—</option>
                      <option value="C">{isCs ? "Kapitán (C)" : "Captain (C)"}</option>
                      <option value="A">{isCs ? "Asistent (A)" : "Alternate (A)"}</option>
                    </select>
                  ) : (
                    <span className="text-slate-600 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
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

  const caps = rows.filter((r) => r.captaincy === "C").length;
  const alts = rows.filter((r) => r.captaincy === "A").length;
  const dupNums = useMemo(() => {
    const seen = new Map<number, number>();
    for (const r of rows) if (r.number != null) seen.set(r.number, (seen.get(r.number) ?? 0) + 1);
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([num]) => num));
  }, [rows]);

  const problems: string[] = [];
  if (caps > 1) problems.push(isCs ? "Povolený je len jeden kapitán (C)." : "Only one captain (C) allowed.");
  if (alts > 2) problems.push(isCs ? "Maximálne dvaja asistenti (A)." : "At most two alternates (A).");
  if (dupNums.size)
    problems.push(
      isCs
        ? `Duplicitné čísla dresov: ${[...dupNums].join(", ")}.`
        : `Duplicate numbers: ${[...dupNums].join(", ")}.`
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
    <div className={embedded ? "pb-28" : "max-w-3xl mx-auto px-4 pb-28"}>
      {embedded ? (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400">
            {isCs ? (
              <>
                Nastavte čísla <b className="text-slate-200">dresov</b> a <b className="text-slate-200">kapitána (C)</b> /{" "}
                <b className="text-slate-200">asistentov (A)</b>.
              </>
            ) : (
              <>
                Set jersey <b className="text-slate-200">numbers</b> and the <b className="text-slate-200">captain (C)</b> /{" "}
                <b className="text-slate-200">alternates (A)</b>.
              </>
            )}
          </p>
          <div className="text-xs text-slate-400 font-mono">
            {isCs ? "Kapitán" : "Captain"}: <span className="font-bold text-amber-400">{caps}/1</span> ·{" "}
            {isCs ? "Asistenti" : "Alternates"}: <span className="font-bold text-amber-400">{alts}/2</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {teamName} — {isCs ? "Čísla dresov a kapitáni" : "Roster Management"}
            </h1>
            <div className="flex gap-3 text-sm mt-1.5 items-center">
              <BackPill href={`/teams/${teamSlug}`}>{isCs ? "tím" : "team"}</BackPill>
              <Link href={`/teams/${teamSlug}/lines`} className="text-slate-400 hover:text-blue-400 transition-colors">
                {isCs ? "Editor formácií →" : "Line editor →"}
              </Link>
            </div>
          </div>
          <div className="text-xs text-slate-400 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg font-mono">
            {isCs ? "Kapitán" : "Captain"}: <span className="font-bold text-amber-400">{caps}/1</span> ·{" "}
            {isCs ? "Asistenti" : "Alternates"}: <span className="font-bold text-amber-400">{alts}/2</span>
          </div>
        </div>
      )}

      {problems.length > 0 && (
        <div className="mb-4 text-sm text-rose-300 bg-rose-950/40 border border-rose-800/50 rounded-xl px-4 py-2.5 font-medium">
          {problems.join(" ")}
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

      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md px-4 py-3 z-30 shadow-2xl">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={save}
            disabled={pending || problems.length > 0}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold text-sm disabled:opacity-50 transition-colors shadow-md shadow-blue-600/30"
          >
            {pending ? (isCs ? "Ukladá sa…" : "Saving…") : isCs ? "Uložiť súpisku" : "Save roster"}
          </button>
          {problems.length > 0 && (
            <span className="text-rose-400 text-xs font-semibold">
              {isCs ? "Pred uložením opravte chyby" : "Fix issues to save"}
            </span>
          )}
          {saved && <span className="text-emerald-400 text-sm font-bold">{isCs ? "✓ Uložené" : "✓ Saved"}</span>}
          {err && <span className="text-red-400 text-sm">{err}</span>}
        </div>
      </div>
    </div>
  );
}
