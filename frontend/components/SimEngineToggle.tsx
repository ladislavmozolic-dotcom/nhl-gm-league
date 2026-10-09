import { prisma } from "@/lib/prisma";
import { isSandbox } from "@/lib/sandbox";
import { resolveSimEngine } from "@/lib/sim/version";
import { setSandboxEngineAction } from "@/app/admin/simulation/actions";

// Live: the V1/V2 switch is retired, every game runs on the next-gen (V2) engine.
// Test instance (SANDBOX=1): the commissioner can flip the whole test league to the experimental V3.
export default async function SimEngineToggle() {
  if (!isSandbox()) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧪</span>
          <div>
            <div className="text-sm font-semibold text-slate-100">League sim engine: Next-Gen (v2)</div>
            <div className="text-xs text-slate-500">The only engine in use — real hits/blocks/takeaways, live zone entries, line matchups and ejections. The old v1 switch was retired.</div>
          </div>
        </div>
      </div>
    );
  }
  const lc = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { simEngine: true } });
  const active = resolveSimEngine(lc?.simEngine, true);
  const btn = (engine: "nextgen" | "v3", label: string) => (
    <button
      name="engine" value={engine}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold border ${active === engine ? "bg-red-600 border-red-500 text-white" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}
    >{label}</button>
  );
  return (
    <div className="rounded-2xl border border-red-900 bg-slate-900/60 p-5">
      <div className="text-sm font-semibold text-slate-100">TEST MODE · league sim engine: {active === "v3" ? "V3 (experimental)" : "Next-Gen (v2)"}</div>
      <div className="mt-1 text-xs text-slate-500">Applies to every game simulated from now on in this test league (season, pre-season, playoffs). The live league always runs V2 — this switch does not exist there.</div>
      <form action={setSandboxEngineAction} className="mt-3 flex gap-2">
        {btn("nextgen", "V2 (live engine)")}
        {btn("v3", "V3 (experimental)")}
      </form>
    </div>
  );
}
