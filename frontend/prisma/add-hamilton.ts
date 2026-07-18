import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const team = await prisma.team.create({
    data: {
      name: "Hamilton Hammers",
      slug: "hamilton-hammers",
      gm: "TBD",
      arena: "Hamilton Arena",
      league: "AHL",
    },
  });

  console.log(team);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
