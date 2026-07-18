import fs from "fs";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const teamMappings: Record<string, string> = {
  "Bridgeport Islanders": "Hamilton Hammers",
  "Wilkes-Barre/Scranton":
  "Wilkes-Barre Scranton Penguins",

"Wilkes-Barre/Scranton Penguins":
  "Wilkes-Barre Scranton Penguins",

  "Grand Rapids": "Grand Rapids Griffins",
  "Manitoba": "Manitoba Moose",
  "Milwaukee": "Milwaukee Admirals",

  "Providence": "Providence Bruins",
  "Rochester": "Rochester Americans",
  "Iowa": "Iowa Wild",

  "San Jose": "San Jose Barracuda",
  "Texas": "Texas Stars",
  "Toronto": "Toronto Marlies",

  "Coachella Valley": "Coachella Valley Firebirds",
  "Springfield": "Springfield Thunderbirds",
  "Colorado": "Colorado Eagles",
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type AhlCsvRow = {
  Team: string;
  Name: string;
  Pos: string;
};

const missingTeams = new Set<string>();

async function main() {
  console.log("START");

  const csv = fs.readFileSync(
    "./data/AHL Regular Season Stats - Frozen Tools.csv",
    "utf8"
  );

  console.log("CSV LOADED");

  const rows = parse<AhlCsvRow>(csv, {
    columns: true,
    skip_empty_lines: true,
  });

  let imported = 0;

  for (const row of rows) {
    if (!row.Team) {
  console.log("NO TEAM:", row.Name);
  continue;
}
    const teamName =
      teamMappings[row.Team] ?? row.Team;

    const team = await prisma.team.findFirst({
      where: {
        name: teamName,
      },
    });

    if (!team) {
      missingTeams.add(row.Team);
      continue;
    }

    const slug = slugify(row.Name);

    await prisma.player.upsert({
      where: {
        slug,
      },
      update: {
        name: row.Name,
        position: row.Pos,
        teamId: team.id,
      },
      create: {
        slug,
        name: row.Name,
        position: row.Pos,
        teamId: team.id,
      },
    });

    imported++;
  }

  console.log(`Imported ${imported} players`);

  console.log("");
  console.log("MISSING TEAMS:");
  console.log([...missingTeams]);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });