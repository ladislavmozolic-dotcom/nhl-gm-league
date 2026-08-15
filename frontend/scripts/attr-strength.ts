// Compute each NHL team's strength from the ENGINE's actual ability formulas (not OV),
// to check whether "OV outliers" like Anaheim are justified by their real attributes.
//   npx tsx scripts/attr-strength.ts
import { prisma } from "../lib/prisma";

const fin = (a: any) => 0.55 * (a.sc ?? 50) + 0.2 * (a.ph ?? 50) + 0.1 * (a.ps ?? 50) + 0.15 * (a.sk ?? 50);
const play = (a: any) => 0.55 * (a.pa ?? 50) + 0.25 * (a.ph ?? 50) + 0.2 * (a.sk ?? 50);
const def = (a: any) => 0.45 * (a.df ?? 50) + 0.25 * (a.ck ?? 50) + 0.15 * (a.sk ?? 50) + 0.15 * (a.st ?? 50);
const gq = (g: any) => 0.22 * (g.ag ?? 50) + 0.18 * (g.rb ?? 50) + 0.15 * (g.sz ?? 50) + 0.15 * (g.hs ?? 50) + 0.15 * (g.rt ?? 50) + 0.1 * (g.sc ?? 50) + 0.05 * (g.ph ?? 50);

async function main() {
  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true } });
  const rows: { code: string; ov: number; eng: number; skAbil: number; gQual: number }[] = [];
  for (const t of teams) {
    const skaters = await prisma.player.findMany({ where: { teamId: t.id, isGoalie: false }, select: { overall: true, sc: true, pa: true, df: true, sk: true, st: true, ck: true, ph: true, ps: true } });
    const goalies = await prisma.player.findMany({ where: { teamId: t.id, isGoalie: true }, select: { overall: true, goalieRating: { select: { ag: true, rb: true, sz: true, hs: true, rt: true, sc: true, ph: true, overall: true } } } });
    // top-18 skaters by engine ability
    const abil = skaters.map((s) => (fin(s) + play(s) + def(s)) / 3).sort((a, b) => b - a).slice(0, 18);
    const skAbil = abil.reduce((a, b) => a + b, 0) / (abil.length || 1);
    const gvals = goalies.map((g) => (g.goalieRating ? gq(g.goalieRating) : (g.overall ?? 50))).sort((a, b) => b - a);
    const gQual = gvals[0] ?? 50;
    const ovSk = skaters.map((s) => s.overall ?? 0).sort((a, b) => b - a).slice(0, 18);
    const ov = (ovSk.reduce((a, b) => a + b, 0) / (ovSk.length || 1)) * 0.8 + (goalies.map((g) => g.overall ?? 0).sort((a, b) => b - a)[0] ?? 0) * 0.2;
    const eng = skAbil * 0.78 + gQual * 0.22;
    rows.push({ code: t.code, ov: +ov.toFixed(1), eng: +eng.toFixed(1), skAbil: +skAbil.toFixed(1), gQual: +gQual.toFixed(1) });
  }
  const byEng = [...rows].sort((a, b) => b.eng - a.eng); byEng.forEach((r, i) => (r as any).engRank = i + 1);
  const byOv = [...rows].sort((a, b) => b.ov - a.ov); byOv.forEach((r, i) => (r as any).ovRank = i + 1);
  console.log("=== ENGINE-ATTR strength vs OV strength (rank) ===");
  console.log("  #Eng Team  engStr  skAbil  gQual   | #OV (ovStr)   Δ(ov-eng rank)");
  byEng.forEach((r) => {
    const dv = (r as any).ovRank - (r as any).engRank;
    console.log(`  ${String((r as any).engRank).padStart(2)}  ${r.code.padEnd(4)} ${r.eng.toFixed(1).padStart(6)} ${r.skAbil.toFixed(1).padStart(6)} ${r.gQual.toFixed(1).padStart(6)}   | #${(r as any).ovRank} (${r.ov})   ${dv > 0 ? "+" + dv : dv}`);
  });
  const ana = rows.find((r) => r.code === "ANA")!;
  console.log(`\n>>> ANAHEIM: engine-strength rank #${(ana as any) && byEng.find(x=>x.code==='ANA') ? (byEng.find(x=>x.code==='ANA') as any).engRank : "?"}  ·  OV-strength rank #${(byOv.find(x=>x.code==='ANA') as any).ovRank}`);
  console.log(`    ANA skater-ability ${ana.skAbil}, goalie-quality ${ana.gQual}  (vs OV ${ana.ov})`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
