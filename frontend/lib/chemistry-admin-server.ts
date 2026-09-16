// Admin-only read model for lib/sim/chemistry.ts's pairwise/unit chemistry store
// (TeamLines.chemistry, keyed by pairSig for 5v5 bonds or a prefixed sig for
// special-teams units) — the SAME values lib/sim/ratings.ts reads straight into
// SimSkater.chem for the live sim, so editing one of these here changes the next
// sim directly, not just a Line Builder preview.

import { prisma } from "./prisma";
import { loadTeamLines } from "./sim/lines";
import { pairSig, unitPairs } from "./sim/chemistry";
import { loadSettings } from "./sim/settings";
import { cleanName } from "./playerName";

export type ChemBond = { sig: string; label: string; value: number | null };

export type TeamChemistryView = {
  base: number;
  forwardBonds: { line: number; bonds: ChemBond[] }[];
  defenseBonds: { pair: number; bonds: ChemBond[] }[];
  stUnits: { label: string; sig: string; value: number | null }[];
};

const ST_LABELS: { key: "pp" | "pp2" | "pp4" | "pp4-2" | "pk" | "pk2" | "pk3" | "pk3-2" | "ot" | "ot2" | "ot3"; label: string }[] = [
  { key: "pp", label: "PP1" }, { key: "pp2", label: "PP2" },
  { key: "pp4", label: "PP 4-on-3 A" }, { key: "pp4-2", label: "PP 4-on-3 B" },
  { key: "pk", label: "PK1" }, { key: "pk2", label: "PK2" },
  { key: "pk3", label: "PK3 (5-on-3) A" }, { key: "pk3-2", label: "PK3 (5-on-3) B" },
  { key: "ot", label: "OT 1" }, { key: "ot2", label: "OT 2" }, { key: "ot3", label: "OT 3" },
];

export async function teamChemistryView(teamId: number): Promise<TeamChemistryView | null> {
  const [lines, chemRow, settings] = await Promise.all([
    loadTeamLines(teamId),
    prisma.teamLines.findUnique({ where: { teamId }, select: { chemistry: true } }),
    loadSettings(),
  ]);
  if (!lines) return null;
  const chem = ((chemRow?.chemistry ?? {}) as Record<string, number>) || {};

  const ids = new Set<number>();
  for (const l of lines.forwardLines) [l.lw, l.c, l.rw].forEach((id) => id != null && ids.add(id));
  for (const p of lines.defensePairs) [p.ld, p.rd].forEach((id) => id != null && ids.add(id));
  for (const u of [...lines.situations.pp, ...lines.situations.pp4, ...lines.situations.pk4, ...lines.situations.pk3, ...lines.situations.overtime])
    u.players.forEach((id) => id != null && ids.add(id));
  const players = await prisma.player.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } });
  const nameOf = new Map(players.map((p) => [p.id, cleanName(p.name)]));
  const n = (id: number | null) => (id != null ? nameOf.get(id) ?? `#${id}` : "—");

  const roleLabels3 = ["LW", "C", "RW"];
  const forwardBonds = lines.forwardLines.map((l, i) => {
    const members = [l.lw, l.c, l.rw];
    const ids3 = members.filter((x): x is number => x != null);
    const bonds: ChemBond[] = unitPairs(ids3).map(([a, b]) => {
      const sig = pairSig(a, b);
      const ia = members.indexOf(a), ib = members.indexOf(b);
      return { sig, label: `${n(a)} (${roleLabels3[ia]}) ↔ ${n(b)} (${roleLabels3[ib]})`, value: chem[sig] ?? null };
    });
    return { line: i + 1, bonds };
  });

  const defenseBonds = lines.defensePairs.map((p, i) => {
    const ids2 = [p.ld, p.rd].filter((x): x is number => x != null);
    const bonds: ChemBond[] = ids2.length === 2
      ? [{ sig: pairSig(ids2[0], ids2[1]), label: `${n(p.ld)} (LD) ↔ ${n(p.rd)} (RD)`, value: chem[pairSig(ids2[0], ids2[1])] ?? null }]
      : [];
    return { pair: i + 1, bonds };
  });

  // minMembers mirrors buildStUnits in lib/sim/chemistry.ts exactly (pp/pk4 need
  // 3+ on the unit to count as a chemistry unit at all; pk3/ot need 2+) — a sig
  // built here must be one the real sim would actually create, or editing it
  // would be a harmless no-op that looks like it should do something.
  const stUnits: { label: string; sig: string; value: number | null }[] = [];
  const stUnitOf = (key: (typeof ST_LABELS)[number]["key"]): { players: (number | null)[] } | undefined => {
    switch (key) {
      case "pp": return lines.situations.pp[0]; case "pp2": return lines.situations.pp[1];
      case "pp4": return lines.situations.pp4[0]; case "pp4-2": return lines.situations.pp4[1];
      case "pk": return lines.situations.pk4[0]; case "pk2": return lines.situations.pk4[1];
      case "pk3": return lines.situations.pk3[0]; case "pk3-2": return lines.situations.pk3[1];
      case "ot": return lines.situations.overtime[0]; case "ot2": return lines.situations.overtime[1]; case "ot3": return lines.situations.overtime[2];
    }
  };
  const minMembers = (key: string) => (["pp", "pp2", "pp4", "pp4-2", "pk", "pk2"].includes(key) ? 3 : 2);
  for (const { key, label } of ST_LABELS) {
    const members = (stUnitOf(key)?.players ?? []).filter((x): x is number => x != null);
    if (members.length < minMembers(key)) continue;
    const sig = `${key}:${[...members].sort((a, b) => a - b).join("-")}`;
    stUnits.push({ label: `${label} (${members.map((id) => n(id)).join(", ")})`, sig, value: chem[sig] ?? null });
  }

  return { base: settings.chemistryBase, forwardBonds, defenseBonds, stUnits };
}
