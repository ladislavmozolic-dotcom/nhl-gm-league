import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const teams = [
  {
    code: "EDM",
    slug: "edmonton-oilers",
    name: "Edmonton Oilers",
    arena: "Rogers Place",
  },
  {
    code: "TOR",
    slug: "toronto-maple-leafs",
    name: "Toronto Maple Leafs",
    arena: "Scotiabank Arena",
  },
  {
    code: "BOS",
    slug: "boston-bruins",
    name: "Boston Bruins",
    arena: "TD Garden",
  },
];

async function main() {
  for (const team of teams) {
    await prisma.team.upsert({
      where: {
        slug: team.slug,
      },
      update: {
        code: team.code,
      },
      create: {
        slug: team.slug,
        code: team.code,
        name: team.name,
        gm: "Unassigned",
        arena: team.arena,
      },
    });
  }

  console.log("Teams imported");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });