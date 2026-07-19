import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalize(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function main() {
  const players = await prisma.player.findMany({
    select: {
      id: true,
      name: true,
      nhlId: true,
    },
  });

  for (const player of players) {
    if (player.id < 13000) continue;

    const matches = players.filter(
      p =>
        p.id !== player.id &&
        normalize(p.name) === normalize(player.name)
    );

    if (matches.length) {
      console.log("\n----");
      console.log(player);

      for (const m of matches) {
        console.log(m);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });