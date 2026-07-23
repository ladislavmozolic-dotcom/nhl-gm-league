import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      team: {
        code: "UFA",
      },
    },
    select: {
      name: true,
      slug: true,
    },
    orderBy: {
      name: "asc",
    },
    take: 50,
  });

  console.table(players);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });