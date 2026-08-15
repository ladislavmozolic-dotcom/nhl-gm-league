import axios from "axios";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  let updated = 0;

  for (const player of players) {
    try {
      const url =
        `https://capwages.com/players/${player.slug}`;

      const { data } = await axios.get(url);

      const salaryMatch =
        data.match(
          /"baseSalary":\{"@type":"MonetaryAmount","currency":"USD","value":([0-9]+)\}/
        );

      const endMatch =
        data.match(
          /"endDate":"([0-9]{4})"/
        );

      if (!salaryMatch || !endMatch) {
        continue;
      }

      const capHit = Number(salaryMatch[1]);
      const contractExpiry = Number(endMatch[1]);

      const currentSeason = 2026;

      const contractYears =
        Math.max(
          contractExpiry - currentSeason,
          0
        );

      await prisma.player.update({
        where: {
          id: player.id,
        },
        data: {
          capHit,
          contractYears,
          contractExpiry,
        },
      });

      updated++;

      console.log(
        `[${updated}] ${player.name} | ${capHit} | ${contractExpiry}`
      );

      await new Promise(
        (resolve) =>
          setTimeout(resolve, 200)
      );
    } catch (err) {
      console.log(
        `FAILED: ${player.name}`
      );
    }
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