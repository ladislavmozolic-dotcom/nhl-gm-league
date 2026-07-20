import axios from "axios";

async function main() {
  const { data } = await axios.get(
    "https://capwages.com/players/ufas"
  );

  const matches = [
    ...data.matchAll(
      /\/players\/([a-z0-9\-]+)/g
    ),
  ];

  const slugs = [
    ...new Set(
      matches.map((m) => m[1])
    ),
  ];

  console.log(
    "CapWages UFA count:",
    slugs.length
  );

  console.log(
    slugs.slice(0, 25)
  );
}

main().catch(console.error);
