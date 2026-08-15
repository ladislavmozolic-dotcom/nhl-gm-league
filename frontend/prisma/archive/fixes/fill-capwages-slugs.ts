import axios from "axios";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const { data } = await axios.get(
    "https://capwages.com/players/ufas"
  );

  const matches = [
    ...data.matchAll(/\["([^"]+)","([^"]+)"/g),
  ];

  let updated = 0;

  for (const match of matches) {
    const capwagesName = match[1];
    const capWagesSlug = match[2];

    const parts = capwagesName.split(",");

    if (parts.length !== 2) continue;

    const dbName =
      `${parts[1].trim()} ${parts[0].trim()}`;

    const player = await prisma.player.findFirst({
      where: {
        name: {
          equals: dbName,
          mode: "insensitive",
        },
      },
    });

    if (!player) continue;

    await prisma.player.update({
      where: {
        id: player.id,
      },
      data: {
        capWagesSlug,
      },
    });

    updated++;

    console.log(
      `${dbName} -> ${capWagesSlug}`
    );
  }

  console.log({
    updated,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });