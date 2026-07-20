import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const table = $("table").eq(7);

  console.log(
    $(table)
      .html()
      ?.replace(/\n/g, "")
  );
}

main().catch(console.error);