import fs from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function main() {
  const missing: string[] = JSON.parse(
    fs.readFileSync("missing-final.json", "utf8")
  );

  const players = await prisma.player.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  let possibleMatches = 0;

  for (const missingName of missing) {
    const missingKey = normalize(missingName);

    const match = players.find((p) => {
      const key = normalize(p.name);

      return (
        key.includes(missingKey) ||
        missingKey.includes(key)
      );
    });

    if (match) {
      possibleMatches++;

      console.log(
        `${missingName} => ${match.name}`
      );
    }
  }

  console.log({
    possibleMatches,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
