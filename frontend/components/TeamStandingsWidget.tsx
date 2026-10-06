"use client";

import { useState } from "react";
import Link from "next/link";

export type StandingsWidgetTeam = {
  teamId: number;
  name: string;
  code: string | null;
  points: number;
  w: number;
  l: number;
  otl: number;
};

interface TeamStandingsWidgetProps {
  currentTeamId: number;
  conferenceName: string | null;
  divisionName: string | null;
  conferenceTeams: StandingsWidgetTeam[];
  divisionTeams: StandingsWidgetTeam[];
  lang?: string;
}

export default function TeamStandingsWidget({
  currentTeamId,
  conferenceName,
  divisionName,
  conferenceTeams,
  divisionTeams,
  lang = "en",
}: TeamStandingsWidgetProps) {
  const [tab, setTab] = useState<"conf" | "div">("conf");
  const isEn = lang !== "cs";

  const confLabel = isEn ? "Conference" : "Konferencia";
  const divLabel = isEn ? "Division" : "Divízia";

  const teams = tab === "conf" ? conferenceTeams : divisionTeams;
  const title = tab === "conf"
    ? (conferenceName ?? confLabel)
    : (divisionName?.replace(/\s+division$/i, "") ? (isEn ? `${divisionName.replace(/\s+division$/i, "")} Division` : `${divisionName.replace(/\s+division$/i, "")} Divízia`) : divLabel);

  return (
    <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
        <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5 truncate">
          <span>🏆</span> {title}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => setTab("conf")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
                tab === "conf"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {confLabel}
            </button>
            <button
              type="button"
              onClick={() => setTab("div")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
                tab === "div"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {divLabel}
            </button>
          </div>
          <Link href="/standings" className="text-[10px] text-sky-400 hover:underline ml-1">
            {isEn ? "All →" : "Celá →"}
          </Link>
        </div>
      </div>

      <div className="space-y-1 text-xs max-h-[460px] overflow-y-auto pr-0.5 scrollbar-thin">
        {teams.map((dt, idx) => {
          const isCurrent = dt.teamId === currentTeamId;
          const isPlayoffSpot = tab === "conf" && idx < 8;

          return (
            <div key={dt.teamId}>
              {/* Play-off hranica po 8. mieste v konferencii */}
              {tab === "conf" && idx === 8 && (
                <div className="border-t border-dashed border-emerald-500/40 my-1.5 py-0.5 text-[10px] text-center text-emerald-400/90 font-mono bg-emerald-950/20 rounded">
                  {isEn ? "--- Playoff Cutoff (Top 8 qualify) ---" : "--- Play-off hranica (Postupuje top 8) ---"}
                </div>
              )}
              <div
                className={`flex items-center justify-between p-1.5 rounded-lg transition-colors ${
                  isCurrent
                    ? "bg-amber-500/15 border border-amber-500/30 font-bold text-white shadow-sm"
                    : isPlayoffSpot
                    ? "text-slate-300 hover:bg-slate-900/60"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`font-mono w-4 shrink-0 text-center text-[11px] ${
                      isCurrent
                        ? "text-amber-400 font-bold"
                        : isPlayoffSpot
                        ? "text-emerald-400 font-bold"
                        : "text-slate-600"
                    }`}
                  >
                    {idx + 1}.
                  </span>
                  {dt.code && (
                    <img
                      src={`https://assets.nhle.com/logos/nhl/svg/${dt.code}_light.svg`}
                      className="w-4 h-4 object-contain shrink-0"
                      alt=""
                    />
                  )}
                  <span className={`truncate ${isCurrent ? "text-amber-300 font-bold" : ""}`}>
                    {dt.name}
                  </span>
                </div>
                <span className={`font-mono shrink-0 ml-2 ${isCurrent ? "font-black text-amber-400" : "font-bold text-slate-200"}`}>
                  {dt.points}{isEn ? " pts" : "b"} ({dt.w}-{dt.l}{dt.otl ? `-${dt.otl}` : ""})
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
