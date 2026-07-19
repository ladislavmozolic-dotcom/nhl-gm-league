import axios from "axios";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalize(name: string) {
  return name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/'/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const { data } = await axios.get(
    "https://frozenpool.dobbersports.com/frozenpool_ahl_stats.php"
  );

  const matches = [
    ...data.matchAll(
      /frozenpool_ahl_player\.php\?id=(\d+)[\s\S]{0,250}?(?:title="([^"]+)"|>([^<]+)<)/gi
    ),
  ];

  console.log(`Found ${matches.length} AHL profiles`);

  const ahlPlayers = matches.map((m) => ({
    frozenPoolId: Number(m[1]),
    name: (m[2] || m[3] || "").trim(),
    normalized: normalize(m[2] || m[3] || ""),
  }));

  const players = await prisma.player.findMany();

  let linked = 0;

  for (const player of players) {
    const match = ahlPlayers.find(
      (p) => p.normalized === normalize(player.name)
    );

    if (!match) continue;

    await prisma.player.update({
      where: {
        id: player.id,
      },
      data: {
        frozenPoolId: match.frozenPoolId,
        frozenPoolUrl:
          `https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=${match.frozenPoolId}`,
      },
    });

    linked++;

    console.log(
      `${player.name} -> ${match.frozenPoolId}`
    );
  }

  console.log(`LINKED: ${linked}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });