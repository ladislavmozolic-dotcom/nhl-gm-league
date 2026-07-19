import axios from "axios";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      birthDate: null,
    },
    take: 50,
  });

  for (const player of players) {
    try {
      const url =
        `https://frozenpool.dobbersports.com/players/${player.slug}`;

      const { data } = await axios.get(url);

      const hasProfile =
        data.includes("Birth Date") ||
        data.includes("Shoots") ||
        data.includes("Country");

      console.log(
        `${player.name} -> ${hasProfile ? "PROFILE" : "NO PROFILE"}`
      );
    } catch {
      console.log(`${player.name} -> ERROR`);
    }
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });