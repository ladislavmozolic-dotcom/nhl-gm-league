/**
 * Unified Metric Catalog for Live Calculator.
 * Supports dynamic addition of metrics from multiple data servers:
 * - NHL API / Boxscore
 * - MoneyPuck Advanced Analytics
 * - NHL EDGE Tracking
 * - AHL HockeyTech
 * - Biometrics / Profile
 */

export type MetricSource = "nhl" | "moneypuck" | "edge" | "ahl" | "bio";

export type MetricSourceMeta = {
  id: MetricSource;
  name: string;
  badge: string;
  color: string;
  description: string;
};

export const METRIC_SOURCES: Record<MetricSource, MetricSourceMeta> = {
  nhl: {
    id: "nhl",
    name: "NHL API / Boxscore",
    badge: "NHL",
    color: "text-sky-400 bg-sky-500/10 border-sky-500/30",
    description: "Oficiálne zápasové štatistiky a herné situácie (TOI, oslabenia, buly, hity, bloky, +/-).",
  },
  moneypuck: {
    id: "moneypuck",
    name: "MoneyPuck Analytics",
    badge: "MoneyPuck",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    description: "Pokročilá analytika (xG, relatívne xGA 5v5/oslabenia, finishing, primárne asistencie).",
  },
  edge: {
    id: "edge",
    name: "NHL EDGE Tracking",
    badge: "EDGE",
    color: "text-teal-400 bg-teal-500/10 border-teal-500/30",
    description: "Senzorové merania pohybu (rýchlostné šprinty > 20 mph, maximálna rýchlosť, vzdialenosť).",
  },
  ahl: {
    id: "ahl",
    name: "AHL HockeyTech",
    badge: "AHL",
    color: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    description: "Oficiálne dáta z AHL s možnosťou aplikácie NHLe koeficientov.",
  },
  bio: {
    id: "bio",
    name: "Biometria & Kariéra",
    badge: "BIO",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    description: "Fyzické a kariérne atribúty (hmotnosť, vek, odohraté zápasy ZČ a play-off).",
  },
};

export type CatalogMetricItem = {
  key: string;
  label: string;
  source: MetricSource;
  description: string;
  defaultInvert: boolean;
  unit?: string;
  getValue: (
    player: any,
    config: {
      latestMpYear: number;
      previousMpYear: number;
      latestWeight: number;
      previousWeight: number;
      ahlNhleLatest?: number;
      ahlNhlePrevious?: number;
    }
  ) => number | null;
};

// Safe helper utilities
const safeRate = (val: number | null | undefined, gp: number): number | null =>
  val != null && gp > 0 ? val / gp : null;

const safePer60 = (count: number | null | undefined, toiSec: number | null | undefined): number | null =>
  count != null && toiSec != null && toiSec > 0 ? (count / toiSec) * 3600 : null;

const blend = (
  curVal: number | null | undefined,
  lastVal: number | null | undefined,
  curGP: number,
  lastGP: number,
  wCur: number,
  wLast: number
): number | null => {
  const hasC = curVal != null && !isNaN(curVal) && curGP > 0;
  const hasL = lastVal != null && !isNaN(lastVal) && lastGP > 0;
  if (hasC && hasL) {
    const sumW = (wCur || 0) + (wLast || 0);
    const normCur = sumW > 0 ? wCur / sumW : 0.8;
    const normLast = sumW > 0 ? wLast / sumW : 0.2;
    return curVal! * normCur + lastVal! * normLast;
  }
  if (hasC) return curVal!;
  if (hasL) return lastVal!;
  return null;
};

