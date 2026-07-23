import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const table = $("table").eq(7);

  const row = table.find("tr").eq(2);

  row.find("td").each((i, td) => {
    const logos = $(td)
      .find("img")
      .map((_, img) => {
        const src = $(img).attr("src") || "";
        const match = src.match(/\/(\d+)\.png/);
        return match ? match[1] : null;
      })
      .get();

    console.log(i, logos);
  });
}

main().catch(console.error);
