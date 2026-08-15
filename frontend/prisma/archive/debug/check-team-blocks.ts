import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  $("table").each((idx, table) => {
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

      console.log(
        `TEAM TABLE ${idx}: ${teamName}`
      );
    }
  });
}

main().catch(console.error);