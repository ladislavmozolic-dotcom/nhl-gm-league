// Admin TEST MODE. A sandbox instance is a second copy of the app pointed at a
// CLONED database (scripts/ops/sandbox-refresh.sh) and started with SANDBOX=1.
// It must never reach the outside world (mail, Discord) or run the auto-sim
// scheduler on its own — the admin drives it by hand.
export const isSandbox = (): boolean => process.env.SANDBOX === "1";
