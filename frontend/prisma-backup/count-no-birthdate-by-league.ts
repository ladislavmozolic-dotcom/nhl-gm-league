import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      birthDate: null,
    },
    select: {
      team: {
        select: {
          league: true,
        },
      },
    },
  });

  const nhl = players.filter(
    p => p.team.league === "NHL"
  ).length;

  const ahl = players.filter(
    p => p.team.league === "AHL"
  ).length;

  console.log({
    total: players.length,
    nhl,
    ahl,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });