import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.team.findUnique({
    where: {
      slug: "free-agents",
    },
  });

  if (existing) {
    console.log("UFA team already exists");
    return;
  }

  const team = await prisma.team.create({
    data: {
      slug: "free-agents",
      code: "UFA",
      name: "Free Agents",
      gm: "System",
      arena: "Free Agent Pool",
      league: "NHL",
    },
  });

  console.log(team);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });