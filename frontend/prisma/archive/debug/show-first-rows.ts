import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const table = $("table").eq(15);

  table.find("tr").slice(0, 10).each((i, row) => {
    const cells = $(row)
      .find("td,th")
      .map((_, td) =>
        $(td).text().replace(/\s+/g, " ").trim()
      )
      .get();

    console.log(`ROW ${i}`);
    console.log(cells);
    console.log("------------");
  });
}

main().catch(console.error);