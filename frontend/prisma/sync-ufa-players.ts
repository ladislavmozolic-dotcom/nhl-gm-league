import axios from "axios";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ufaTeam = await prisma.team.findUnique({
    where: {
      code: "UFA",
    },
  });

  if (!ufaTeam) {
    throw new Error("UFA team not found");
  }

  const { data } = await axios.get(
    "https://capwages.com/players/ufas"
  );

  const matches = [
    ...data.matchAll(/\["([^"]+)","([^"]+)"/g),
  ];

  let moved = 0;
  let notFound = 0;

  for (const match of matches) {
    const capWagesSlug = match[2];

    const player = await prisma.player.findFirst({
      where: {
        OR: [
          {
            capWagesSlug,
          },
          {
            slug: capWagesSlug,
          },
        ],
      },
    });

    if (!player) {
      notFound++;
      continue;
    }

    await prisma.player.update({
      where: {
        id: player.id,
      },
      data: {
        teamId: ufaTeam.id,
      },
    });

    moved++;

    console.log(
      `[${moved}] ${player.name}`
    );
  }

  console.log({
    moved,
    notFound,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });