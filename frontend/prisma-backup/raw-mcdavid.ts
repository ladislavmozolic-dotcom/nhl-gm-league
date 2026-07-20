import { PrismaClient } from () {
  const player = await prisma.player.findFirst({
    where: { nhlId: 8478402 },
  });

  console.dir(player, {
    depth: null,
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });