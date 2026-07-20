import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/PlayerReport.php?Player=2190"
  );

  const $ = cheerio.load(data);

  $("img").each((_, el) => {
    const src = $(el).attr("src");

    if (src) {
      console.log(src);
    }
  });
}

main().catch(console.error);