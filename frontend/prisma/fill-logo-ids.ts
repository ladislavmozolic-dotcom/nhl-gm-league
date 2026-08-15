import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const mappings: [string, number][] = [
  ["ANAHEIM DUCKS", 1],
  ["BOSTON BRUINS", 2],
  ["BUFFALO SABRES", 3],
  ["CALGARY FLAMES", 4],
  ["CAROLINA HURRICANES", 5],
  ["CHICAGO BLACKHAWKS", 6],
  ["COLORADO AVALANCHE", 7],
  ["COLUMBUS BLUE JACKETS", 8],
  ["DALLAS STARS", 9],
  ["DETROIT RED WINGS", 10],
  ["EDMONTON OILERS", 11],
  ["FLORIDA PANTHERS", 12],
  ["LOS ANGELES KINGS", 13],
  ["MINNESOTA WILD", 14],
  ["MONTREAL CANADIENS", 15],
  ["NASHVILLE PREDATORS", 16],
  ["NEW JERSEY DEVILS", 17],
  ["NEW YORK ISLANDERS", 18],
  ["NEW YORK RANGERS", 19],
  ["OTTAWA SENATORS", 20],
  ["PHILADELPHIA FLYERS", 21],
  ["PITTSBURGH PENGUINS", 22],
  ["SAN JOSE SHARKS", 23],
  ["SEATTLE KRAKEN", 24],
  ["ST. LOUIS BLUES", 25],
  ["TAMPA BAY LIGHTNING", 26],
  ["TORONTO MAPLE LEAFS", 27],
  ["UTAH MAMMOTH", 28],
  ["VANCOUVER CANUCKS", 29],
  ["VEGAS GOLDEN KNIGHTS", 30],
  ["WASHINGTON CAPITALS", 31],
  ["WINNIPEG JETS", 32],
];

async function main() {
  let updated = 0;

  for (const [name, logoId] of mappings) {
    const result = await prisma.team.updateMany({
      where: {
        profinhlName: name,
      },
      data: {
        profinhlLogoId: logoId,
      },
    });

    updated += result.count;
  }

  console.log(`✅ Teams updated: ${updated}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });