const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.player.count();
  console.log("Celkom hráčov:", count);

  const withPhoto = await prisma.player.count({ where: { photoUrl: { not: null } } });
  console.log("S foto:", withPhoto);

  const withNhlId = await prisma.player.count({ where: { nhlId: { not: null } } });
  console.log("S nhlId:", withNhlId);

  const withFrozenPool = await prisma.player.count({ where: { frozenPoolId: { not: null } } });
  console.log("S frozenPoolId:", withFrozenPool);

  const withProfinhl = await prisma.player.count({ where: { profinhlId: { not: null } } });
  console.log("S profinhlId:", withProfinhl);

  console.log("\n--- Ukážka 3 hráčov ---");
  const players = await prisma.player.findMany({ take: 3 });
  for (const p of players) {
    console.log({
      id: p.id,
      name: p.name,
      slug: p.slug,
      nhlId: p.nhlId,
      frozenPoolId: p.frozenPoolId,
      frozenPoolUrl: p.frozenPoolUrl,
      photoUrl: p.photoUrl,
      teamId: p.teamId,
    });
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });