import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const url =
    "https://frozenpool.dobbersports.com/frozenpool_ahl_player.php?id=5540";

  const { data } = await axios.get(url);

  const $ = cheerio.load(data);

  console.log("SHOOTS:", $("#profile_shoots").text());
  console.log("HEIGHT:", $("#profile_height").text());
  console.log("WEIGHT:", $("#profile_weight").text());

  console.log(
    data.includes("Birth Date"),
    data.includes("Country")
  );
}

main().catch(console.error);