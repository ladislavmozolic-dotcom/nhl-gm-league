import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const url =
    "https://frozenpool.dobbersports.com/players/sam-poulin";

  const { data } = await axios.get(url);

  const $ = cheerio.load(data);

  const text = $("body").text();

  const idx = text.indexOf("Birth");

  console.log(text.substring(idx - 200, idx + 1000));
}

main().catch(console.error);