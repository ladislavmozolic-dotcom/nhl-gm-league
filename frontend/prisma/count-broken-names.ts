import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      birthDate: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  const broken = players.filter(
    p =>
      p.name.includes("?") ||
      p.name.includes(" ") ||
      p.name.includes("∩")
  );

  console.table(broken);
  console.log({ broken: broken.length });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });