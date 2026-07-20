import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function toTitleCase(name: string) {
  return name
    .toLowerCase()
    .split(" ")
    .map((part) =>
      part.charAt(0).toUpperCase() +
      part.slice(1)
    )
    .join(" ");
}

async function main() {
  const players = await prisma.player.findMany();

  let updated = 0;

  for (const player of players) {
    if (player.name !== player.name.toUpperCase()) {
      continue;
    }

    const formatted = toTitleCase(player.name);

    await prisma.player.update({
      where: {
        id: player.id,
      },
      data: {
        name: formatted,
      },
    });

    updated++;
  }

  console.log("UPDATED:", updated);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });