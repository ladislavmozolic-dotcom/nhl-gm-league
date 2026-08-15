
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const player = await prisma.player.findFirst();
  console.log(player);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });