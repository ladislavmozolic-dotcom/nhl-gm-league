import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const url =
    "https://frozenpool.dobbersports.com/players/max-jones";

  const { data } = await axios.get(url);

  const $ = cheerio.load(data);

  console.log(
    "SHOOTS:",
    $("#profile_shoots").text()
  );

  console.log(
    "HEIGHT:",
    $("#profile_height").text()
  );

  console.log(
    "WEIGHT:",
    $("#profile_weight").text()
  );

  console.log(
    data.includes("Height")
  );

  console.log(
    data.includes("Weight")
  );

  console.log(
    data.includes("Shoots")
  );
}

main().catch(console.error);