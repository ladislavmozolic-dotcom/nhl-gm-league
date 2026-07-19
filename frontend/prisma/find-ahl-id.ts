import axios from "axios";

async function main() {
  const { data } = await axios.get(
    "https://frozenpool.dobbersports.com/frozenpool_ahl_stats.php"
  );

  const matches =
    data.match(/frozenpool_ahl_player\.php\?id=\d+/g) || [];

  console.log("Found:", matches.length);

  console.log(matches.slice(0, 50));
}

main().catch(console.error);