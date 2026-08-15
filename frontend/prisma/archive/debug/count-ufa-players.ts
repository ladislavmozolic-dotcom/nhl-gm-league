import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.player.count({
    where: {
      team: {
        code: "UFA",
      },
    },
  });

  console.log("UFA players:", count);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });