"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { money } from "@/lib/finance";
import { claimWaiverAction, cancelWaiverAction } from "@/app/waivers/actions";
import type { WaiverRow } from "@/lib/waivers-server";

const clauseTag = (c?: string | null) => c === "NMC" ? "NMC" : c === "M_NTC" ? "M-NTC" : c === "NTC" ? "NTC" : null;

export default function WaiverWire({ waivers, myTeamId }: { waivers: WaiverRow[]; myTeamId: number | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: "ok" | "err"; s: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => start(async () => {
    setMsg(null);
    const r = await fn();
    setMsg(r.ok ? { t: "ok", s: okMsg } : { t: "err", s: r.error ?? "Failed." });
  });

  return (
    <div className="space-y-5">
      <Card title="Waiver Wire" accent="text-sky-400">
        <p className="text-xs text-slate-500 mb-3">A player must clear waivers before he can be sent to the AHL. Any club can claim him within a one-day window; if more than one does, the <b>worst team in the standings gets priority</b>. Unclaimed players clear and drop to the affiliate. An <b>NMC blocks waivers</b>; an NTC does not.</p>
        {waivers.length === 0 ? (
          <p className="text-sm text-slate-500">No players are on waivers right now.</p>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {waivers.map((w) => {
              const mine = w.fromTeamId === myTeamId;
              const alreadyClaimed = myTeamId != null && w.claims.some((c) => c.teamId === myTeamId);
              const tag = clauseTag(w.clause);
              return (
                <div key={w.id} className="py-2.5 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <span className="font-medium">{w.playerName}</span> <span className="text-slate-500 text-xs">{w.position}</span>
                    {tag && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">{tag}</span>}
                    <span className="ml-2 text-xs text-slate-500">from <b className="text-slate-400">{w.fromCode}</b> · {money(w.capHit)}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {w.claims.length > 0 ? <>claims: {w.claims.map((c) => c.code).join(", ")}</> : "no claims yet"}
                  </div>
                  {myTeamId != null && (mine ? (
                    <button onClick={() => run(() => cancelWaiverAction(w.id, myTeamId), "Pulled back.")} disabled={pending}
                      className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40">Pull back</button>
                  ) : (
                    <button onClick={() => run(() => claimWaiverAction(w.id, myTeamId), "Claim submitted.")} disabled={pending || alreadyClaimed}
                      className="text-xs px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40">{alreadyClaimed ? "Claimed ✓" : "Claim"}</button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        {msg && <div className={`mt-3 text-sm ${msg.t === "ok" ? "text-emerald-400" : "text-rose-400"}`}>{msg.s}</div>}
      </Card>
    </div>
  );
}
