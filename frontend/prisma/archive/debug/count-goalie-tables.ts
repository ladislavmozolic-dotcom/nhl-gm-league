import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const goalieTables: number[] = [];

  $("table").each((i, table) => {
    const text = $(table)
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (
      text.startsWith(
        "GOALIE POS CON SK DU EN SZ AG RB"
      )
    ) {
      goalieTables.push(i);
    }
  });

  console.log("Goalie tables:");
  console.log(goalieTables);
  console.log("");
  console.log(
    `Total goalie tables: ${goalieTables.length}`
  );
}

main().catch(console.error);