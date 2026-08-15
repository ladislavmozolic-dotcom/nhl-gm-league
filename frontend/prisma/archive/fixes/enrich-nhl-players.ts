import axios from "axios";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      nhlId: {
        not: null,
      },
    },
  });

  let updated = 0;

  for (const player of players) {
    try {
      const url =
        `https://api-web.nhle.com/v1/player/${player.nhlId}/landing`;

      const { data } = await axios.get(url);

      const birthPlace = [
        data.birthCity?.default,
        data.birthStateProvince?.default,
        data.birthCountry
      ]
        .filter(Boolean)
        .join(", ");

      const height =
        data.heightInInches
          ? `${Math.floor(data.heightInInches / 12)}'${data.heightInInches % 12}"`
          : null;

      await prisma.player.update({
        where: { id: player.id },
        data: {
          birthDate: data.birthDate ?? null,
          birthPlace: birthPlace || null,

          nationality: data.birthCountry ?? null,

          shoots: data.shootsCatches ?? null,
          height,
          weight: data.weightInPounds ?? null,

          photoUrl:
            `https://assets.nhle.com/mugs/nhl/latest/168x168/${player.nhlId}.png`,
        },
      });

      updated++;

      console.log(
        `[${updated}/${players.length}] ${player.name}`
      );
    } catch (err) {
      console.log(
        `FAILED: ${player.name} (${player.nhlId})`
      );
    }
  }

  console.log(`DONE: ${updated} players updated`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });