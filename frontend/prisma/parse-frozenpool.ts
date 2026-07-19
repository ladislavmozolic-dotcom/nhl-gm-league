import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const url =
    "https://frozenpool.dobbersports.com/players/dans-locmelis";

  const { data } = await axios.get(url);

  const $ = cheerio.load(data);

  const text = $("body").text();

  const birthDateMatch =
    text.match(/Birth Date\s+([0-9\-]+)/);

  const shootsMatch =
    text.match(/Shoots\s+([LR])/);

  const heightMatch =
    text.match(/Height\s+([0-9']+)/);

  const weightMatch =
    text.match(/Weight\s+([0-9]+)/);

  const countryMatch =
    text.match(/Country\s+([A-Z]{3})/);

  console.log({
    birthDate: birthDateMatch?.[1],
    shoots: shootsMatch?.[1],
    height: heightMatch?.[1],
    weight: weightMatch?.[1],
    country: countryMatch?.[1],
  });
}

main().catch(console.error);