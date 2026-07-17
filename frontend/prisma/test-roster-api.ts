import axios from "axios";

async function main() {
  const url =
    "https://lscluster.hockeytech.com/feed/index.php";

  const response = await axios.get(url, {
    params: {
      feed: "statviewfeed",
      view: "roster",
      team_id: 440,
      season_id: 90,
      league_id: 4,
      site_id: 3,
      client_code: "ahl",
      lang: 1,
      callback: "JSON_CALLBACK",
      key: "DOPLNIME"
    }
  });

  console.log(response.data);
}

main().catch(console.error);