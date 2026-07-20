import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {

  const players = await prisma.player.findMany({
    select: {
      id: true,
      name: true,
      nhlId: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const map = new Map<string, typeof players>();

  for (const player of players) {

    const normalized = player.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

    if (!map.has(normalized)) {
      map.set(normalized, []);
    }

    map.get(normalized)!.push(player);
  }

  for (const [, records] of map) {

    if (records.length > 1) {

      const hasNhlId = records.some(
        p => p.nhlId
      );

      const hasMissing = records.some(
        p => !p.nhlId
      );

      if (hasNhlId && hasMissing) {
        console.log(records);
      }
    }
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });