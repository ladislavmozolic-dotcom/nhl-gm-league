import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/PlayerReport.php?Player=2190"
  );

  const $ = cheerio.load(data);

  $("a").each((_, el) => {
    const href = $(el).attr("href");

    if (href?.includes("nhl.com/player")) {
      console.log("NAME:", $(el).text());
      console.log("LINK:", href);
    }
  });

  const text = $("body").text();

  const match = text.match(
    /Position:\s*([A-Z\/]+)/
  );

  console.log("POSITION:", match?.[1]);
}

main().catch(console.error);