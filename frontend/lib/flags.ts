// NHL API birthCountry is an IOC/ISO-3 code. Map the hockey nations to a flag emoji.
const ISO3_TO_ISO2: Record<string, string> = {
  CAN: "CA", USA: "US", SWE: "SE", FIN: "FI", RUS: "RU", CZE: "CZ", SVK: "SK",
  DEU: "DE", GER: "DE", CHE: "CH", SUI: "CH", DNK: "DK", DEN: "DK", NOR: "NO",
  LVA: "LV", LAT: "LV", BLR: "BY", AUT: "AT", FRA: "FR", GBR: "GB", SVN: "SI",
  SLO: "SI", KAZ: "KZ", UKR: "UA", POL: "PL", ITA: "IT", JPN: "JP", KOR: "KR",
  CHN: "CN", AUS: "AU", NLD: "NL", HUN: "HU", EST: "EE", LTU: "LT",
};

/** Country flag emoji for an NHL birthCountry code (empty string if unknown). */
export function countryFlag(code: string | null | undefined): string {
  if (!code) return "";
  const iso2 = ISO3_TO_ISO2[code.toUpperCase()];
  if (!iso2) return "";
  return String.fromCodePoint(...[...iso2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
