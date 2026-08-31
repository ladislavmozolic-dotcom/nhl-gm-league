"use client";

import { useRef, useState } from "react";
import { epProfileUrl } from "@/lib/playerName";

export type HoverPlayer = {
  name: string;
  position?: string | null;
  flag?: string;
  country?: string | null;
  shoots?: string | null;
  heightIn?: number | null;
  weightLb?: number | null;
  amateurLeague?: string | null;
  amateurClub?: string | null;
};

const fmtHeight = (h?: number | null) => (h ? `${Math.floor(h / 12)}'${h % 12}"` : null);

export default function EpHoverName({ player, children, className }: { player: HoverPlayer; children: React.ReactNode; className?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const showT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enter = (e: React.MouseEvent) => {
    if (hideT.current) clearTimeout(hideT.current);
    if (showT.current) clearTimeout(showT.current);
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.right, y = r.top;
    showT.current = setTimeout(() => setPos({ x, y }), 500);
  };
  const leave = () => {
    if (showT.current) clearTimeout(showT.current);
    hideT.current = setTimeout(() => setPos(null), 200);
  };

  const ht = fmtHeight(player.heightIn);
  const initials = player.name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  return (
    <span onMouseEnter={enter} onMouseLeave={leave} className={className}>
      {children}
      {pos && (
        <a
          href={epProfileUrl(player.name)} target="_blank" rel="noopener noreferrer"
          onMouseEnter={() => { if (hideT.current) clearTimeout(hideT.current); }}
          onMouseLeave={leave}
          style={{ position: "fixed", left: Math.min(pos.x + 14, vw - 360), top: Math.min(pos.y, vh - 240), zIndex: 60 }}
          className="block w-[340px] rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-4 hover:border-blue-500 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl bg-slate-800 ring-1 ring-slate-700 grid place-items-center overflow-hidden">
              {player.flag ? <span className="text-5xl leading-none">{player.flag}</span> : <span className="text-slate-500 text-lg font-bold">{initials}</span>}
            </div>
            <div className="min-w-0">
              <div className="text-xl font-bold text-slate-100 truncate">{player.name}</div>
              <div className="text-sm text-slate-400">{player.position ?? ""}{player.shoots ? ` · shoots ${player.shoots}` : ""}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {ht && <div><div className="text-[10px] uppercase tracking-wider text-slate-600">Height</div><div className="text-slate-200">{ht}</div></div>}
            {player.weightLb ? <div><div className="text-[10px] uppercase tracking-wider text-slate-600">Weight</div><div className="text-slate-200">{player.weightLb} lb</div></div> : null}
            {player.amateurClub && <div className="col-span-2"><div className="text-[10px] uppercase tracking-wider text-slate-600">Club</div><div className="text-slate-200">{player.amateurClub}</div></div>}
            <div><div className="text-[10px] uppercase tracking-wider text-slate-600">League</div><div className="text-slate-200">{player.amateurLeague ?? "—"}</div></div>
            <div><div className="text-[10px] uppercase tracking-wider text-slate-600">Country</div><div className="text-slate-200">{player.country ?? "—"}</div></div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800 text-sm font-semibold text-blue-400">Open EliteProspects profile ↗</div>
        </a>
      )}
    </span>
  );
}
