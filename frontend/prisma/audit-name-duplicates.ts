import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalize(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\bbenjamin\b/g, "ben")
    .replace(/\bjoshua\b/g, "josh")
    .replace(/\bmatthew\b/g, "matt")
    .replace(/\bwilliam\b/g, "will")
    .replace(/\bmichael\b/g, "mikey")
    .replace(/\bcameron\b/g, "cam")
    .replace(/\bzachary\b/g, "zach")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const players = await prisma.player.findMany({
    select: {
      id: true,
      name: true,
      nhlId: true,
      slug: true,
      teamId: true,
    },
  });

  const groups = new Map<string, typeof players>();

  for (const player of players) {
    const key = normalize(player.name);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)!.push(player);
  }

  let count = 0;

  for (const [, items] of groups) {
    if (items.length < 2) continue;

    const hasGood = items.some(p => p.nhlId);
    const hasBad = items.some(p => !p.nhlId);

    if (!hasGood || !hasBad) continue;

    count++;

    console.log("\n====================");
    console.log(items);
  }

  console.log({
    duplicateGroups: count,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });