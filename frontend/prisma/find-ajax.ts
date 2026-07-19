import axios from "axios";

async function main() {
  const { data } = await axios.get(
    "https://frozenpool.dobbersports.com/frozenpool_ahl_stats.php"
  );

  const matches =
    data.match(/[^"' ]+\.php[^"' ]*/g) ?? [];

  console.log(matches);
}

main().catch(console.error);