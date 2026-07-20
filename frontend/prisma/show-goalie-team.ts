import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const teamTable = $("table").eq(183);

  const teamName = teamTable
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .split("PLAYER")[0]
    .trim();

  console.log("TEAM:", teamName);

  const goalieTable = $("table").eq(185);

  const rows = goalieTable.find("tr").toArray();

  for (const row of rows) {
    const cells = $(row)
      .find("td")
      .map((_, td) =>
        $(td).text().replace(/\s+/g, " ").trim()
      )
      .get();

    if (cells.length === 20) {
      console.log(cells[0]);
    }
  }
}

main().catch(console.error);