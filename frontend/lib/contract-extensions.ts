// Contract rollover to a new league year + in-season extensions.
//
// Player.contractYears counts seasons left INCLUDING the current league year
// (LeagueConfig.contractYear, July 1 start). When the league clock crosses July 1
// the year rolls: every running deal loses a year (1 → 0 = expired, which the
// Free Agent Frenzy sweep then sends to UFA/RFA), retention on an expired deal ends,
// and a pending extension (Player.ext*, signed in-season — NHL rule: it starts next
// season) becomes the player's contract. Idempotent: runs once per league year.
import { prisma } from "./prisma";
import { CURRENT_SEASON_START, TWO_WAY_AHL_SALARY, setCurrentSeasonStart } from "./finance";

const leagueYearOf = (d: Date) => (d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1);

/** Start every signed extension whose current deal has run out. */
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
        resignStatus: null, resignRound: 0, resignCounterSalary: null, resignCounterYears: null,
      },
    });
  }
  return due.length;
}

export type ContractRollover = { rolled: false; year: number } | { rolled: true; from: number; to: number; expired: number; running: number; extensions: number };

/** Roll contracts into the league year of `leagueDate` (default: the league clock). */
export async function rollContractsIfDue(leagueDate?: Date): Promise<ContractRollover> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { contractYear: true, leagueDate: true } });
  if (!cfg) return { rolled: false, year: CURRENT_SEASON_START };
  const date = leagueDate ?? cfg.leagueDate;
  setCurrentSeasonStart(cfg.contractYear);
  if (!date || leagueYearOf(date) <= cfg.contractYear) return { rolled: false, year: cfg.contractYear };

  const from = cfg.contractYear, to = leagueYearOf(date);
  const steps = to - from;
  // claim the year first (conditional update) so two overlapping ticks can't both roll
  const claimed = await prisma.leagueConfig.updateMany({ where: { id: 1, contractYear: from }, data: { contractYear: to } });
  if (!claimed.count) return { rolled: false, year: to };
  setCurrentSeasonStart(to);

  const [expired, running] = await prisma.$transaction([
    // deals that end with this rollover — retention by a former club ends with them
    prisma.player.updateMany({ where: { contractYears: { gt: 0, lte: steps } }, data: { contractYears: 0, retainedSalary: 0 } }),
    prisma.player.updateMany({ where: { contractYears: { gt: steps } }, data: { contractYears: { decrement: steps } } }),
  ]);
  const extensions = await applyPendingExtensions();
  await prisma.transaction.create({ data: { type: "LEAGUE", message: `📅 New league year ${to}-${String((to + 1) % 100).padStart(2, "0")}: ${expired.count} contracts expired, ${extensions} extensions kicked in.` } }).catch(() => {});
  return { rolled: true, from, to, expired: expired.count, running: running.count, extensions };
}
