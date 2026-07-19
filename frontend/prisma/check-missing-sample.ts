import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const names = [
  "Adam Henrique",
  "Cam Talbot",
  "Connor Ingram",
  "Carson Soucy",
  "Jonathan Toews",
  "John Klingberg",
  "Jeff Skinner",
  "David Perron",
];

async function main() {
  for (const name of names) {
    const player = await prisma.player.findFirst({
      where: {
        name: {
          contains: name.split(" ")[1],
          mode: "insensitive",
        },
      },
    });

    console.log(name, "=>", player?.name ?? "NOT FOUND");
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });