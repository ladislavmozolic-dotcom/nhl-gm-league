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
      slug: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  console.log(
    JSON.stringify(players, null, 2)
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });