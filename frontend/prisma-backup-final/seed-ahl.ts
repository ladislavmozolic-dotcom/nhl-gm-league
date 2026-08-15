import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ahlTeams = [
  {
    name: "Abbotsford Canucks",
    slug: "abbotsford-canucks",
    nhlParent: "vancouver-canucks",
  },
  {
    name: "Bakersfield Condors",
    slug: "bakersfield-condors",
    nhlParent: "edmonton-oilers",
  },
  {
    name: "Belleville Senators",
    slug: "belleville-senators",
    nhlParent: "ottawa-senators",
  },
  {
    name: "Calgary Wranglers",
    slug: "calgary-wranglers",
    nhlParent: "calgary-flames",
  },
  {
    name: "Charlotte Checkers",
    slug: "charlotte-checkers",
    nhlParent: "florida-panthers",
  },
  {
    name: "Chicago Wolves",
    slug: "chicago-wolves",
    nhlParent: "carolina-hurricanes",
  },
  {
    name: "Cleveland Monsters",
    slug: "cleveland-monsters",
    nhlParent: "columbus-blue-jackets",
  },
  {
    name: "Coachella Valley Firebirds",
    slug: "coachella-valley-firebirds",
    nhlParent: "seattle-kraken",
  },
  {
    name: "Colorado Eagles",
    slug: "colorado-eagles",
    nhlParent: "colorado-avalanche",
  },
  {
    name: "Grand Rapids Griffins",
    slug: "grand-rapids-griffins",
    nhlParent: "detroit-red-wings",
  },
  {
    name: "Hartford Wolf Pack",
    slug: "hartford-wolf-pack",
    nhlParent: "new-york-rangers",
  },
  {
    name: "Henderson Silver Knights",
    slug: "henderson-silver-knights",
    nhlParent: "vegas-golden-knights",
  },
  {
    name: "Hershey Bears",
    slug: "hershey-bears",
    nhlParent: "washington-capitals",
  },
  {
    name: "Iowa Wild",
    slug: "iowa-wild",
    nhlParent: "minnesota-wild",
  },
  {
    name: "Laval Rocket",
    slug: "laval-rocket",
    nhlParent: "montreal-canadiens",
  },
  {
    name: "Lehigh Valley Phantoms",
    slug: "lehigh-valley-phantoms",
    nhlParent: "philadelphia-flyers",
  },
  {
    name: "Manitoba Moose",
    slug: "manitoba-moose",
    nhlParent: "winnipeg-jets",
  },
  {
    name: "Milwaukee Admirals",
    slug: "milwaukee-admirals",
    nhlParent: "nashville-predators",
  },
  {
    name: "Ontario Reign",
    slug: "ontario-reign",
    nhlParent: "los-angeles-kings",
  },
  {
    name: "Providence Bruins",
    slug: "providence-bruins",
    nhlParent: "boston-bruins",
  },
  {
    name: "Rochester Americans",
    slug: "rochester-americans",
    nhlParent: "buffalo-sabres",
  },
  {
    name: "Rockford IceHogs",
    slug: "rockford-icehogs",
    nhlParent: "chicago-blackhawks",
  },
  {
    name: "San Diego Gulls",
    slug: "san-diego-gulls",
    nhlParent: "anaheim-ducks",
  },
  {
    name: "San Jose Barracuda",
    slug: "san-jose-barracuda",
    nhlParent: "san-jose-sharks",
  },
  {
    name: "Springfield Thunderbirds",
    slug: "springfield-thunderbirds",
    nhlParent: "st-louis-blues",
  },
  {
    name: "Syracuse Crunch",
    slug: "syracuse-crunch",
    nhlParent: "tampa-bay-lightning",
  },
  {
    name: "Texas Stars",
    slug: "texas-stars",
    nhlParent: "dallas-stars",
  },
  {
    name: "Toronto Marlies",
    slug: "toronto-marlies",
    nhlParent: "toronto-maple-leafs",
  },
  {
    name: "Tucson Roadrunners",
    slug: "tucson-roadrunners",
    nhlParent: "utah-mammoth",
  },
  {
    name: "Utica Comets",
    slug: "utica-comets",
    nhlParent: "new-jersey-devils",
  },
  {
    name: "Wilkes-Barre Scranton Penguins",
    slug: "wilkes-barre-scranton-penguins",
    nhlParent: "pittsburgh-penguins",
  },
];

async function main() {
  for (const ahl of ahlTeams) {
    const parent = await prisma.team.findUnique({
      where: {
        slug: ahl.nhlParent,
      },
    });

    if (!parent) {
      console.log(`Missing NHL parent: ${ahl.nhlParent}`);
      continue;
    }

    await prisma.team.upsert({
      where: {
        slug: ahl.slug,
      },
      update: {
        league: "AHL",
        parentTeamId: parent.id,
      },
      create: {
        slug: ahl.slug,
        name: ahl.name,
        gm: "Unassigned",
        arena: "TBD",
        league: "AHL",
        parentTeamId: parent.id,
      },
    });
  }

  console.log("AHL teams imported");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });