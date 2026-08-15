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
    const cells = $(row).find("td").toArray();

    const values = cells.map((cell) => ({
      text: $(cell).text().trim(),
      html: $(cell).html(),
    }));

    console.log(JSON.stringify(values, null, 2));
    console.log("================================");
  }
}

main().catch(console.error);