import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const noNhlId = await prisma.player.count({
    where: {
      nhlId: null,
    },
  });

  console.log({
    noNhlId,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });