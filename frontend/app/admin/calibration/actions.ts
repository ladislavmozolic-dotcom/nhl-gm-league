"use server";

import { isAdmin } from "@/lib/auth";
import { runCalibration, type CalReport } from "@/lib/sim/calibration";

/** Run a full in-memory calibration pass (a double round-robin) and grade every
 *  metric against its NHL target. Admin-gated; ~3s, no DB writes. */
export async function runCalibrationAction(): Promise<{ ok: true; report: CalReport } | { ok: false; error: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Admin only." };
  const report = await runCalibration();
  return { ok: true, report };
}
