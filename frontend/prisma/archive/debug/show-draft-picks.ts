import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const table = $("table").eq(7);

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

    if (cells.length > 0) {
      console.log(cells);
    }
  }
}

main().catch(console.error);