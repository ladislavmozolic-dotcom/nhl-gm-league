import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany();

  const caps = players.filter(
    (p) => p.name === p.name.toUpperCase()
  );

  console.log("CAPS PLAYERS:", caps.length);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });