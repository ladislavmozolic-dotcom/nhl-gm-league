import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const table = $("table").eq(5);

  const rows = table.find("tr").toArray();

  for (const row of rows) {
    const cells = $(row)
      .find("td")
      .map((_, td) =>
        $(td)
          .text()
          .replace(/\s+/g, " ")
          .trim()
      )
      .get();

    if (cells.length > 10) {
      console.log(cells);
      console.log("Columns:", cells.length);
      break;
    }
  }
}

main().catch(console.error);