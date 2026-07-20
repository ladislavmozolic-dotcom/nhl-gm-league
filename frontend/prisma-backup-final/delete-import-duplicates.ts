import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ids = [
  13130,
  13131,
  13135,
  13143,
  13150,
  13153,
  13154,
  13156,
  13184,
  13214,
  13228,
  13258,
];

async function main() {
  const result = await prisma.player.deleteMany({
    where: {
      id: {
        in: ids,
      },
    },
  });

  console.log(result);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });