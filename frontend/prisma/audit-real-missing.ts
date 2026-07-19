import fs from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function main() {
  const players = await prisma.player.findMany({
    select: {
      name: true,
    },
  });

  const dbNames = new Set(
    players.map((p) => normalize(p.name))
  );

  const missing = JSON.parse(
    fs.readFileSync("missing-final.json", "utf8")
  );

  const realMissing: string[] = [];
  const falseMissing: string[] = [];

  for (const name of missing) {
    const key = normalize(name);

    if (dbNames.has(key)) {
      falseMissing.push(name);
    } else {
      realMissing.push(name);
    }
  }

  fs.writeFileSync(
    "real-missing.json",
    JSON.stringify(realMissing, null, 2)
  );

  fs.writeFileSync(
    "false-missing.json",
    JSON.stringify(falseMissing, null, 2)
  );

  console.log({
    realMissing: realMissing.length,
    falseMissing: falseMissing.length,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
