import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const url =
    "https://theahl.com/stats/roster/440/90?league=4";

  const response = await axios.get(url);

  const $ = cheerio.load(response.data);

  console.log("TITLE:");
  console.log($("title").text());

  console.log("TABLES FOUND:");
  console.log($("table").length);

  $("table").each((i) => {
    console.log(
      `Table ${i}: rows = ${$("table")
        .eq(i)
        .find("tr").length}`
    );
  });
}

main().catch(console.error);
