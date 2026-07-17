import axios from "axios";

async function main() {
  const response = await axios.get(
    "https://lscluster.hockeytech.com/statview-1.4.1/js/ht-services.r3.js"
  );

  const lines = response.data.split("\n");

  lines.forEach((line: string) => {
    if (
      line.includes("feed") ||
      line.includes("Feed") ||
      line.includes("api") ||
      line.includes("Api") ||
      line.includes("get") ||
      line.includes("Get")
    ) {
      console.log(line);
    }
  });
}

main().catch(console.error);