import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const table = $("table").eq(15);

  const rows = table.find("tr");

  rows.each((i, row) => {
    const cells = $(row)
      .find("td")
      .map((_, td) =>
        $(td)
          .text()
          .replace(/\s+/g, " ")
          .trim()
      )
      .get();

    if (
      cells.join(" ").includes("Sidney Crosby")
    ) {
      console.log(JSON.stringify(cells, null, 2));
    }
  });
}

main().catch(console.error);