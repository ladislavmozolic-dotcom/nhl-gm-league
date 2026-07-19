import axios from "axios";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      birthDate: null,
      frozenPoolId: {
        not: null,
      },
    },
    select: {
      name: true,
      slug: true,
      frozenPoolId: true,
    },
    take: 100,
  });

  for (const player of players) {
    try {
      const url =
        `https://frozenpool.dobbersports.com/players/${player.slug}`;

      const { data } = await axios.get(url);

      const hasBirthDate =
        data.includes("Birth Date");

      console.log(
        `${player.name} -> ${hasBirthDate ? "FOUND" : "NO PROFILE"}`
      );
    } catch {
      console.log(
        `${player.name} -> ERROR`
      );
    }
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });