import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.player.count({
    where: {
      nhlId: {
        not: null,
      },
    },
  });

  const withContracts = await prisma.player.count({
    where: {
      nhlId: {
        not: null,
      },
      capHit: {
        not: null,
      },
    },
  });

  console.log({
    totalNhlPlayers: total,
    withContracts,
    missing: total - withContracts,
    coverage:
      (
        (withContracts / total) *
        100
      ).toFixed(2) + "%",
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });