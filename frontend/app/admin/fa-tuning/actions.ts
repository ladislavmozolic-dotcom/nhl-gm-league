"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdmin, canEditPlayerContracts, getTeamSession } from "@/lib/auth";
import { loadSettings, saveSettings, mergeSettings, DEFAULT_SETTINGS } from "@/lib/sim/settings";
import { loadMarketPool, loadFaWeights, playerMarket, eliteTarget, maxContract, type FaMarketWeights } from "@/lib/free-agency-server";
import { faPosGroup, type FWeights, type DWeights, type GWeights } from "@/lib/free-agency";

async function actorName(): Promise<string> {
  const id = await getTeamSession();
  if (!id) return "Admin";
  const t = await prisma.team.findUnique({ where: { id }, select: { gmNickname: true, name: true } });
  return t?.gmNickname || t?.name || "Admin";
}

const fmtW = (w: { [k: string]: number }) => Object.entries(w).map(([k, v]) => `${k}:${v.toFixed(2)}`).join(" ");

export async function saveFaWeightsAction(weights: FaMarketWeights): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Admin only." };
  const before = await loadSettings();
  const changed =
    fmtW(before.faWeightF) !== fmtW(weights.f) ||
    fmtW(before.faWeightD) !== fmtW(weights.d) ||
    fmtW(before.faWeightG) !== fmtW(weights.g);
  await saveSettings(mergeSettings({ ...before, faWeightF: weights.f, faWeightD: weights.d, faWeightG: weights.g }));
  if (changed) {
    await prisma.faTuningAudit.create({
      data: {
        byName: await actorName(),
        summary: `Market weights → F [${fmtW(weights.f)}] · D [${fmtW(weights.d)}] · G [${fmtW(weights.g)}]`,
      },
    });
  }
  revalidatePath("/admin/fa-tuning");
  return { ok: true };
}

export async function resetFaWeightsAction(): Promise<FaMarketWeights> {
  if (!(await isAdmin())) throw new Error("Admin only.");
  const before = await loadSettings();
  await saveSettings(mergeSettings({ ...before, faWeightF: DEFAULT_SETTINGS.faWeightF, faWeightD: DEFAULT_SETTINGS.faWeightD, faWeightG: DEFAULT_SETTINGS.faWeightG }));
  await prisma.faTuningAudit.create({ data: { byName: await actorName(), summary: "Market weights reset to defaults" } });
  revalidatePath("/admin/fa-tuning");
  return { f: DEFAULT_SETTINGS.faWeightF, d: DEFAULT_SETTINGS.faWeightD, g: DEFAULT_SETTINGS.faWeightG };
}

export type PreviewRow = { id: number; name: string; grp: "F" | "D" | "G"; capHit: number; oldMarket: number; newMarket: number; oldAsk: number; newAsk: number };

type SamplePlayer = {
  id: number; name: string; position: string | null; isGoalie: boolean; capHit: number | null; age: number | null;
  sc: number | null; pa: number | null; df: number | null; sk: number | null;
  lastSeasonGP: number | null; lastSeasonPts: number | null;
  goalieRating: { ag: number | null; rb: number | null; sc: number | null; hs: number | null } | null;
};

/** Recompute a handful of marquee signed players' market rating + elite-ladder
 *  ask under a DRAFT weight set, without saving anything — lets an admin see
 *  the blast radius of a weight change before committing to it. Compared
 *  against the CURRENTLY SAVED weights, not necessarily the factory defaults. */
export async function previewFaWeightsAction(draft: { f: FWeights; d: DWeights; g: GWeights }): Promise<PreviewRow[]> {
  if (!(await isAdmin())) return [];
  const [oldWeights, maxSalary] = await Promise.all([loadFaWeights(), maxContract()]);
  const [oldPool, newPool] = await Promise.all([loadMarketPool(oldWeights), loadMarketPool(draft)]);

  const sample: SamplePlayer[] = await prisma.player.findMany({
    where: { rosterType: "NHL", capHit: { gt: 3_000_000 }, contractYears: { gt: 0 } },
    select: {
      id: true, name: true, position: true, isGoalie: true, capHit: true, age: true,
      sc: true, pa: true, df: true, sk: true, lastSeasonGP: true, lastSeasonPts: true,
      goalieRating: { select: { ag: true, rb: true, sc: true, hs: true } },
    },
    orderBy: { capHit: "desc" },
    take: 400,
  });

  const byGroup: Record<"F" | "D" | "G", SamplePlayer[]> = { F: [], D: [], G: [] };
  for (const p of sample) byGroup[faPosGroup(p.position, p.isGoalie)].push(p);

  const out: PreviewRow[] = [];
  for (const grp of ["F", "D", "G"] as const) {
    for (const p of byGroup[grp].slice(0, 4)) {
      const { market: oldMarket } = playerMarket(p, oldWeights);
      const { market: newMarket } = playerMarket(p, draft);
      out.push({
        id: p.id, name: p.name, grp, capHit: p.capHit ?? 0,
        oldMarket, newMarket,
        oldAsk: eliteTarget(p, grp, oldMarket, oldPool, maxSalary),
        newAsk: eliteTarget(p, grp, newMarket, newPool, maxSalary),
      });
    }
  }
  return out;
}

