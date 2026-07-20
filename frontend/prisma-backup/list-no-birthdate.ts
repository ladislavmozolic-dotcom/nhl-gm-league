import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      birthDate: null,
    },
    select: {
      name: true,
      slug: true,
      frozenPoolUrl: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  console.table(players);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });