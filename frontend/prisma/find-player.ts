import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const player = await prisma.player.findUnique({
    where: {
      id: 4913,
    },
  });

  console.dir(player, {
    depth: null,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });