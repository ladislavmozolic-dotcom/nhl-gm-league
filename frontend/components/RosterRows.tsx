"use client";

import ClauseStar from "@/components/ClauseStar";
import { useMemo, useState } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/playerAvatar";
import { cleanName } from "@/lib/playerName";
import { posGroup, ratingColor, ovColor } from "@/lib/ratingBands";
import { isWorthyGoalie } from "@/lib/goalie-rule";
import { useLang } from "@/components/LangProvider";

const parseCap = (t: string | null) => {
  if (!t) return 0;
  const m = t.match(/[\d,]+/);
  return m ? parseInt(m[0].replace(/,/g, ""), 10) : 0;
};

const salaryOf = (p: any) => ((p.contractYears ?? 0) > 0 ? p.capHit || parseCap(p.contractText) : 0);
const fmtM = (v: number) => (v > 0 ? `$${Math.round(v).toLocaleString("en-US").replace(/,/g, " ")}` : "—");

type Col = { key: string; label: string; num: boolean };

/** The interactive (click-to-sort) roster table body for one section. */
export default function RosterRows({
  players,
  attrs,
  isGoalie,
  farm,
  hideAttrs = false,
  onOfferTwoWay,
}: {
  players: any[];
  attrs: string[];
  isGoalie: boolean;
  farm?: boolean;
  hideAttrs?: boolean;
  onOfferTwoWay?: (player: any) => void;
}) {
  const lang = useLang();
  const isEn = lang === "en";

  const displayedSalary = (p: any) => {
    const nhlSalary = salaryOf(p);
    return farm && p.contractType === "TWO_WAY" && p.ahlSalary != null ? p.ahlSalary : nhlSalary;
  };

  const cols: Col[] = [
    { key: "name", label: isEn ? "Player" : "Hráč", num: false },
    { key: "number", label: "#", num: true },
    { key: "position", label: isEn ? "Pos" : "Poz", num: false },
    { key: "age", label: isEn ? "Age" : "Vek", num: true },
    { key: "condition", label: "CON", num: true },
    ...(hideAttrs ? [] : attrs.map((a) => ({ key: a, label: a.toUpperCase(), num: true }))),
    { key: "overall", label: "OVR", num: true },
    { key: "salary", label: farm ? (isEn ? "AHL Salary" : "AHL Plat") : isEn ? "Salary" : "Plat", num: true },
  ];

  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const click = (c: Col) =>
    setSort((s) => (s && s.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: c.num ? -1 : 1 }));

  const val = (p: any, k: string) =>
    k === "name" ? cleanName(p.name).toLowerCase() : k === "salary" ? displayedSalary(p) : p[k];

  const rows = useMemo(() => {
    if (!sort) return players;
    return [...players].sort((a, b) => {
      const va = val(a, sort.key),
        vb = val(b, sort.key);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sort.dir;
      return String(va).localeCompare(String(vb)) * sort.dir;
    });
  }, [players, sort]);

  const arrow = (k: string) => (sort?.key === k ? (sort.dir === -1 ? " ▾" : " ▴") : "");
  const thBase = "px-3 py-3 font-semibold cursor-pointer hover:text-white transition-colors select-none";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase tracking-wider bg-slate-850/80">
            {cols.map((c, i) => (
              <th
                key={c.key}
                onClick={() => click(c)}
                title={isEn ? "Sort" : "Zoradiť"}
                className={`${thBase} ${sort?.key === c.key ? "text-blue-400 bg-blue-950/20" : ""} ${
                  i === 0
                    ? "text-left sticky left-0 bg-slate-900 z-10 min-w-[200px]"
                    : c.key === "salary"
                    ? "text-right"
                    : "text-center"
                } ${c.num && c.key !== "salary" ? "w-11" : ""}`}
              >
                {c.label}
                {arrow(c.key)}
              </th>
            ))}
            {onOfferTwoWay && (
              <th className="px-3 py-3 font-semibold text-right whitespace-nowrap text-[10px] uppercase tracking-wider">
                {isEn ? "Contract" : "Zmluva"}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {rows.map((player) => {
            const nhlSalary = salaryOf(player);
            const salary = displayedSalary(player);
            const grp = isGoalie ? ("G" as const) : posGroup(player.position, false);
            const capRole = player.capRole ?? player.captaincy;

            return (
              <tr key={player.id} className="hover:bg-slate-800/40 transition-colors group">
                {/* Sticky Player Name & Avatar Column */}
                <td className="px-3 py-2 sticky left-0 bg-slate-900 z-10 group-hover:bg-slate-850 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center gap-2.5">
                    <div className="shrink-0 relative">
                      <PlayerAvatar src={player.photoUrl} alt={player.name} size={34} />
                      {capRole && (
                        <span
                          className={`absolute -bottom-1 -right-1 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border shadow-sm ${
                            capRole === "C"
                              ? "bg-amber-500 text-black border-amber-300 font-extrabold"
                              : "bg-slate-300 text-slate-900 border-white font-bold"
                          }`}
                        >
                          {capRole}
                        </span>
                      )}
                    </div>

                    <div className="min-w-max">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/players/${player.slug}`}
                          className="font-medium text-xs sm:text-sm text-slate-100 group-hover:text-blue-400 transition-colors whitespace-nowrap block"
                        >
                          {cleanName(player.name)}
                        </Link>
                        <ClauseStar player={player} />
                        {isGoalie && isWorthyGoalie(player) && (
                          <span
                            className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 inline-block shrink-0"
                            title={isEn ? "Worthy goalie — meets minimum goalie criteria" : "Kvalifikovaný brankár — spĺňa ligové kritériá"}
                          />
                        )}
                      </div>

                      {farm && player.affiliate && (
                        <p className="text-[10px] font-mono text-emerald-400/80">
                          {player.affiliate.code || player.affiliate.name}
                        </p>
                      )}

                      {(player.injuryDaysLeft ?? 0) > 0 && (
                        <div
                          className="text-[10px] font-semibold flex items-center gap-1 whitespace-nowrap mt-0.5 text-rose-400"
                          title={player.injuryDesc || (isEn ? "Injured" : "Zranený")}
                        >
                          <span aria-hidden>🩹</span>
                          {(player.condition ?? 100) < 90 && !player.isGoalie ? (
                            <span className="font-bold bg-sky-500/20 text-sky-300 px-1 py-0.2 rounded border border-sky-500/30">
                              LTIR
                            </span>
                          ) : (
                            <span className="font-bold bg-rose-500/20 text-rose-300 px-1 py-0.2 rounded border border-rose-500/30">
                              IR
                            </span>
                          )}
                          <span>
                            · {player.injuryDaysLeft}d
                            {player.injuryDesc ? ` · ${player.injuryDesc}` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Jersey number */}
                <td className="px-2 py-2 text-center text-slate-500 font-mono text-xs tabular-nums">
                  {player.number ?? "—"}
                </td>

                {/* Position */}
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60">
                    {player.position}
                  </span>
                </td>

                {/* Age */}
                <td className="px-3 py-2 text-center text-slate-400 text-xs tabular-nums">
                  {player.age || "—"}
                </td>

                {/* Condition (CON) */}
                <td className="px-3 py-2 text-center tabular-nums">
                  {(() => {
                    const con = player.condition;
                    if (con == null) return <span className="text-slate-600 text-xs">—</span>;
                    const c =
                      con >= 95
                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                        : con >= 85
                        ? "text-green-400 bg-green-500/10 border-green-500/20"
                        : con >= 70
                        ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                        : "text-rose-400 bg-rose-500/10 border-rose-500/20";
                    return (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border tabular-nums ${c}`}>
                        {Math.round(con)}%
                      </span>
                    );
                  })()}
                </td>

                {/* Attributes heatmap */}
                {!hideAttrs &&
                  attrs.map((a) => (
                    <td
                      key={a}
                      className={`px-2 py-2 text-center text-xs tabular-nums font-semibold ${ratingColor(
                        grp,
                        a,
                        player[a]
                      )}`}
                    >
                      {player[a] ?? "—"}
                    </td>
                  ))}

                {/* Overall Rating (OVR) */}
                <td className="px-2.5 py-2 text-center">
                  <span
                    className={`inline-block text-xs font-black tabular-nums px-2 py-0.5 rounded-md border ${ovColor(
                      grp,
                      player.overall
                    )}`}
                  >
                    {player.overall || "—"}
                  </span>
                </td>

                {/* Salary */}
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <span
                    className={`font-bold tabular-nums text-xs ${
                      salary > 0 ? "text-slate-100" : "text-slate-600"
                    }`}
                  >
                    {fmtM(salary)}
                  </span>
                  {(() => {
                    const yr = player.contractText?.match(/(\d+)\s*yr/i)?.[1];
                    return yr ? (
                      <span className="text-[10px] text-slate-500 tabular-nums ml-1.5">
                        ({yr} {yr === "1" ? (isEn ? "yr" : "rok") : isEn ? "yrs" : "roky"})
                      </span>
                    ) : null;
                  })()}
                </td>

                {/* Two-Way Offer Action / Contract Type */}
                {onOfferTwoWay && (
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {nhlSalary === 100_000 ? (
                      <button
                        onClick={() => onOfferTwoWay(player)}
                        title={
                          isEn
                            ? "Offer a real two-way deal: NHL salary on call-up, $100k salary on the farm"
                            : "Ponúknuť dvojcestnú zmluvu: NHL plat pri povolaní, $100k na farme"
                        }
                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
                      >
                        2-Way
                      </button>
                    ) : player.contractType === "TWO_WAY" ? (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        title={
                          player.ahlSalary != null
                            ? `$${nhlSalary.toLocaleString("en-US")} NHL / $${player.ahlSalary.toLocaleString(
                                "en-US"
                              )} AHL`
                            : `Legacy contract — $${nhlSalary.toLocaleString("en-US")}`
                        }
                      >
                        2-way
                      </span>
                    ) : player.contractType === "ONE_WAY" ? (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        title={`One-way contract — $${nhlSalary.toLocaleString("en-US")}`}
                      >
                        1-way
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
