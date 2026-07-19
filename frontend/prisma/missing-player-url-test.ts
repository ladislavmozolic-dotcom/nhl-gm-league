import axios from "axios";

async function test(slug: string) {
  try {
    const url =
      `https://frozenpool.dobbersports.com/players/${slug}`;

    const response = await axios.get(url);

    console.log(
      slug,
      response.status,
      response.data.includes("Birth Date")
    );
  } catch (err: any) {
    console.log(
      slug,
      err.response?.status ?? "ERROR"
    );
  }
}

async function main() {
  await test("sam-poulin");
  await test("phil-tomasino");
  await test("gerry-mayhew");
  await test("t-j-tynan");
  await test("j-r-avon");
}

main();