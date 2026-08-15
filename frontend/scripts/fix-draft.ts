import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const teams = await prisma.team.findMany({
    where: { parentTeamId: null },
    select: { id: true, profinhlLogoId: true, name: true },
  });

  for (const team of teams) {
    if (!team.profinhlLogoId) continue;
    
    await prisma.draftPick.updateMany({
      where: { teamId: team.id },
      data: { ownerLogoId: team.profinhlLogoId },
    });
    
    console.log(`${team.name}: ownerLogoId → ${team.profinhlLogoId}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
