"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdmin, getTeamSession } from "@/lib/auth";
import { loadSettings, saveSettings, mergeSettings, DEFAULT_SETTINGS } from "@/lib/sim/settings";
import { loadMarketPool, loadFaWeights, playerMarket, eliteTarget, maxContract, type FaMarketWeights } from "@/lib/free-agency-server";
import { faPosGroup, type FWeights, type DWeights, type GWeights } from "@/lib/free-agency";

async function actorName(): Promise<string> {
  const id = await getTeamSession();
  if (!id) return "Admin";
  const t = await prisma.team.findUnique({ where: { id }, select: { gmNickname: true } });
  return t?.gmNickname || "Admin";
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

export type OverrideRow = {
  id: number; name: string; teamName: string | null; position: string | null; isGoalie: boolean;
  capHit: number | null; faDemandOverride: number | null;
};

export async function searchPlayersForOverrideAction(query: string): Promise<OverrideRow[]> {
  if (!(await isAdmin())) return [];
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = await prisma.player.findMany({
    where: { name: { contains: q, mode: "insensitive" }, rosterType: { in: ["NHL", "AHL"] } },
    select: { id: true, name: true, position: true, isGoalie: true, capHit: true, faDemandOverride: true, team: { select: { name: true } } },
    orderBy: { capHit: "desc" },
    take: 20,
  });
  return rows.map((r) => ({ id: r.id, name: r.name, teamName: r.team?.name ?? null, position: r.position, isGoalie: r.isGoalie, capHit: r.capHit, faDemandOverride: r.faDemandOverride }));
}

export async function setPlayerOverrideAction(playerId: number, value: number | null, note?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Admin only." };
  const before = await prisma.player.findUnique({ where: { id: playerId }, select: { name: true, faDemandOverride: true } });
  if (!before) return { ok: false, error: "Player not found." };
  await prisma.player.update({ where: { id: playerId }, data: { faDemandOverride: value } });
  const from = before.faDemandOverride != null ? `$${before.faDemandOverride.toLocaleString("en-US")}` : "computed";
  const to = value != null ? `$${value.toLocaleString("en-US")}` : "computed";
  await prisma.faTuningAudit.create({
    data: {
      byName: await actorName(),
      playerId,
      summary: `${before.name}: demand override ${from} → ${to}${note ? ` — ${note}` : ""}`,
    },
  });
  revalidatePath("/admin/fa-tuning");
  return { ok: true };
}

export type AuditRow = { id: number; byName: string; playerId: number | null; summary: string; createdAt: string };

export async function recentFaAuditAction(): Promise<AuditRow[]> {
  if (!(await isAdmin())) return [];
  const rows = await prisma.faTuningAudit.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  return rows.map((r) => ({ id: r.id, byName: r.byName, playerId: r.playerId, summary: r.summary, createdAt: r.createdAt.toISOString() }));
}
