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
    select: {
      name: true,
      birthDate: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  console.log(`TOTAL MISSING: ${players.length}`);

  for (const player of players) {
    console.log(
      `${player.name} | ${player.birthDate}`
    );
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });