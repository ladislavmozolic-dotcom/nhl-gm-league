"use server";

import { executeRevertSigning } from "@/lib/revert-signing-server";

/** Admin: undo a UFA signing / extension, restoring the player's prior contract. */
export async function revertSigningAction(logId: number) {
  return executeRevertSigning(logId);
}
