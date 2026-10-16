import { prisma } from "@/lib/prisma";
import { isSandbox } from "@/lib/sandbox";
import { resolveSimEngine } from "@/lib/sim/version";
import { setSandboxEngineAction } from "@/app/admin/simulation/actions";

// The commissioner's whole-league engine switch: V2 (next-gen, the long-running league engine) or V3
// (realism package + V3 Core decisions). Games simulated from now on use the chosen engine; played games keep theirs.
export default async function SimEngineToggle() {
  const sandbox = isSandbox();
  const lc = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { simEngine: true } });
  const active = resolveSimEngine(lc?.simEngine);
  const btn = (engine: "nextgen" | "v3", label: string) => (
    <button
      name="engine" value={engine}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold border ${active === engine ? (engine === "v3" ? "bg-emerald-600 border-emerald-500 text-white" : "bg-sky-700 border-sky-600 text-white") : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}
    >{label}</button>
  );
  return (
    <div className={`rounded-2xl border ${sandbox ? "border-red-900" : "border-slate-800"} bg-slate-900/60 p-5`}>
      <div className="text-sm font-semibold text-slate-100">{sandbox ? "TEST MODE · " : ""}League sim engine: {active === "v3" ? "V3" : "Next-Gen (V2)"}</div>
      <div className="mt-1 text-xs text-slate-500">
        Applies to every game simulated from now on (season, pre-season, playoffs, live rounds). Games already played keep the engine they were played with.
        {!sandbox && <> V3 changes how the league reads: about half the PIM and shootouts, ~2 fewer shots a team, more home wins and back-to-backs that matter — best switched at the start of a season. One click switches back.</>}
      </div>
      <form action={setSandboxEngineAction} className="mt-3 flex gap-2">
        {btn("nextgen", "V2 (Next-Gen)")}
        {btn("v3", "V3")}
      </form>
    </div>
  );
}
