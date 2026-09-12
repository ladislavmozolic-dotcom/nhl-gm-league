"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { money } from "@/lib/finance";
import { claimWaiverAction } from "@/app/waivers/actions";
import type { WaiverRow, WaiverPriorityRow } from "@/lib/waivers-server";

const clauseTag = (c?: string | null) => c === "NMC" ? "NMC" : c === "M_NTC" ? "M-NTC" : c === "NTC" ? "NTC" : null;

export default function WaiverWire({ waivers, myTeamId, inSeason, order }: { waivers: WaiverRow[]; myTeamId: number | null; inSeason: boolean; order: WaiverPriorityRow[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: "ok" | "err"; s: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => start(async () => {
    setMsg(null);
    const r = await fn();
    setMsg(r.ok ? { t: "ok", s: okMsg } : { t: "err", s: r.error ?? "Failed." });
  });

  return (
    <div className="space-y-5">
      {order.length > 0 && (
        <Card title="Claim Priority Order" accent="text-sky-400">
          <p className="text-xs text-slate-500 mb-3">
            Who wins a contested claim, first in line first — {inSeason
              ? <>currently the <b>worst team in the standings</b></>
              : <>currently a <b>claim-order queue</b> (whoever&apos;s gone longest without winning a claim)</>
            }. A club drops to the back of this line the moment it wins a claim.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {order.map((t) => (
              <div key={t.teamId} title={t.name}
                className={`flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-lg border text-xs ${t.teamId === myTeamId ? "bg-sky-600/20 border-sky-500/50 text-sky-200" : "bg-slate-900/60 border-slate-800 text-slate-400"}`}>
                <span className="text-[10px] font-bold tabular-nums text-slate-500">{t.rank}</span>
                {t.logoUrl && <img src={t.logoUrl} alt="" className="w-4 h-4 object-contain" />}
                <span className="font-semibold">{t.code}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card title="Waiver Wire" accent="text-sky-400">
        <p className="text-xs text-slate-500 mb-3">
          A player must clear waivers before he can be sent to the AHL. Any club can claim him within a one-day window; if more than one does, {inSeason
            ? <>the <b>worst team in the standings gets priority</b></>
            : <>outside the regular season/playoffs, priority follows a <b>claim-order queue</b> — whichever claiming club has gone longest without winning a claim gets him, and it then drops to the back of the line</>
          }. Unclaimed players clear and drop to the affiliate. An <b>NMC blocks waivers</b>; an NTC does not. Waiving a player is final — there's no pull-back, claim or no claim.
          {" "}A one-way player gets a <b>recall pass</b> after a call-up, too — he can be sent back to the farm without waivers as long as it&apos;s been <b>30 days or 10 NHL games or fewer</b> since that recall; cross either and his next trip down needs to clear the wire like normal (see Roster Moves for the pass status).
        </p>
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
                    {w.playerSlug ? (
                      <Link href={`/players/${w.playerSlug}`} className="font-medium text-white hover:text-blue-400">{w.playerName}</Link>
                    ) : (
                      <span className="font-medium">{w.playerName}</span>
                    )} <span className="text-slate-500 text-xs">{w.position}</span>
                    {tag && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">{tag}</span>}
                    <span className="ml-2 text-xs text-slate-500">from <b className="text-slate-400">{w.fromCode}</b> · {money(w.capHit)}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {w.claims.length > 0 ? <>claims: {w.claims.map((c) => c.code).join(", ")}</> : "no claims yet"}
                  </div>
                  {myTeamId != null && (mine ? (
                    <span className="text-xs text-slate-600 italic" title="Waiving is final — there's no pull-back">no action</span>
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
