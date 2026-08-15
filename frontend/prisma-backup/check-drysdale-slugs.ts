

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      frozenPoolPlayerSlug: "jamie-drysdale",
    },
    select: {
      name: true,
      nhlId: true,
      birthDate: true,
    },
  });

  console.log("Count:", players.length);
  console.table(players);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });