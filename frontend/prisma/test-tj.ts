import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://frozenpool.dobbersports.com/players/t.j.-tynan"
  );

  const $ = cheerio.load(data);

  const text = $("body").text();

  console.log(
    text.match(/Birth Date\s+([0-9\-]+)/)?.[1]
  );

  console.log(
    text.match(/Shoots\s+([LR])/)?.[1]
  );

  console.log(
    text.match(/Height\s+([0-9']+)/)?.[1]
  );

  console.log(
    text.match(/Weight\s+([0-9]+)/)?.[1]
  );

  console.log(
    text.match(/Country\s+([A-Z]{3})/)?.[1]
  );
}

main().catch(console.error);