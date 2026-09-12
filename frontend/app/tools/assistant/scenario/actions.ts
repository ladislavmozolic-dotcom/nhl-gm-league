"use server";

import { redirect } from "next/navigation";
import { getTeamSession } from "@/lib/auth";

// Server actions for the Scenario Engine's "add a hypothetical move" forms.
// Every action just edits the comma-separated `moves` list carried in the
// page's own URL (see lib/gm-assistant/scenarioEngine.ts encode/parseMoves)
// and redirects back — nothing here ever touches a live Player/Team row.

function movesFromForm(formData: FormData): string[] {
  return String(formData.get("currentMoves") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function backTo(moves: string[], extra?: Record<string, string>) {
  const params = new URLSearchParams(extra);
  if (moves.length) params.set("moves", moves.join(","));
  const qs = params.toString();
  redirect(`/tools/assistant/scenario${qs ? `?${qs}` : ""}`);
}

export async function addSignMoveAction(formData: FormData) {
  if ((await getTeamSession()) == null) return;
  const playerId = Number(formData.get("playerId"));
  const capHit = Math.max(0, Math.round(Number(formData.get("capHit")) || 0));
  const years = Math.max(1, Math.min(8, Math.round(Number(formData.get("years")) || 1)));
  const moves = movesFromForm(formData);
  if (Number.isFinite(playerId)) moves.push(`sign:${playerId}:${capHit}:${years}`);
  backTo(moves);
}

export async function addWalkMoveAction(formData: FormData) {
  if ((await getTeamSession()) == null) return;
  const playerId = Number(formData.get("playerId"));
  const moves = movesFromForm(formData);
  if (Number.isFinite(playerId)) moves.push(`walk:${playerId}`);
  backTo(moves);
}

export async function addTradeMoveAction(formData: FormData) {
  if ((await getTeamSession()) == null) return;
  const partnerTeamId = Number(formData.get("partnerTeamId"));
  const giveIds = formData.getAll("give").map(Number).filter(Number.isFinite);
  const getIds = formData.getAll("get").map(Number).filter(Number.isFinite);
  const moves = movesFromForm(formData);
  if (Number.isFinite(partnerTeamId) && (giveIds.length || getIds.length)) {
    moves.push(`trade:${partnerTeamId}:${giveIds.join(".")}:${getIds.join(".")}`);
  }
  backTo(moves, Number.isFinite(partnerTeamId) ? { partner: String(partnerTeamId) } : undefined);
}

export async function removeMoveAction(formData: FormData) {
  if ((await getTeamSession()) == null) return;
  const index = Number(formData.get("index"));
  const moves = movesFromForm(formData);
  if (Number.isFinite(index) && index >= 0 && index < moves.length) moves.splice(index, 1);
  backTo(moves);
}
