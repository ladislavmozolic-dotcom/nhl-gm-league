"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importChlAction, importWhlAction, seedWorldLeaguesAction } from "@/app/admin/world-data/actions";

export default function WorldLeagueSetup({ leagueCount }: { leagueCount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const seed = () => start(async () => {
    setMessage(null);
    const result = await seedWorldLeaguesAction();
    setMessage(result.ok ? `${result.count} competitions are ready for import.` : result.error);
    if (result.ok) router.refresh();
  });
  const importWhl = () => start(async () => {
    setMessage(null);
    const result = await importWhlAction();
    setMessage(result.ok ? `WHL ${result.season}: ${result.players} players, ${result.teams} teams, ${result.linked} prospect links.` : result.error);
    if (result.ok) router.refresh();
  });
  const importChl = () => start(async () => {
    setMessage(null);
    const result = await importChlAction();
    setMessage(result.ok ? result.results.map((r) => `${r.season}: ${r.players} players`).join(" · ") : result.error);
    if (result.ok) router.refresh();
  });
  return <div className="space-y-4"><div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="font-semibold">Competition catalog</div><p className="mt-1 text-sm text-slate-400">{leagueCount ? `${leagueCount} competition${leagueCount === 1 ? "" : "s"} enabled.` : "The catalog has not been initialized yet."} This only creates compact league records; it does not download images or bulk player data.</p><button onClick={seed} disabled={pending} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{pending ? "Preparing…" : leagueCount ? "Refresh competition catalog" : "Enable Around the World leagues"}</button>{message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}</div><div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-sm text-slate-400"><p className="font-semibold text-emerald-200">CHL live import</p><p className="mt-1">Imports current WHL, OHL and QMJHL teams plus skater/goalie stat lines from their public league feeds. Re-running it updates existing rows and only links an UNHL prospect when the name match is unique.</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={importChl} disabled={pending} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">{pending ? "Importing…" : "Import all CHL stats"}</button><button onClick={importWhl} disabled={pending} className="rounded-xl border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50">WHL only</button></div></div><div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-slate-400"><p className="font-semibold text-amber-200">Next: targeted Europe</p><p className="mt-1">European importers will only fetch UNHL-linked prospects, keeping the system compact while still giving every GM live progress on their assets.</p></div></div>;
}
