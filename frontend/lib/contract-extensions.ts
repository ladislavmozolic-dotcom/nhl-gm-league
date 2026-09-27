// In-season extensions (NHL rule): a final-year player re-signed once the regular
// season is underway plays out his current deal; the new one waits in Player.ext*
// and becomes his contract once the current one has run out (contractYears 0).
// Called from the daily date rollover and before any expired-contract → UFA sweep,
// so an extended player can never slip into free agency.
import { prisma } from "./prisma";
import { CURRENT_SEASON_START, TWO_WAY_AHL_SALARY } from "./finance";

export async function applyPendingExtensions(): Promise<number> {
  const due = await prisma.player.findMany({
    where: { extCapHit: { not: null }, extYears: { gt: 0 }, OR: [{ contractYears: null }, { contractYears: { lte: 0 } }] },
    select: { id: true, extCapHit: true, extYears: true, extContractType: true, extClause: true, extNoTradeTeams: true, extText: true },
  });
  for (const p of due) {
    const years = p.extYears!;
    await prisma.player.update({
      where: { id: p.id },
      data: {
        capHit: p.extCapHit!, contractYears: years, contractExpiry: CURRENT_SEASON_START + years,
        contractType: p.extContractType ?? "ONE_WAY", tradeClause: p.extClause, noTradeTeams: p.extNoTradeTeams, contractText: p.extText,
        ahlSalary: p.extContractType === "TWO_WAY" ? TWO_WAY_AHL_SALARY : null,
        extCapHit: null, extYears: null, extContractType: null, extClause: null, extNoTradeTeams: [], extText: null,
        resignStatus: null,
      },
    });
  }
  return due.length;
}
