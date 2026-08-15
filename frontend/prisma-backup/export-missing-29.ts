import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      OR: [
        { height: null },
        { weight: null },
        { shoots: null },
      ],
    },
    select: {
      name: true,
      birthDate: true,
      slug: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  fs.writeFileSync(
    "missing-29.json",
    JSON.stringify(players, null, 2)
  );

  console.log(
    `Exported ${players.length} players`
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
