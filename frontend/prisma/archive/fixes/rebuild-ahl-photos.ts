import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const parentMap: Record<string, string> = {
  "Abbotsford Canucks": "VAN",
  "Bakersfield Condors": "EDM",
  "Belleville Senators": "OTT",
  "Tucson Roadrunners": "UTA",
  "Utica Comets": "NJD",
  "Hamilton Hammers": "NSH",
  "Calgary Wranglers": "CGY",
  "Charlotte Checkers": "FLA",
  "Chicago Wolves": "CAR",
  "Cleveland Monsters": "CBJ",
  "Coachella Valley Firebirds": "SEA",
  "Colorado Eagles": "COL",
  "Grand Rapids Griffins": "DET",
  "Hartford Wolf Pack": "NYR",
  "Henderson Silver Knights": "VGK",
  "Hershey Bears": "WSH",
  "Iowa Wild": "MIN",
  "Laval Rocket": "MTL",
  "Lehigh Valley Phantoms": "PHI",
  "Manitoba Moose": "WPG",
  "Milwaukee Admirals": "NSH",
  "Ontario Reign": "LAK",
  "Providence Bruins": "BOS",
  "Rochester Americans": "BUF",
  "Rockford IceHogs": "CHI",
  "San Diego Gulls": "ANA",
  "San Jose Barracuda": "SJS",
  "Springfield Thunderbirds": "STL",
  "Syracuse Crunch": "TBL",
  "Texas Stars": "DAL",
  "Toronto Marlies": "TOR",
  "Wilkes-Barre Scranton Penguins": "PIT",
};

async function main() {
  const season = "20262027";

  const players = await prisma.player.findMany({
    where: {
      nhlId: {
        not: null,
      },
      photoUrl: {
        contains: "/latest/168x168/",
      },
    },
    include: {
      team: true,
    },
  });

  let updated = 0;

  for (const player of players) {
    if (!player.nhlId || !player.team) {
      continue;
    }

    const nhlCode = parentMap[player.team.name];

    if (!nhlCode) {
      console.log(
        `Missing parent club for: ${player.team.name}`
      );
      continue;
    }

    const photoUrl =
      `https://assets.nhle.com/mugs/nhl/${season}/${nhlCode}/${player.nhlId}.png`;

    await prisma.player.update({
      where: {
        id: player.id,
      },
      data: {
        photoUrl,
      },
    });

    updated++;
  }

  console.log({
    updated,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });