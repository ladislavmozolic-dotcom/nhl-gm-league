"use client";

import { useState } from "react";
import Link from "next/link";

export type StandingRow = {
  teamId: number;
  name: string;
  code: string | null;
  logoUrl: string | null;
  slug: string | null;
  gp: number;
  w: number;
  l: number;
  otl: number;
  points: number;
};

export default function HomeStandingsTabs({
  east,
  west,
  labels,
}: {
  east: StandingRow[];
  west: StandingRow[];
  labels: { eastern: string; western: string; standings: string; viewAll: string };
}) {
  const [tab, setTab] = useState<"east" | "west">("east");
  const rows = tab === "east" ? east : west;

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0b1120] p-4 shadow-xl">
      <div className="flex items-center justify-between gap-2 mb-3.5 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-1.5 p-0.5 rounded-xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => setTab("east")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              tab === "east"
                ? "bg-sky-500 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {labels.eastern}
          </button>
          <button
            onClick={() => setTab("west")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              tab === "west"
                ? "bg-rose-500 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {labels.western}
          </button>
        </div>
        <Link
          href="/standings"
          className="text-xs text-slate-400 hover:text-sky-400 font-semibold transition-colors"
        >
          {labels.viewAll} →
        </Link>
      </div>

      <div className="overflow-x-auto custom-scroll">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800/60 pb-1">
              <th className="text-left font-semibold pb-1.5 pl-1">Tím</th>
              <th className="text-right font-semibold pb-1.5 pl-2">Z</th>
              <th className="text-right font-semibold pb-1.5 pl-2">V</th>
              <th className="text-right font-semibold pb-1.5 pl-2">P</th>
              <th className="text-right font-semibold pb-1.5 pl-2">PP</th>
              <th className="text-right font-black text-sky-400 pb-1.5 pl-2 pr-1">B</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {rows.map((t, i) => (
              <tr
                key={t.teamId}
                className="hover:bg-slate-800/40 transition-colors group"
              >
                <td className="py-1.5 pl-1 pr-1">
                  {t.slug ? (
                    <Link
                      href={`/teams/${t.slug}`}
                      className="flex items-center gap-2 group-hover:text-sky-300 transition-colors"
                    >
                      <span className="text-slate-500 text-[11px] font-mono w-4 text-right">
                        {i + 1}
                      </span>
                      {t.logoUrl ? (
                        <span
                          className="inline-flex items-center justify-center rounded-lg bg-slate-800/80 border border-slate-700/60 p-0.5 shrink-0"
                          style={{ width: 22, height: 22, minWidth: 22 }}
                        >
                          <img
                            src={t.logoUrl}
                            alt=""
                            className="object-contain"
                            style={{ width: 16, height: 16, maxWidth: 16, maxHeight: 16 }}
                          />
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded bg-slate-800 shrink-0" />
                      )}
                      <span className="font-bold text-slate-200 truncate">
                        {t.code ?? t.name}
                      </span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[11px] font-mono w-4 text-right">
                        {i + 1}
                      </span>
                      {t.logoUrl && (
                        <span
                          className="inline-flex items-center justify-center rounded-lg bg-slate-800/80 border border-slate-700/60 p-0.5 shrink-0"
                          style={{ width: 22, height: 22, minWidth: 22 }}
                        >
                          <img
                            src={t.logoUrl}
                            alt=""
                            className="object-contain"
                            style={{ width: 16, height: 16, maxWidth: 16, maxHeight: 16 }}
                          />
                        </span>
                      )}
                      <span className="font-bold text-slate-200 truncate">
                        {t.code ?? t.name}
                      </span>
                    </div>
                  )}
                </td>
                <td className="py-1.5 text-right font-mono text-slate-400 pl-2">{t.gp}</td>
                <td className="py-1.5 text-right font-mono text-slate-300 pl-2">{t.w}</td>
                <td className="py-1.5 text-right font-mono text-slate-400 pl-2">{t.l}</td>
                <td className="py-1.5 text-right font-mono text-slate-500 pl-2">{t.otl}</td>
                <td className="py-1.5 text-right font-mono font-black text-white pl-2 pr-1">
                  {t.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
