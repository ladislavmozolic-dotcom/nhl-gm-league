import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const affiliates: Record<string, string> = {
  "ANAHEIM DUCKS": "SAN DIEGO GULLS",
  "BOSTON BRUINS": "PROVIDENCE BRUINS",
  "BUFFALO SABRES": "ROCHESTER AMERICANS",
  "CALGARY FLAMES": "CALGARY WRANGLERS",
  "CAROLINA HURRICANES": "CHICAGO WOLVES",
  "CHICAGO BLACKHAWKS": "ROCKFORD ICEHOGS",
  "COLORADO AVALANCHE": "COLORADO EAGLES",
  "COLUMBUS BLUE JACKETS": "CLEVELAND MONSTERS",
  "DALLAS STARS": "TEXAS STARS",
  "DETROIT RED WINGS": "GRAND RAPIDS GRIFFINS",
  "EDMONTON OILERS": "BAKERSFIELD CONDORS",
  "FLORIDA PANTHERS": "CHARLOTTE CHECKERS",
  "LOS ANGELES KINGS": "ONTARIO REIGN",
  "MINNESOTA WILD": "IOWA WILD",
  "MONTREAL CANADIENS": "LAVAL ROCKET",
  "NASHVILLE PREDATORS": "MILWAUKEE ADMIRALS",
  "NEW JERSEY DEVILS": "UTICA COMETS",
  "NEW YORK ISLANDERS": "BRIDGEPORT ISLANDERS",
  "NEW YORK RANGERS": "HARTFORD WOLF PACK",
  "OTTAWA SENATORS": "BELLEVILLE SENATORS",
  "PHILADELPHIA FLYERS": "LEHIGH VALLEY PHANTOMS",
  "PITTSBURGH PENGUINS": "WILKES-BARRE SCRANTON PENGUINS",
  "SAN JOSE SHARKS": "SAN JOSE BARRACUDA",
  "SEATTLE KRAKEN": "COACHELLA VALLEY FIREBIRDS",
  "ST. LOUIS BLUES": "SPRINGFIELD THUNDERBIRDS",
  "TAMPA BAY LIGHTNING": "SYRACUSE CRUNCH",
  "TORONTO MAPLE LEAFS": "TORONTO MARLIES",
  "UTAH MAMMOTH": "TUCSON ROADRUNNERS",
  "VANCOUVER CANUCKS": "ABBOTSFORD CANUCKS",
  "VEGAS GOLDEN KNIGHTS": "HENDERSON SILVER KNIGHTS",
  "WASHINGTON CAPITALS": "HERSHEY BEARS",
  "WINNIPEG JETS": "MANITOBA MOOSE",
};

async function main() {
  const nhlTeams = await prisma.team.findMany({
    where: {
      league: "NHL",
    },
  });

  for (const team of nhlTeams) {
    const affiliateName = affiliates[team.name];

    if (!affiliateName) continue;

    const affiliateSlug = affiliateName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const existingAffiliate = await prisma.team.findFirst({
      where: {
        name: affiliateName,
      },
    });

    if (existingAffiliate) {
      console.log(`EXISTS: ${affiliateName}`);
      continue;
    }

    await prisma.team.create({
      data: {
        name: affiliateName,
        slug: affiliateSlug,
        gm: "Unknown",
        arena: "Unknown",
        league: "AHL",
        parentTeamId: team.id,
      },
    });

    console.log(`CREATED: ${affiliateName}`);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });