import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [
    noBirthDate,
    noNationality,
    noHeight,
    noWeight,
    noPhoto,
    noFrozenPool,
  ] = await Promise.all([
    prisma.player.count({
      where: { birthDate: null },
    }),
    prisma.player.count({
      where: { nationality: null },
    }),
    prisma.player.count({
      where: { height: null },
    }),
    prisma.player.count({
      where: { weight: null },
    }),
    prisma.player.count({
      where: { photoUrl: null },
    }),
    prisma.player.count({
      where: { frozenPoolId: null },
    }),
  ]);

  console.log({
    noBirthDate,
    noNationality,
    noHeight,
    noWeight,
    noPhoto,
    noFrozenPool,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });