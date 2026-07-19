import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

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
    take: 5,
    select: {
      id: true,
      name: true,
    },
  });

  console.log(players);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });