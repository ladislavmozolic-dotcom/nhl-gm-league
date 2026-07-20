import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  for (let i = 0; i < 8; i++) {
    const table = $("table").eq(i);

    const text = table
      .text()
      .replace(/\s+/g, " ")
      .trim();

    console.log("");
    console.log("=================================");
    console.log(`TABLE ${i}`);
    console.log("=================================");
    console.log(text.slice(0, 500));
  }
}

main().catch(console.error);
