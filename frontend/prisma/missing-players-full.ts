import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      birthDate: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  fs.writeFileSync(
    "missing-players.json",
    JSON.stringify(players, null, 2)
  );

  console.log(
    `Saved ${players.length} players`
  );
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });