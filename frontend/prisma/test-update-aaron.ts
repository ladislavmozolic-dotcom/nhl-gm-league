import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const player = await prisma.player.findFirst({
    where: {
      frozenPoolId: 4026,
    },
  });

  console.log("PLAYER:");
  console.log(player);

  if (!player) {
    console.log("PLAYER NOT FOUND");
    return;
  }

  console.log("BEFORE UPDATE");

  const updated = 
await prisma.player.update({
  where: {
    id: player.id,
  },
  data: {
    birthDate: "1990-05-18",
  },
});


  console.log("AFTER UPDATE");
  console.log(updated.birthDate);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });