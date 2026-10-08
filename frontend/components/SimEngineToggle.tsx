// The V1/V2 league switch is retired — every game runs on the next-gen (V2) engine.
export default function SimEngineToggle() {
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