/** 1yr..4yr asking-price ladder — any subset may be set. A null/absent term
 *  falls back to the engine's own computed value for that term (see
 *  Expiring Contracts — Demand Watch, which reads this field directly). */
export type OverrideLadder = { 1: number | null; 2: number | null; 3: number | null; 4: number | null };
const EMPTY_LADDER: OverrideLadder = { 1: null, 2: null, 3: null, 4: null };

function parseLadder(raw: unknown): OverrideLadder {
  if (!raw || typeof raw !== "object") return { ...EMPTY_LADDER };
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return { 1: num(r["1"]), 2: num(r["2"]), 3: num(r["3"]), 4: num(r["4"]) };
}

export type OverrideRow = {
  id: number; name: string; teamName: string | null; position: string | null; isGoalie: boolean;
  capHit: number | null; ladder: OverrideLadder;
};

export async function searchPlayersForOverrideAction(query: string): Promise<OverrideRow[]> {
  if (!(await canEditPlayerContracts())) return [];
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = await prisma.player.findMany({
    where: { name: { contains: q, mode: "insensitive" }, rosterType: { in: ["NHL", "AHL"] } },
    select: { id: true, name: true, position: true, isGoalie: true, capHit: true, faOverrideLadder: true, team: { select: { name: true } } },
    orderBy: { capHit: "desc" },
    take: 20,
  });
  return rows.map((r) => ({
    id: r.id, name: r.name, teamName: r.team?.name ?? null, position: r.position, isGoalie: r.isGoalie, capHit: r.capHit,
    ladder: parseLadder(r.faOverrideLadder),
  }));
}

const money0 = (n: number) => `$${n.toLocaleString("en-US")}`;
const ladderSummary = (l: OverrideLadder) => ([1, 2, 3, 4] as const).map((t) => `${t}yr ${l[t] != null ? money0(l[t]!) : "—"}`).join(" · ");

/** Save the full 1-4yr ladder for one player. The 1yr rung also mirrors onto
 *  the legacy flat `faDemandOverride` (Free Agent Frenzy's own headline-ask
 *  override), so a hand-set ladder actually steers real negotiations too, not
 *  just the Demand Watch preview. Passing an all-null ladder clears both. */
export async function setPlayerOverrideAction(playerId: number, ladder: OverrideLadder, note?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await canEditPlayerContracts())) return { ok: false, error: "You don't have contract-edit access." };
  const before = await prisma.player.findUnique({ where: { id: playerId }, select: { name: true, faOverrideLadder: true } });
  if (!before) return { ok: false, error: "Player not found." };
  const beforeLadder = parseLadder(before.faOverrideLadder);
  const anySet = ([1, 2, 3, 4] as const).some((t) => ladder[t] != null);
  await prisma.player.update({
    where: { id: playerId },
    data: { faOverrideLadder: anySet ? ladder : Prisma.JsonNull, faDemandOverride: ladder[1] },
  });
  await prisma.faTuningAudit.create({
    data: {
      byName: await actorName(),
      playerId,
      summary: `${before.name}: demand ladder [${ladderSummary(beforeLadder)}] → [${ladderSummary(ladder)}]${note ? ` — ${note}` : ""}`,
    },
  });
  revalidatePath("/admin/fa-tuning");
  revalidatePath("/admin/expiring-contracts");
  return { ok: true };
}

export type AuditRow = { id: number; byName: string; playerId: number | null; summary: string; createdAt: string };

export async function recentFaAuditAction(): Promise<AuditRow[]> {
  if (!(await isAdmin())) return [];
  const rows = await prisma.faTuningAudit.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  return rows.map((r) => ({ id: r.id, byName: r.byName, playerId: r.playerId, summary: r.summary, createdAt: r.createdAt.toISOString() }));
}
