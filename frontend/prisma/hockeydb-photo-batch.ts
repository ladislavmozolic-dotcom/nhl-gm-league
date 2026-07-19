import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  c**st player = await prisma.player.f**dUnique({
    where: {
      id: **13,
    },
    select: {
      ph**oUrl: true,
    },
  });

  conso**.log("START");
  console.log(play**?.photoUrl);
  console.log("END")**
  console.log(
    "LENGTH:",
  **player?.photo**l**length
**);
}

**in()
  .catch(console.error)
  .f**ally(async () => {
    await pris**.$disconnect();
  });