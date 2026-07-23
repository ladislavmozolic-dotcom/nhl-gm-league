import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  const goalieTables = [
    3,10,17,24,31,38,45,52,
    59,66,73,80,87,94,101,108,
    115,122,129,136,143,150,157,164,
    171,178,185,192,199,206,213,220
  ];

  for (const idx of goalieTables) {
    const goalieTable = $("table").eq(idx);

    let teamName = "NOT FOUND";

    for (let i = idx - 1; i >= 0; i--) {
      const txt = $("table")
        .eq(i)
        .text()
        .replace(/\s+/g, " ")
        .trim();

      if (
        txt.includes("PLAYER POS CON CK FG DI") &&
        !txt.startsWith("PLAYER POS")
      ) {
        teamName = txt.split("PLAYER")[0].trim();
        break;
      }
    }

    console.log(
      `${idx} => ${teamName}`
    );
  }
}

main().catch(console.error);