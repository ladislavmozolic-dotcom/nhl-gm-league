"use client";

import { useRouter, useSearchParams } from "next/navigation";

/** Team filter for the Edge calculator — keeps the current Skaters/Goalies view. */
export default function EdgeTeamSelect({ teams, value }: { teams: string[]; value: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const set = (code: string) => {
    const p = new URLSearchParams(sp.toString());
    if (code) p.set("team", code); else p.delete("team");
    router.push(`/tools/edge-calculator?${p.toString()}`);
  };
  return (
    <select value={value} onChange={(e) => set(e.target.value)}
      className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm">
      <option value="">All teams</option>
      {teams.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}
