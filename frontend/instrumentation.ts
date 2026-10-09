// Starts the automatic-simulation scheduler when the Node server boots.
// Runs only in the Node.js runtime (not edge), once per process.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { authConfig } = await import("./lib/auth-config");
  authConfig(); // Fail closed before starting jobs if production secrets are missing.
  // a live round cut short by this restart picks up where the clock is now (sandbox included — that's where V3/live runs)
  setTimeout(() => {
    import("./lib/season-cron").then((m) => m.resumeLiveDayAtBoot()).then((r) => console.log(`[live] boot check: ${r}`)).catch((e) => console.error("[live] boot resume failed", e));
  }, 5000);
  if (process.env.SANDBOX === "1") { console.log("[sandbox] test mode — auto-sim scheduler disabled"); return; }
  const g = globalThis as unknown as { __autoSimStarted?: boolean };
  if (g.__autoSimStarted) return;
  g.__autoSimStarted = true;

  const { runAutoSimIfDue, runDraftImportIfDue, checkFrenzyRoundCloseIfDue, checkFrenzyDecisionsIfDue } = await import("./lib/sim/auto");
  const { autoOpenFrenzyIfDue } = await import("./lib/season-cron");
  const tick = () => {
    runAutoSimIfDue().catch((e) => console.error("[auto-sim] error", e));
    runDraftImportIfDue().catch((e) => console.error("[auto-draft] error", e));
    checkFrenzyRoundCloseIfDue().catch((e) => console.error("[auto-frenzy] error", e));
    checkFrenzyDecisionsIfDue().catch((e) => console.error("[auto-frenzy-decisions] error", e));
    autoOpenFrenzyIfDue().catch((e) => console.error("[auto-frenzy-open] error", e));
  };
  setTimeout(tick, 8000);          // catch-up shortly after boot
  setInterval(tick, 60_000);       // then check every minute
  console.log("[auto-sim] scheduler started");
}
