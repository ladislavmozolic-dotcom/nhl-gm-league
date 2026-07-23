import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();

  console.log("✅ Engine database cleared");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });