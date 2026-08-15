import axios from "axios";

async function main() {
  const url =
    "https://theahl.com/stats/roster/440/90?league=4";

  const response = await axios.get(url);

  const html = response.data;

  const matches = html.match(
    /https?:\/\/[^"']+/g
  );

  if (matches) {
    matches.forEach((url: string) => {
      if (
        url.includes("hockeytech") ||
        url.includes("feed") ||
        url.includes("statview")
      ) {
        console.log(url);
      }
    });
  }
}

main().catch(console.error);