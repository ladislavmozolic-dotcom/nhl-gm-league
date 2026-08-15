import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.player.count({
    where: {
      capHit: null,
      nhlId: {
        not: null,
      },
    },
  });

  console.log("Missing contracts with NHL ID:", count);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });