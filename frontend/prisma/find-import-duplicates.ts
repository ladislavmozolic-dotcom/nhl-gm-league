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

  const byName = new Map<string, typeof players>();

  for (const p of players) {
    const key = normalize(p.name);

    if (!byName.has(key)) {
      byName.set(key, []);
    }

    byName.get(key)!.push(p);
  }

  for (const [, group] of byName) {
    if (group.length > 1) {
      console.log("-----");

      for (const p of group) {
        console.log(
          p.id,
          p.name,
          p.nhlId
        );
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });