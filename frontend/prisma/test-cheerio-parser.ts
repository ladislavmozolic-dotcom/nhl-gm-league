import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://frozenpool.dobbersports.com/players/adam-beckman"
  );

  const $ = cheerio.load(data);

  const shoots =
    $("#profile_shoots").text().trim();

  const height =
    $("#profile_height").text().trim();

  const weight =
    $("#profile_weight").text().trim();

  const html = $.html();

  const birthDate =
    html.match(
      /Birth Date<\/td>\s*<td>(\d{4}-\d{2}-\d{2})/i
    )?.[1] ?? null;

  const country =
    html.match(
      /Country<\/td>\s*<td>([A-Z]{3})/i
    )?.[1] ?? null;

  console.log({
    birthDate,
    shoots,
    height,
    weight,
    country,
  });
}

main().catch(console.error);