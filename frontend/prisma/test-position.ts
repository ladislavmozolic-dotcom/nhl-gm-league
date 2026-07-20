import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/PlayerReport.php?Player=160"
  );

  const text = cheerio.load(data)("body").text();

  const match = text.match(
    /Position:\s*([A-Z\/]+)/i
  );

  console.log(match);
}

main().catch(console.error);