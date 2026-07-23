import axios from "axios";
import * as cheerio from "cheerio";

async function main() {
  const { data } = await axios.get(
    "https://profinhl.cz/AllRosters.php"
  );

  const $ = cheerio.load(data);

  $("table").each((idx, table) => {
    const text = $(table)
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (
      text.startsWith(
        "GOALIE POS CON SK DU EN SZ AG RB"
      )
    ) {
      let teamName = "";

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
          teamName = txt
            .split("PLAYER")[0]
            .trim();

          break;
        }
      }

      console.log(
        `${idx} => ${teamName}`
      );
    }
  });
}

main().catch(console.error);