import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      name: {
        in: [
          "Connor McDavid",
          "Leon Draisaitl",
          "Sidney Crosby",
          "Nathan MacKinnon"
        ]
      }
    },
    select: {
      name: true,
      team: {
        select: {
          name: true,
          code: true
        }
      }
    }
  });

  console.table(players);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });