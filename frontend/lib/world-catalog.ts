import { prisma } from "@/lib/prisma";

/** The competitions the first Around the World import supports.  Seeding this
 * catalog is idempotent; source adapters can be added league by league without
 * changing the public data model. */
export const WORLD_LEAGUE_CATALOG = [
  { code: "WHL", name: "Western Hockey League", country: "Canada / USA", region: "North America" },
  { code: "OHL", name: "Ontario Hockey League", country: "Canada", region: "North America" },
  { code: "QMJHL", name: "Quebec Maritimes Junior Hockey League", country: "Canada", region: "North America" },
  { code: "NCAA", name: "NCAA Division I", country: "USA", region: "North America" },
  { code: "SHL", name: "Swedish Hockey League", country: "Sweden", region: "Europe" },
  { code: "LIIGA", name: "Liiga", country: "Finland", region: "Europe" },
  { code: "FIN-U20", name: "Finnish U20 SM-sarja", country: "Finland", region: "Europe" },
  { code: "FIN-U18", name: "Finnish U18 SM-sarja", country: "Finland", region: "Europe" },
  { code: "CZE", name: "Czech Extraliga", country: "Czechia", region: "Europe" },
  { code: "SVK", name: "Tipos Extraliga", country: "Slovakia", region: "Europe" },
  { code: "SVK-U20", name: "Slovak U20 Extraliga", country: "Slovakia", region: "Europe" },
  { code: "SVK-U18", name: "Slovak U18 Extraliga", country: "Slovakia", region: "Europe" },
  { code: "DEL", name: "Deutsche Eishockey Liga", country: "Germany", region: "Europe" },
  { code: "KHL", name: "Kontinental Hockey League", country: "Russia", region: "Europe" },
  { code: "MHL", name: "Molodezhnaya Hockey League", country: "Russia", region: "Europe" },
  { code: "SWE-U20", name: "Swedish U20 Nationell", country: "Sweden", region: "Europe" },
  { code: "SWE-U18", name: "Swedish U18 Nationell", country: "Sweden", region: "Europe" },
] as const;

export async function seedWorldLeagueCatalog() {
  await prisma.$transaction(WORLD_LEAGUE_CATALOG.map((league) => prisma.worldLeague.upsert({
    where: { code: league.code },
    update: { name: league.name, country: league.country, region: league.region, active: true },
    create: league,
  })));
  return WORLD_LEAGUE_CATALOG.length;
}
