import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const table = $("table").eq(15);

  let el = table.prev();

  for (let i = 0; i < 15; i++) {
    console.log(
      i,
      el.prop("tagName"),
      el.text().replace(/\s+/g, " ").trim().slice(0, 200)
    );

    el = el.prev();
  }
}

main().catch(console.error);
