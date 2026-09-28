// Shared "what group is this expiring contract in" labels — used by the per-team
// Contracts page (ContractSection) and the league-wide All Contracts tool, so both
// describe UFA/RFA/ELC identically. The actual classification rule lives in
// `ufaAtExpiry` (free-agency-server.ts): a player finishing a contract is always
// RFA or UFA at June 30 of the expiry year — ELC only applies to a genuine
// first-time signing (no contract on file yet), never a renewal.
export type ContractGroup = "ELC" | "RFA" | "UFA";

export const CONTRACT_GROUP_META: Record<ContractGroup, { title: string; blurb: string; accent: string }> = {
  UFA: { title: "UFA — Unrestricted", blurb: "27+ at June 30 — free to sign anywhere if they reach the market. Re-sign to keep them.", accent: "text-red-400" },
  RFA: { title: "RFA — Restricted", blurb: "26 or younger at June 30 — you hold their rights. Re-sign before they reach free agency.", accent: "text-blue-400" },
  ELC: { title: "ELC — Entry-Level", blurb: "Entry-level age (≤21) — their next deal is set by the ELC auto-formula (base + performance bonus).", accent: "text-green-400" },
};
