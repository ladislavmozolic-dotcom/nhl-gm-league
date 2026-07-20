import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      isGoalie: false,
    },
  });

  let created = 0;

  for (const player of players) {
    const existing =
      await prisma.skaterRating.findUnique({
        where: {
          playerId: player.id,
        },
      });

    if (existing) {
      continue;
    }

    await prisma.skaterRating.create({
      data: {
        playerId: player.id,

        condition: player.condition,

        ck: player.ck,
        fg: player.fg,
        di: player.di,
        sk: player.sk,
        st: player.st,
        en: player.en,
        du: player.du,
        ph: player.ph,
        fo: player.fo,
        pa: player.pa,
        sc: player.sc,
        df: player.df,
        ps: player.ps,
        ex: player.ex,
        ld: player.ld,
        mo: player.mo,

        overall: player.overall,
      },
    });

    created++;
  }

  console.log(`✅ Skater ratings created: ${created}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });