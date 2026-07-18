import axios from "axios";

async function main() {
  const url =
    "https://www.eliteprospects.com/team/742/providence-bruins";

  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0",
    },
  });

  console.log(
    response.data.substring(0, 2000)
  );
}

main().catch(console.error);