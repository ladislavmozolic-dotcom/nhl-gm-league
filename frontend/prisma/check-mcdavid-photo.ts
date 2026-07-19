import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const player = await prisma.player.findFirst({
    where: {
      name: {
        contains: "McDavid",
      },
    },
    select: {
      name: true,
      photoUrl: true,
      nhlId: true,
    },
  });

  console.log(player);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });