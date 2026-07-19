import axios from "axios";

async function main() {
  const { data } = await axios.get(
    "https://frozenpool.dobbersports.com/frozenpool_ahl_stats.php"
  );

  const matches = [
    ...data.matchAll(
      /frozenpool_ahl_player\.php\?id=(\d+)[\s\S]{0,300}?(?:title="([^"]+)"|>([^<]+)<)/gi
    ),
  ];

  console.log("Matches:", matches.length);

  console.log(
    matches.slice(0, 20).map((m) => ({
      id: m[1],
      name: m[2] || m[3],
    }))
  );
}

main().catch(console.error);