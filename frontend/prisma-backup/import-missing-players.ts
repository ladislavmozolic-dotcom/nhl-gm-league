import fs from "fs";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const teams = await prisma.team.findMany();

  const teamByCode = new Map(
    teams
      .filter((t) => t.code)
      .map((t) => [t.code!, t])
  );

  const teamByName = new Map(
    teams.map((t) => [t.name, t])
  );

  const existingPlayers =
    await prisma.player.findMany({
      select: {
        slug: true,
      },
    });

  const existingSlugs = new Set(
    existingPlayers.map((p) => p.slug)
  );

  let created = 0;

  // NHL

  const nhlLines = fs
    .readFileSync("./data/PlayersNHL.csv", "utf8")
    .split(/\r?\n/)
    .filter(Boolean);

  const nhlCodeMap: Record<string, string> = {
    VEG: "VGK",
  };

  for (const line of nhlLines) {
    const cols = line.split(";");

    if (cols.length < 5) continue;

    const name = cols[1]?.trim();
    const teamCodeRaw = cols[3]?.trim();
    const position = cols[4]?.trim();

    if (!name || !teamCodeRaw) continue;

    if (teamCodeRaw === "2TM") continue;

    const teamCode =
      nhlCodeMap[teamCodeRaw] ?? teamCodeRaw;

    const team = teamByCode.get(teamCode);

    if (!team) continue;

    const slug = slugify(name);

    if (existingSlugs.has(slug)) continue;

    await prisma.player.create({
      data: {
        slug,
        name,
        position: position || "F",
        teamId: team.id,
      },
    });

    existingSlugs.add(slug);
    created++;
  }

  // AHL

  const ahlCsv = fs.readFileSync(
    "./data/PlayersAHL.csv",
    "utf8"
  );

  const ahlRows = parse(ahlCsv, {
    columns: true,
    delimiter: ";",
    skip_empty_lines: true,
  });

  for (const row of ahlRows as any[]) {
    const name = row.Name?.trim();
    const position = row.Pos?.trim();
    const teamName = row.Team?.trim();

    if (!name || !teamName) continue;

    const team = teamByName.get(teamName);

    if (!team) continue;

    const slug = slugify(name);

    if (existingSlugs.has(slug)) continue;

    await prisma.player.create({
      data: {
        slug,
        name,
        position: position || "F",
        teamId: team.id,
      },
    });

    existingSlugs.add(slug);
    created++;
  }

  console.log({
    created,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });