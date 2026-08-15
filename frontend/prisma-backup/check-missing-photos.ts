import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      OR: [
        { photoUrl: null },
        { photoUrl: "" },
      ],
    },
    select: {
      name: true,
      nhlId: true,
      photoUrl: true,
    },
    take: 100,
  });

  console.table(players);
  console.log("Missing photos:", players.length);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });