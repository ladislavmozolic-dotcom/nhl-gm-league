import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      birthDate: null,
      frozenPoolId: {
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      frozenPoolId: true,
      frozenPoolUrl: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  fs.writeFileSync(
    "missing-frozenpool-players.json",
    JSON.stringify(players, null, 2)
  );

  console.log(`Saved ${players.length} players`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });