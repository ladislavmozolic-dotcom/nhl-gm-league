"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { money } from "@/lib/finance";
import { placeOnWaiversAction } from "@/app/waivers/actions";

type MyPlayer = { id: number; name: string; position: string; capHit: number; clause: string | null; onWaivers: boolean };

// Team-scoped: expose your own NHL players on waivers. The league-wide wire (who's
// available + claims) lives at /waivers.
export default function WaiverPlacer({ teamId, players }: { teamId: number; players: MyPlayer[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: "ok" | "err"; s: string } | null>(null);
  const place = (id: number, name: string) => start(async () => {
    setMsg(null);
    const r = await placeOnWaiversAction(id, teamId);
    setMsg(r.ok ? { t: "ok", s: `${name} placed on waivers.` } : { t: "err", s: r.error ?? "Failed." });
  });

  return (
    <Card title="Place a player on waivers" accent="text-sky-400">
      <p className="text-xs text-slate-500 mb-2">A player must clear waivers before he can be sent to the AHL. He stays on your roster and cap until the window closes tomorrow; any club can claim him first (worst team in the standings gets priority). An <b>NMC blocks waivers</b>.</p>
      <div className="max-h-[46vh] overflow-y-auto divide-y divide-slate-800/60">
        {players.map((p) => {
          const nmc = p.clause === "NMC";
          return (
            <div key={p.id} className="py-2 flex items-center gap-3">
              <span className="flex-1 truncate text-sm">{p.name} <span className="text-slate-500 text-xs">{p.position}</span> <span className="text-slate-500 text-xs">{money(p.capHit)}</span></span>
              {p.onWaivers ? <span className="text-xs text-sky-400">on waivers</span>
                : nmc ? <span className="text-xs text-slate-600" title="No-movement clause">NMC — can't waive</span>
                : <button onClick={() => place(p.id, p.name)} disabled={pending}
                    className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40">Place on waivers</button>}
            </div>
          );
        })}
      </div>
      {msg && <div className={`mt-3 text-sm ${msg.t === "ok" ? "text-emerald-400" : "text-rose-400"}`}>{msg.s}</div>}
    </Card>
  );
}
