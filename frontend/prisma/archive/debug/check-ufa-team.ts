import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ufaTeam = await prisma.team.findUnique({
    where: {
      code: "UFA",
    },
  });

  console.log(ufaTeam);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });