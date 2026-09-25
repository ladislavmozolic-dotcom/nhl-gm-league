import Link from "next/link";
import { money } from "@/lib/finance";
import type { disciplineList } from "@/lib/discipline-server";
import { APPEAL_HOURS } from "@/lib/discipline-server";
import { AppealForm, RulingForm } from "@/components/PlayerSafety";

type Row = Awaited<ReturnType<typeof disciplineList>>[number];
const when = (d: Date) => d.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

/** One ruling card — shared by the public Player Safety page and the admin console. */
export function SuspensionItem({ r, myTeamId, admin, now }: { r: Row; myTeamId: number | null; admin: boolean; now: number }) {
  const canAppeal = r.kind === "SUSPENSION" && r.status === "ACTIVE" && !r.appealStatus && myTeamId != null && myTeamId === r.teamId && now - r.createdAt.getTime() <= APPEAL_HOURS * 3600000;
  const badge = r.kind === "FINE" ? { t: `Fined $${r.fine.toLocaleString("en-US")}`, c: "bg-slate-700 text-slate-200" }
    : r.status === "OVERTURNED" ? { t: "Overturned", c: "bg-emerald-800/60 text-emerald-200" }
    : r.status === "SERVED" ? { t: `${r.games} game${r.games === 1 ? "" : "s"} · served`, c: "bg-slate-700 text-slate-300" }
    : { t: `${r.games} game${r.games === 1 ? "" : "s"} · ${r.games - r.gamesServed} left`, c: "bg-red-700/70 text-white" };
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        {r.teamLogo && <img src={r.teamLogo} alt="" className="w-5 h-5 object-contain" />}
        {r.slug ? <Link href={`/players/${r.slug}`} className="font-bold text-slate-100 hover:text-blue-400">{r.playerName}</Link> : <b>{r.playerName}</b>}
        <span className="text-xs text-slate-500">{r.teamCode ?? ""}</span>
        <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${badge.c}`}>{badge.t}</span>
        {r.repeatOffender && <span className="rounded px-2 py-0.5 text-[11px] font-bold bg-amber-700/50 text-amber-200">repeat offender</span>}
        {r.source === "MANUAL" && <span className="text-[11px] text-slate-500">commissioner ruling</span>}
        <span className="ml-auto text-[11px] text-slate-500">{when(r.createdAt)}</span>
      </div>
      <p className="text-sm text-slate-400 mt-1">{r.incident}</p>
      {r.kind === "SUSPENSION" && r.forfeit > 0 && <p className="text-[11px] text-slate-500">Forfeits {money(r.forfeit)} of salary (CBA: {r.repeatOffender ? "1/82 per game — repeat offender" : "1/days-in-season per game"}).</p>}
      {r.appealStatus && (
        <div className="mt-1.5 text-xs rounded bg-slate-800/50 p-2">
          <span className="font-bold text-amber-300">Appeal: {r.appealStatus === "PENDING" ? "pending with the commissioner" : r.appealStatus.toLowerCase()}</span>
          {r.appealText && <p className="text-slate-400 mt-0.5">“{r.appealText}”</p>}
          {r.appealNote && <p className="text-slate-300 mt-0.5">Commissioner: {r.appealNote}</p>}
        </div>
      )}
      {canAppeal && <div className="mt-2"><AppealForm id={r.id} /></div>}
      {admin && r.kind === "SUSPENSION" && r.status !== "OVERTURNED" && (r.appealStatus === "PENDING" || r.status === "ACTIVE") && <RulingForm id={r.id} games={r.games} />}
    </li>
  );
}
