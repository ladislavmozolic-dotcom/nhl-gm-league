import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.goalieRating.deleteMany();

  await prisma.player.deleteMany({
    where: {
      isGoalie: true,
    },
  });

  console.log("✅ Goalies reset");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });