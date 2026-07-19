import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const player = await prisma.player.findFirst({
    where: {
      frozenPoolId: 4026,
    },
    select: {
      id: true,
      name: true,
      birthDate: true,
    },
  });

  console.log(player);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });