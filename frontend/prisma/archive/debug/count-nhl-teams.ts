import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const teams: string[] = [];

  $("table").each((_, table) => {
    const text = $(table)
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (
      text.includes("PLAYER POS CON CK FG DI") &&
      !text.startsWith("PLAYER POS")
    ) {
      const teamName = text
        .split("PLAYER")[0]
        .trim();

      if (
        teamName &&
        teamName.length > 3 &&
        !teams.includes(teamName)
      ) {
        teams.push(teamName);
      }
    }
  });

  console.log("Teams found:", teams.length);
  console.log("");
  console.log(teams);
}

main().catch(console.error);