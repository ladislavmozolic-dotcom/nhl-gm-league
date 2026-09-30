import { prisma } from "@/lib/prisma";

/** The competitions the first Around the World import supports.  Seeding this
 * catalog is idempotent; source adapters can be added league by league without
 * changing the public data model. */
export const WORLD_LEAGUE_CATALOG = [
  { code: "WHL", name: "Western Hockey League", country: "Canada / USA", region: "North America", logoUrl: "/images/leagues/whl.svg" },
  { code: "OHL", name: "Ontario Hockey League", country: "Canada", region: "North America", logoUrl: "/images/leagues/ohl.svg" },
  { code: "QMJHL", name: "Quebec Maritimes Junior Hockey League", country: "Canada", region: "North America", logoUrl: "/images/leagues/qmjhl.svg" },
  { code: "AHL", name: "American Hockey League", country: "USA / Canada", region: "North America", logoUrl: "/images/leagues/ahl.svg" },
  { code: "NCAA", name: "NCAA Division I", country: "USA", region: "North America", logoUrl: "/images/leagues/ncaa.svg" },
  { code: "SHL", name: "Swedish Hockey League", country: "Sweden", region: "Europe", logoUrl: "/images/leagues/shl.svg" },
  { code: "LIIGA", name: "Liiga", country: "Finland", region: "Europe", logoUrl: "/images/leagues/liiga.svg" },
  { code: "FIN-U20", name: "Finnish U20 SM-sarja", country: "Finland", region: "Europe", logoUrl: "/images/leagues/fin-u20.svg" },
  { code: "FIN-U18", name: "Finnish U18 SM-sarja", country: "Finland", region: "Europe", logoUrl: "/images/leagues/fin-u18.svg" },
  { code: "CZE", name: "Czech Extraliga", country: "Czechia", region: "Europe", logoUrl: "/images/leagues/cze.png" },
  { code: "SVK", name: "Tipos Extraliga", country: "Slovakia", region: "Europe", logoUrl: "/images/leagues/svk.png" },
  { code: "SVK-U20", name: "Slovak U20 Extraliga", country: "Slovakia", region: "Europe", logoUrl: "/images/leagues/svk-u20.svg" },
  { code: "SVK-U18", name: "Slovak U18 Extraliga", country: "Slovakia", region: "Europe", logoUrl: "/images/leagues/svk-u18.svg" },
  { code: "DEL", name: "Deutsche Eishockey Liga", country: "Germany", region: "Europe", logoUrl: "/images/leagues/del.svg" },
  { code: "KHL", name: "Kontinental Hockey League", country: "Russia", region: "Europe", logoUrl: "/images/leagues/khl.svg" },
  { code: "MHL", name: "Molodezhnaya Hockey League", country: "Russia", region: "Europe", logoUrl: "/images/leagues/mhl.png" },
  { code: "SWE-U20", name: "Swedish U20 Nationell", country: "Sweden", region: "Europe", logoUrl: "/images/leagues/swe-u20.svg" },
  { code: "SWE-U18", name: "Swedish U18 Nationell", country: "Sweden", region: "Europe", logoUrl: "/images/leagues/swe-u18.svg" },
  { code: "ECHL", name: "ECHL", country: "USA / Canada", region: "North America", logoUrl: "/images/leagues/echl.svg" },
  { code: "VHL", name: "Vysshaya Hockey League", country: "Russia", region: "Europe", logoUrl: "/images/leagues/vhl.png" },
] as const;

export async function seedWorldLeagueCatalog() {
  await prisma.$transaction(WORLD_LEAGUE_CATALOG.map((league) => prisma.worldLeague.upsert({
    where: { code: league.code },
    update: { name: league.name, country: league.country, region: league.region, logoUrl: league.logoUrl, active: true },
    create: league,
  })));
  return WORLD_LEAGUE_CATALOG.length;
}
