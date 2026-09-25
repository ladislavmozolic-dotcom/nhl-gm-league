import { isAdmin } from "@/lib/auth";
import { loadSettings } from "@/lib/sim/settings";

// Staged rollout of UNHL Intelligence (admin ▸ Simulation ▸ "UNHL Intelligence").
// The commissioner always gets everything; GMs get what the rollout level opens.
export type IntelligenceAccess = { admin: boolean; basic: boolean; full: boolean };

export async function intelligenceAccess(): Promise<IntelligenceAccess> {
  const [admin, settings] = await Promise.all([isAdmin(), loadSettings().catch(() => null)]);
  const rollout = settings?.intelligenceRollout ?? "full";
  if (admin) return { admin, basic: true, full: true };
  return { admin, basic: rollout !== "hidden", full: rollout === "full" };
}
