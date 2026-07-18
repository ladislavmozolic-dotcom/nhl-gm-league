import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    take: 20,
    orderBy: {
      name: "asc",
    },
  });

  console.table(
    players.map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
    }))
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });