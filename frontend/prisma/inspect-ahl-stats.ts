import axios from "axios";

async function main() {
  const { data } = await axios.get(
    "https://frozenpool.dobbersports.com/frozenpool_ahl_stats.php"
  );

  const idx = data.indexOf("T.J. Tynan");

  console.log(
    data.substring(idx - 500, idx + 1000)
  );
}

main().catch(console.error);