// Starts the automatic-simulation scheduler when the Node server boots.
// Runs only in the Node.js runtime (not edge), once per process.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __autoSimStarted?: boolean };
  if (g.__autoSimStarted) return;
  g.__autoSimStarted = true;

  const { runAutoSimIfDue, runDraftImportIfDue } = await import("./lib/sim/auto");
  const tick = () => {
    runAutoSimIfDue().catch((e) => console.error("[auto-sim] error", e));
    runDraftImportIfDue().catch((e) => console.error("[auto-draft] error", e));
  };
  setTimeout(tick, 8000);          // catch-up shortly after boot
  setInterval(tick, 60_000);       // then check every minute
  console.log("[auto-sim] scheduler started");
}
