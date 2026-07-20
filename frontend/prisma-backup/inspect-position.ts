import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/PlayerReport.php?Player=19"
  );

  const $ = cheerio.load(data);

  const text = $("body").text();

  console.log(text);
}

main().catch(console.error);