export const CATALOG_METRICS: CatalogMetricItem[] = [
  // ========================= NHL API =========================
  {
    key: "teamPkToiPg",
    label: "Team PK TOI/GP (Tímový čas v oslabení / zápas)",
    source: "nhl",
    description: "Priemerný čas za zápas, ktorý tím strávi v oslabení (v sekundách alebo minútach).",
    defaultInvert: false,
    unit: "min/GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = p.curSeasonTeamShToi != null ? p.curSeasonTeamShToi / 60 : null;
      const l = p.lastSeasonShToi != null ? p.lastSeasonShToi / 60 : null; // fallback
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "playerPkToiPg",
    label: "Player PK TOI/GP (Hráčov čas v oslabení / zápas)",
    source: "nhl",
    description: "Priemerný čas hráča na ľade v oslabeniach za zápas.",
    defaultInvert: false,
    unit: "min/GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = p.curSeasonShToi != null ? p.curSeasonShToi / 60 : null;
      const l = p.lastSeasonShToi != null ? p.lastSeasonShToi / 60 : null;
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "totalToiPg",
    label: "Total TOI/GP (Celkový čas na ľade / zápas)",
    source: "nhl",
    description: "Priemerný celkový čas na ľade za zápas vo všetkých herných situáciách.",
    defaultInvert: false,
    unit: "min/GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = p.curSeasonToi != null ? p.curSeasonToi / 60 : null;
      const l = p.lastSeasonToi != null ? p.lastSeasonToi / 60 : null;
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "foPct",
    label: "Faceoff % (Úspešnosť na vhadzovaniach)",
    source: "nhl",
    description: "Percentuálna úspešnosť na vhadzovaniach (centri).",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      return blend(p.curSeasonFoPct, p.lastSeasonFoPct, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "tk60",
    label: "Takeaways / 60 (Získané puky na 60 min)",
    source: "nhl",
    description: "Počet odobratých pukov súperovi v prepočte na 60 minút ľadu.",
    defaultInvert: false,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const cToi = (p.curSeasonToi ?? 0) * cGP;
      const lToi = (p.lastSeasonToi ?? 0) * lGP;
      const c = safePer60(p.curSeasonTK, cToi);
      const l = safePer60(p.lastSeasonTK, lToi);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "gv60",
    label: "Giveaways / 60 (Stratené puky na 60 min)",
    source: "nhl",
    description: "Počet stratených pukov na 60 minút ľadu (nižšie je lepšie).",
    defaultInvert: true,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const cToi = (p.curSeasonToi ?? 0) * cGP;
      const lToi = (p.lastSeasonToi ?? 0) * lGP;
      const c = safePer60(p.curSeasonGV, cToi);
      const l = safePer60(p.lastSeasonGV, lToi);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "pmPg",
    label: "+/- per Game (Plus/Mínus na zápas)",
    source: "nhl",
    description: "Bilancia účasti pri strelených a inkasovaných góloch na zápas.",
    defaultInvert: false,
    unit: "+/- / GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = safeRate(p.curSeasonPM, cGP);
      const l = safeRate(p.lastSeasonPM, lGP);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "pimPg",
    label: "PIM / GP (Trestné minúty na zápas)",
    source: "nhl",
    description: "Trestné minúty na zápas (menej je lepšie).",
    defaultInvert: true,
    unit: "min/GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = safeRate(p.curSeasonPim, cGP);
      const l = safeRate(p.lastSeasonPim, lGP);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ppgPg",
    label: "Powerplay Goals / GP (Presilovkové góly)",
    source: "nhl",
    description: "Góly strelené v početnej výhode za zápas.",
    defaultInvert: false,
    unit: "G/GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = safeRate(p.curSeasonPpG, cGP);
      const l = safeRate(p.lastSeasonPpG, lGP);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "shotsPg",
    label: "Shots / GP (Strely na bránu na zápas)",
    source: "nhl",
    description: "Priemerný počet striel na bránu za zápas.",
    defaultInvert: false,
    unit: "S/GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = safeRate(p.curSeasonShots, cGP);
      const l = safeRate(p.lastSeasonShots, lGP);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "hitsPg",
    label: "Hits / GP (Hity na zápas)",
    source: "nhl",
    description: "Priemerný počet rozdaných hitov / bodyčekov za zápas.",
    defaultInvert: false,
    unit: "Hits/GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = safeRate(p.curSeasonHits, cGP);
      const l = safeRate(p.lastSeasonHits, lGP);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "blocksPg",
    label: "Blocks / GP (Zblokované strely na zápas)",
    source: "nhl",
    description: "Priemerný počet zblokovaných striel súpera za zápas.",
    defaultInvert: false,
    unit: "Blk/GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = safeRate(p.curSeasonBlocks, cGP);
      const l = safeRate(p.lastSeasonBlocks, lGP);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },

  // ========================= MONEYPUCK =========================
  {
    key: "xga5",
    label: "On-Ice xGA/60 5v5 (Očakávané góly proti 5v5)",
    source: "moneypuck",
    description: "Očakávané inkasované góly súpera za 60 minút pri hre 5 na 5.",
    defaultInvert: true,
    unit: "xGA/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.onIceAxg5v5, c.toi5v5);
      const lVal = safePer60(l.onIceAxg5v5, l.toi5v5);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "offXga5",
    label: "Off-Ice xGA/60 5v5 (xGA súpera keď hráč sedí)",
    source: "moneypuck",
    description: "Defenzívna úroveň tímu, keď hráč nie je na ľade pri hre 5v5.",
    defaultInvert: false,
    unit: "xGA/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.offIceAxg5v5, c.offIceToi5v5);
      const lVal = safePer60(l.offIceAxg5v5, l.offIceToi5v5);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "relXga5",
    label: "Rel xGA/60 5v5 (Relatívne xGA tímu 5v5)",
    source: "moneypuck",
    description: "Rozdiel v očakávaných góloch súpera s ním vs bez neho pri hre 5v5.",
    defaultInvert: true,
    unit: "Rel xGA/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cOn = safePer60(c.onIceAxg5v5, c.toi5v5);
      const cOff = safePer60(c.offIceAxg5v5, c.offIceToi5v5);
      const cVal = cOn != null && cOff != null ? cOn - cOff : null;

      const lOn = safePer60(l.onIceAxg5v5, l.toi5v5);
      const lOff = safePer60(l.offIceAxg5v5, l.offIceToi5v5);
      const lVal = lOn != null && lOff != null ? lOn - lOff : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ga5",
    label: "On-Ice GA/60 5v5 (Reálne inkasované góly 5v5)",
    source: "moneypuck",
    description: "Skutočné góly inkasované tímom za 60 minút pri hre 5 na 5.",
    defaultInvert: true,
    unit: "GA/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.onIceGa5v5, c.toi5v5);
      const lVal = safePer60(l.onIceGa5v5, l.toi5v5);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "relGa5",
    label: "Rel GA/60 5v5 (Relatívne inkasované góly 5v5)",
    source: "moneypuck",
    description: "Rozdiel v reálnych góloch súpera na ľade vs mimo neho.",
    defaultInvert: true,
    unit: "Rel GA/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cOn = safePer60(c.onIceGa5v5, c.toi5v5);
      const cOff = safePer60(c.offIceGa5v5, c.offIceToi5v5);
      const cVal = cOn != null && cOff != null ? cOn - cOff : null;

      const lOn = safePer60(l.onIceGa5v5, l.toi5v5);
      const lOff = safePer60(l.offIceGa5v5, l.offIceToi5v5);
      const lVal = lOn != null && lOff != null ? lOn - lOff : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "xgaPk",
    label: "On-Ice xGA/60 PK (xGA súpera v oslabení 4v5)",
    source: "moneypuck",
    description: "Očakávané góly súpera v oslabení na 60 minút.",
    defaultInvert: true,
    unit: "xGA/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.onIceAxg4v5, c.toi4v5);
      const lVal = safePer60(l.onIceAxg4v5, l.toi4v5);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "relXgaPk",
    label: "Rel xGA/60 PK (Relatívne xGA v oslabení)",
    source: "moneypuck",
    description: "Rozdiel v xGA oslabenia tímu s ním vs bez neho.",
    defaultInvert: true,
    unit: "Rel xGA/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cOn = safePer60(c.onIceAxg4v5, c.toi4v5);
      const cOff = safePer60(c.offIceAxg4v5, c.offIceToi4v5);
      const cVal = cOn != null && cOff != null ? cOn - cOff : null;

      const lOn = safePer60(l.onIceAxg4v5, l.toi4v5);
      const lOff = safePer60(l.offIceAxg4v5, l.offIceToi4v5);
      const lVal = lOn != null && lOff != null ? lOn - lOff : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "xgfPct",
    label: "xGF% 5v5 (Podiel očakávaných gólov 5v5)",
    source: "moneypuck",
    description: "Percentuálny podiel očakávaných gólov tímu 5 na 5 (>50% = prevaha tímu).",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = c.onIceFxg5v5 != null && c.onIceAxg5v5 != null && c.onIceFxg5v5 + c.onIceAxg5v5 > 0
        ? c.onIceFxg5v5 / (c.onIceFxg5v5 + c.onIceAxg5v5)
        : null;
      const lVal = l.onIceFxg5v5 != null && l.onIceAxg5v5 != null && l.onIceFxg5v5 + l.onIceAxg5v5 > 0
        ? l.onIceFxg5v5 / (l.onIceFxg5v5 + l.onIceAxg5v5)
        : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ixg60",
    label: "ixG/60 (Individuálne očakávané góly / 60 min)",
    source: "moneypuck",
    description: "Kvalita a objem vlastných streleckých šancí hráča za 60 minút.",
    defaultInvert: false,
    unit: "ixG/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.ixg, c.toi);
      const lVal = safePer60(l.ixg, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "g_xg60",
    label: "(G - xG)/60 (Finishing / efektivita streľby)",
    source: "moneypuck",
    description: "Rozdiel medzi skutočnými a očakávanými gólmi (efektivita zakončenia).",
    defaultInvert: false,
    unit: "G-xG/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = c.g != null && c.ixg != null && c.toi > 0 ? ((c.g - c.ixg) / c.toi) * 3600 : null;
      const lVal = l.g != null && l.ixg != null && l.toi > 0 ? ((l.g - l.ixg) / l.toi) * 3600 : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "a1_5v5_60",
    label: "Primary Assists / 60 5v5 (Prvé asistencie 5v5)",
    source: "moneypuck",
    description: "Priame gólové prihrávky pri rovnovážnom stave 5 na 5 za 60 minút.",
    defaultInvert: false,
    unit: "A1/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.a1_5v5, c.toi5v5);
      const lVal = safePer60(l.a1_5v5, l.toi5v5);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "a2_5v5_60",
    label: "Secondary Assists / 60 5v5 (Druhé asistencie 5v5)",
    source: "moneypuck",
    description: "Sekundárne prihrávky pri rovnovážnom stave 5 na 5 za 60 minút.",
    defaultInvert: false,
    unit: "A2/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.a2_5v5, c.toi5v5);
      const lVal = safePer60(l.a2_5v5, l.toi5v5);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ppa1_60",
    label: "PP Primary Assists / 60 (Presilovkové primárne asistencie)",
    source: "moneypuck",
    description: "Priame gólové nahrávky v presilovkách za 60 minút.",
    defaultInvert: false,
    unit: "PPA1/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.ppa1, c.toi);
      const lVal = safePer60(l.ppa1, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ong60",
    label: "On-Ice Goals For / 60 (Góly tímu na ľade)",
    source: "moneypuck",
    description: "Góly strelené tímom, keď je hráč na ľade (za 60 minút).",
    defaultInvert: false,
    unit: "GF/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.ong, c.toi);
      const lVal = safePer60(l.ong, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "onga60",
    label: "On-Ice Goals Against / 60 (Inkasované góly celkovo)",
    source: "moneypuck",
    description: "Góly inkasované tímom za 60 minút, keď je hráč na ľade (menej je lepšie).",
    defaultInvert: true,
    unit: "GA/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.onGaAll, c.toi);
      const lVal = safePer60(l.onGaAll, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },

  // ========================= NHL EDGE =========================
  {
    key: "burst20",
    label: "Speed Bursts > 20 mph / 60 (Šprinty > 32 km/h)",
    source: "edge",
    description: "Frekvencia rýchlostných šprintov nad 32 km/h za 60 minút.",
    defaultInvert: false,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const es = (p.edgeSpeed as any) ?? {};
      const c = es.cur?.brst ?? null;
      const l = es.last?.brst ?? null;
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "edgeMaxSpeed",
    label: "Max Skating Speed (Maximálna nameraná rýchlosť)",
    source: "edge",
    description: "Najvyššia nameraná rýchlosť korčuľovania (mph).",
    defaultInvert: false,
    unit: "mph",
    getValue: (p, cfg) => {
      const es = (p.edgeSpeed as any) ?? {};
      const c = es.cur?.spd ?? null;
      const l = es.last?.spd ?? null;
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "edgeDistance",
    label: "Total Skating Distance / 60 (Nakorčuľovaná vzdialenosť)",
    source: "edge",
    description: "Nakorčuľovaná vzdialenosť v míľach na 60 minút ľadu.",
    defaultInvert: false,
    unit: "mi/60",
    getValue: (p, cfg) => {
      const es = (p.edgeSpeed as any) ?? {};
      const c = es.cur?.dist ?? null;
      const l = es.last?.dist ?? null;
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },

  // ========================= AHL HOCKEYTECH =========================
  {
    key: "ahlGpg",
    label: "AHL Goals / GP (Góly na zápas v AHL)",
    source: "ahl",
    description: "Góly na zápas vo farmárskej AHL s NHLe prepočtom.",
    defaultInvert: false,
    unit: "G/GP",
    getValue: (p, cfg) => {
      const a = (p.ahlStats as any) ?? {};
      const c = a.cur ?? {};
      const l = a.last ?? {};
      const nhleC = cfg.ahlNhleLatest ?? 0.446;
      const nhleL = cfg.ahlNhlePrevious ?? 0.448;
      const cVal = c.gp > 0 ? (c.g / c.gp) * nhleC : null;
      const lVal = l.gp > 0 ? (l.g / l.gp) * nhleL : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ahlApg",
    label: "AHL Assists / GP (Asistencie na zápas v AHL)",
    source: "ahl",
    description: "Asistencie na zápas vo farmárskej AHL s NHLe prepočtom.",
    defaultInvert: false,
    unit: "A/GP",
    getValue: (p, cfg) => {
      const a = (p.ahlStats as any) ?? {};
      const c = a.cur ?? {};
      const l = a.last ?? {};
      const nhleC = cfg.ahlNhleLatest ?? 0.446;
      const nhleL = cfg.ahlNhlePrevious ?? 0.448;
      const cVal = c.gp > 0 ? (c.a / c.gp) * nhleC : null;
      const lVal = l.gp > 0 ? (l.a / l.gp) * nhleL : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ahlShotsPg",
    label: "AHL Shots / GP (Strely na zápas v AHL)",
    source: "ahl",
    description: "Strely na zápas v AHL.",
    defaultInvert: false,
    unit: "S/GP",
    getValue: (p, cfg) => {
      const a = (p.ahlStats as any) ?? {};
      const c = a.cur ?? {};
      const l = a.last ?? {};
      const cVal = c.gp > 0 ? c.sh / c.gp : null;
      const lVal = l.gp > 0 ? l.sh / l.gp : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ahlPlusMinusPg",
    label: "AHL +/- per Game (Plus/Mínus na zápas v AHL)",
    source: "ahl",
    description: "Účasť pri strelených a inkasovaných góloch na zápas v AHL.",
    defaultInvert: false,
    unit: "+/- / GP",
    getValue: (p, cfg) => {
      const a = (p.ahlStats as any) ?? {};
      const c = a.cur ?? {};
      const l = a.last ?? {};
      const cVal = c.gp > 0 ? c.plusMinus / c.gp : null;
      const lVal = l.gp > 0 ? l.plusMinus / l.gp : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ahlPimPg",
    label: "AHL PIM / GP (Trestné minúty v AHL)",
    source: "ahl",
    description: "Trestné minúty v AHL (menej je lepšie).",
    defaultInvert: true,
    unit: "min/GP",
    getValue: (p, cfg) => {
      const a = (p.ahlStats as any) ?? {};
      const c = a.cur ?? {};
      const l = a.last ?? {};
      const cVal = c.gp > 0 ? c.pim / c.gp : null;
      const lVal = l.gp > 0 ? l.pim / l.gp : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },

  // ========================= BIOMETRICS & CAREER =========================
  {
    key: "weight",
    label: "Hmotnosť hráča (Weight lbs)",
    source: "bio",
    description: "Hmotnosť hráča v librách (fyzická dispozícia a sila).",
    defaultInvert: false,
    unit: "lbs",
    getValue: (p) => (p.weight != null && p.weight > 0 ? p.weight : null),
  },
  {
    key: "careerRegGP",
    label: "Kariérne zápasy ZČ (Career Regular GP)",
    source: "bio",
    description: "Celkový počet odohratých zápasov v základnej časti NHL.",
    defaultInvert: false,
    unit: "GP",
    getValue: (p) => (p.careerGP as any)?.reg ?? null,
  },
  {
    key: "careerPoGP",
    label: "Kariérne zápasy Play-off (Career Playoff GP)",
    source: "bio",
    description: "Celkový počet odohratých zápasov v play-off NHL.",
    defaultInvert: false,
    unit: "GP",
    getValue: (p) => (p.careerGP as any)?.po ?? null,
  },
  {
    key: "age",
    label: "Vek hráča (Age)",
    source: "bio",
    description: "Aktuálny vek hráča.",
    defaultInvert: false,
    unit: "rokov",
    getValue: (p) => (p.age != null && p.age > 0 ? p.age : null),
  },
];

export const METRIC_BY_KEY: Record<string, CatalogMetricItem> = Object.fromEntries(
  CATALOG_METRICS.map((m) => [m.key, m])
);
