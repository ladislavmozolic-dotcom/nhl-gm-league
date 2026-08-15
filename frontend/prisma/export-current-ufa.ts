import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      team: {
        code: "UFA",
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  fs.writeFileSync(
    "ufa-backup.json",
    JSON.stringify(players, null, 2)
  );

  console.log(players.length);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
