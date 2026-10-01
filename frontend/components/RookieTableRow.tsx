"use client";

import { useState, useTransition } from "react";
import PlayerLink from "@/components/PlayerLink";
import { promoteRookieAction, promoteRookieWithOverridesAction } from "@/app/tools/player-calculator/actions";
import type { RookieRow } from "@/lib/edge-params-server";

const PARAM_COLS = ["CK", "FG", "DI", "SK", "ST", "EN", "DU", "PH", "FO", "PA", "SC", "DF", "PS", "EX", "LD", "OV"];

/** One row of the "Prospekti s reálnymi zápasmi" table. For an admin, every param
 *  cell is an editable number input pre-filled with the computed Next Gen rating —
 *  a GM can hand-adjust a value he doesn't trust (e.g. PA/SC inflated by a tiny
 *  hot-streak sample) before activating, instead of being stuck with the raw
 *  computed number. "Activate rating" sends whatever is currently in the inputs;
 *  untouched cells just activate the computed value as before. */
export default function RookieTableRow({ row, isAdmin }: { row: RookieRow; isAdmin: boolean }) {
  const [pending, start] = useTransition();
  // Text, not numbers, while editing — a controlled <input type="number"> bound to a
  // numeric value snaps back mid-edit (e.g. clearing the field to retype) because the
  // old number is still "valid"; keeping the raw string lets the admin freely clear
  // and retype, and only the final, parsed value is sent on activate.
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(row.ratings).map(([k, v]) => [k, String(v)])));
  const [edited, setEdited] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; s: string } | null>(null);

  const setVal = (k: string, raw: string) => {
    setInputs((s) => ({ ...s, [k]: raw }));
    setEdited(true);
  };

  const apply = () => start(async () => {
    const overrides: Record<string, number> = {};
    for (const [k, v] of Object.entries(inputs)) {
      const n = Number(v);
      if (v !== "" && Number.isFinite(n)) overrides[k] = n;
    }
    const r = edited ? await promoteRookieWithOverridesAction(row.playerId, overrides) : await promoteRookieAction(row.playerId);
    setStatus(r.ok ? { ok: true, s: "Activated ✓" } : { ok: false, s: r.error ?? "Failed" });
  });

  const gp = row.gp ?? (row.source === "AHL" ? row.ahlGP : (row.curSeasonGP + row.lastSeasonGP));

  return (
    <tr className="border-b border-slate-800/40 hover:bg-slate-800/30">
      <td className="px-3 py-1.5 font-medium"><PlayerLink id={row.playerId} slug={row.slug} name={row.name} /></td>
      <td className="px-2 py-1.5 text-center text-slate-400">
        {row.teamCode === "UFA" ? (
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-800/60">
            UFA
          </span>
        ) : (
          row.teamCode ?? "—"
        )}
      </td>
      <td className="px-2 py-1.5 text-center text-slate-400">{row.position}</td>
      <td className="px-2 py-1.5 text-center tabular-nums">{row.age ?? "—"}</td>
      <td className="px-2 py-1.5 text-center text-slate-400">{row.source}</td>
      <td className="px-2 py-1.5 text-center tabular-nums">{gp}</td>
      <td className="px-2 py-1.5 text-center tabular-nums">{row.g}</td>
      <td className="px-2 py-1.5 text-center tabular-nums">{row.a}</td>
      {PARAM_COLS.map((k) => (
        <td key={k} className="px-1 py-1 text-right">
          {isAdmin && !status?.ok ? (
            <input
              type="number" min={1} max={99}
              value={inputs[k] ?? ""}
              onChange={(e) => setVal(k, e.target.value)}
              className="w-12 bg-slate-800/60 border border-slate-700 rounded px-1 py-0.5 text-right text-xs tabular-nums text-slate-200 focus:outline-none focus:border-blue-500"
            />
          ) : (
            <span className="tabular-nums text-slate-300">{row.ratings[k] ?? "—"}</span>
          )}
        </td>
      ))}
      {isAdmin && (
        <td className="px-2 py-1.5 text-right">
          {status?.ok ? (
            <span className="text-xs text-green-400 font-semibold whitespace-nowrap">Activated ✓</span>
          ) : (
            <span className="flex items-center gap-2 justify-end whitespace-nowrap">
              {status && !status.ok && <span className="text-xs text-red-400">{status.s}</span>}
              <button onClick={apply} disabled={pending}
                className="px-3 py-1 rounded-md bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-semibold whitespace-nowrap disabled:opacity-50">
                {pending ? "…" : edited ? "Activate (upravené)" : "Activate rating"}
              </button>
            </span>
          )}
        </td>
      )}
    </tr>
  );
}
