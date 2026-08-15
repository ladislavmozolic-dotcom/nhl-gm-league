import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  $("table").each((i, table) => {
    const text = $(table)
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (text.includes("PLAYER")) {
      console.log(
        `TABLE ${i}: ${text.slice(0, 150)}`
      );
    }
  });
}

main().catch(console.error);