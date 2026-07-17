import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const teams = [
  { code: "ANA", slug: "anaheim-ducks", name: "Anaheim Ducks", arena: "Honda Center" },
  { code: "BOS", slug: "boston-bruins", name: "Boston Bruins", arena: "TD Garden" },
  { code: "BUF", slug: "buffalo-sabres", name: "Buffalo Sabres", arena: "KeyBank Center" },
  { code: "CGY", slug: "calgary-flames", name: "Calgary Flames", arena: "Scotiabank Saddledome" },
  { code: "CAR", slug: "carolina-hurricanes", name: "Carolina Hurricanes", arena: "Lenovo Center" },
  { code: "CHI", slug: "chicago-blackhawks", name: "Chicago Blackhawks", arena: "United Center" },
  { code: "COL", slug: "colorado-avalanche", name: "Colorado Avalanche", arena: "Ball Arena" },
  { code: "CBJ", slug: "columbus-blue-jackets", name: "Columbus Blue Jackets", arena: "Nationwide Arena" },
  { code: "DAL", slug: "dallas-stars", name: "Dallas Stars", arena: "American Airlines Center" },
  { code: "DET", slug: "detroit-red-wings", name: "Detroit Red Wings", arena: "Little Caesars Arena" },
  { code: "EDM", slug: "edmonton-oilers", name: "Edmonton Oilers", arena: "Rogers Place" },
  { code: "FLA", slug: "florida-panthers", name: "Florida Panthers", arena: "Amerant Bank Arena" },
  { code: "LAK", slug: "los-angeles-kings", name: "Los Angeles Kings", arena: "Crypto.com Arena" },
  { code: "MIN", slug: "minnesota-wild", name: "Minnesota Wild", arena: "Xcel Energy Center" },
  { code: "MTL", slug: "montreal-canadiens", name: "Montreal Canadiens", arena: "Bell Centre" },
  { code: "NSH", slug: "nashville-predators", name: "Nashville Predators", arena: "Bridgestone Arena" },
  { code: "NJD", slug: "new-jersey-devils", name: "New Jersey Devils", arena: "Prudential Center" },
  { code: "NYI", slug: "new-york-islanders", name: "New York Islanders", arena: "UBS Arena" },
  { code: "NYR", slug: "new-york-rangers", name: "New York Rangers", arena: "Madison Square Garden" },
  { code: "OTT", slug: "ottawa-senators", name: "Ottawa Senators", arena: "Canadian Tire Centre" },
  { code: "PHI", slug: "philadelphia-flyers", name: "Philadelphia Flyers", arena: "Wells Fargo Center" },
  { code: "PIT", slug: "pittsburgh-penguins", name: "Pittsburgh Penguins", arena: "PPG Paints Arena" },
  { code: "SJS", slug: "san-jose-sharks", name: "San Jose Sharks", arena: "SAP Center" },
  { code: "SEA", slug: "seattle-kraken", name: "Seattle Kraken", arena: "Climate Pledge Arena" },
  { code: "STL", slug: "st-louis-blues", name: "St. Louis Blues", arena: "Enterprise Center" },
  { code: "TBL", slug: "tampa-bay-lightning", name: "Tampa Bay Lightning", arena: "Amalie Arena" },
  { code: "TOR", slug: "toronto-maple-leafs", name: "Toronto Maple Leafs", arena: "Scotiabank Arena" },
  { code: "UTA", slug: "utah-mammoth", name: "Utah Mammoth", arena: "Delta Center" },
  { code: "VAN", slug: "vancouver-canucks", name: "Vancouver Canucks", arena: "Rogers Arena" },
  { code: "VGK", slug: "vegas-golden-knights", name: "Vegas Golden Knights", arena: "T-Mobile Arena" },
  { code: "WSH", slug: "washington-capitals", name: "Washington Capitals", arena: "Capital One Arena" },
  { code: "WPG", slug: "winnipeg-jets", name: "Winnipeg Jets", arena: "Canada Life Centre" },
];

async function main() {
  for (const team of teams) {
    await prisma.team.upsert({
      where: {
        slug: team.slug,
      },
      update: {
        code: team.code,
        arena: team.arena,
      },
      create: {
        ...team,
        gm: "Unassigned",
      },
    });
  }

  console.log(`Imported ${teams.length} teams`);

  const edm = await prisma.team.findUnique({
    where: {
      code: "EDM",
    },
  });

  if (!edm) {
    throw new Error("EDM team not found");
  }

  await prisma.player.upsert({
    where: {
      slug: "connor-mcdavid",
    },
    update: {},
    create: {
      slug: "connor-mcdavid",
      name: "Connor McDavid",
      position: "C",
      teamId: edm.id,
    },
  });

  console.log("Player imported");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });