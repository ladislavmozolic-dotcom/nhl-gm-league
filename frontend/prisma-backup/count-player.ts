import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const teams = await prisma.team.findMany({
    where: {
      league: "NHL",
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
  });

  console.table(teams);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });