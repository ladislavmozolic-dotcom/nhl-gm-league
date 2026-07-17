import axios from "axios";

async function main() {
  const url =
    "https://lscluster.hockeytech.com/feed/index.php";

  const response = await axios.get(url, {
    params: {
      feed: "statviewfeed",
      view: "bootstrap",
      client_code: "ahl",
      site_id: 3,
      league_id: 4,
      pageName: "roster",
      lang: "en",
    },
  });

  console.log(response.data);
}

main().catch(console.error);