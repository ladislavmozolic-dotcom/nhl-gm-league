import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const teams = await prisma.team.findMany({
    where: {
      league: "AHL",
    },
    orderBy: {
      name: "asc",
    },
  });

  console.table(
    teams.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
    }))
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });