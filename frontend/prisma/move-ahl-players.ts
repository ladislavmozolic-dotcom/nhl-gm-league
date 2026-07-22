import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ahlTeams = await prisma.team.findMany({
    where: {
      league: "AHL",
    },
  });

  let moved = 0;

  for (const ahlTeam of ahlTeams) {
    if (!ahlTeam.parentTeamId) continue;

    const result = await prisma.player.updateMany({
      where: {
        teamId: ahlTeam.parentTeamId,
        rosterType: "AHL",
      },
      data: {
        teamId: ahlTeam.id,
      },
    });

    console.log(
      `${ahlTeam.name}: ${result.count} players moved`
    );

    moved += result.count;
  }

  console.log("");
  console.log(`✅ Total moved: ${moved}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });