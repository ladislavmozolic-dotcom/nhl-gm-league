import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const teams = await prisma.team.findMany({
    select: {
      name: true,
      profinhlName: true,
      profinhlLogoId: true,
    },
    orderBy: {
      profinhlLogoId: "asc",
    },
  });

  console.table(teams);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });