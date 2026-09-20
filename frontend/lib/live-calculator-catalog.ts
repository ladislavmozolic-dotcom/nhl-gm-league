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
  {
    key: "mpPenaltiesDrawnPg",
    label: "Penalties Drawn / GP (Vybojované presilovky na zápas)",
    source: "moneypuck",
    description: "Počet vybojovaných faulov/presiloviek pre tím v prepočte na zápas.",
    defaultInvert: false,
    unit: "fauly/GP",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safeRate(c.penaltiesDrawn, c.gp ?? 0);
      const lVal = safeRate(l.penaltiesDrawn, l.gp ?? 0);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpPenaltiesDrawn60",
    label: "Penalties Drawn / 60 (Vybojované presilovky / 60 min)",
    source: "moneypuck",
    description: "Frekvencia vybojovaných faulov/presiloviek súpera za 60 minút na ľade.",
    defaultInvert: false,
    unit: "fauly/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.penaltiesDrawn, c.toi);
      const lVal = safePer60(l.penaltiesDrawn, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpPenaltiesTakenPg",
    label: "Penalties Taken / GP (Spáchané fauly na zápas)",
    source: "moneypuck",
    description: "Počet menších a väčších trestov udelených hráčovi na zápas (menej = lepšie).",
    defaultInvert: true,
    unit: "fauly/GP",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safeRate(c.penalties, c.gp ?? 0);
      const lVal = safeRate(l.penalties, l.gp ?? 0);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpPenaltiesTaken60",
    label: "Penalties Taken / 60 (Spáchané fauly / 60 min)",
    source: "moneypuck",
    description: "Frekvencia udelených trestov za 60 minút na ľade (menej = lepšie).",
    defaultInvert: true,
    unit: "fauly/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.penalties, c.toi);
      const lVal = safePer60(l.penalties, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpPenaltyBalance",
    label: "Net Penalties / 60 (Čistá bilancia faulov Drawn − Taken)",
    source: "moneypuck",
    description: "Rozdiel medzi vybojovanými a spáchanými faulami za 60 minút (Penalty Differential).",
    defaultInvert: false,
    unit: "rozdiel/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cD = safePer60(c.penaltiesDrawn, c.toi);
      const cT = safePer60(c.penalties, c.toi);
      const cVal = cD != null && cT != null ? cD - cT : null;

      const lD = safePer60(l.penaltiesDrawn, l.toi);
      const lT = safePer60(l.penalties, l.toi);
      const lVal = lD != null && lT != null ? lD - lT : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpPimDrawnPg",
    label: "PIM Drawn / GP (Vybojované trestné minúty / zápas)",
    source: "moneypuck",
    description: "Koľko trestných minút súperov hráč vybojoval pre svoj tím na zápas.",
    defaultInvert: false,
    unit: "min/GP",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safeRate(c.pimDrawn, c.gp ?? 0);
      const lVal = safeRate(l.pimDrawn, l.gp ?? 0);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpGameScorePg",
    label: "Game Score / GP (Celkový vplyv na hru MoneyPuck)",
    source: "moneypuck",
    description: "Komplexné hodnotenie výkonu hráča (Dom Luszczyszyn / MoneyPuck model) na zápas.",
    defaultInvert: false,
    unit: "GS/GP",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safeRate(c.gameScore, c.gp ?? 0);
      const lVal = safeRate(l.gameScore, l.gp ?? 0);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpShotAttempts60",
    label: "Shot Attempts / 60 (Individuálny Corsi For za 60 min)",
    source: "moneypuck",
    description: "Všetky vlastné strelecké pokusy hráča (na bránu, mimo, blokované) za 60 minút.",
    defaultInvert: false,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.shotAttempts, c.toi);
      const lVal = safePer60(l.shotAttempts, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpUnblockedAttempts60",
    label: "Unblocked Shot Attempts / 60 (Fenwick For za 60 min)",
    source: "moneypuck",
    description: "Vlastné neblokované strely hráča na bránu a mimo nej za 60 minút.",
    defaultInvert: false,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.unblockedAttempts, c.toi);
      const lVal = safePer60(l.unblockedAttempts, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpReboundsCreated60",
    label: "Rebounds Created / 60 (Vytvorené dorážky)",
    source: "moneypuck",
    description: "Počet vytvorených dorážok zo striel hráča za 60 minút na ľade.",
    defaultInvert: false,
    unit: "dorážky/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.reboundsCreated, c.toi);
      const lVal = safePer60(l.reboundsCreated, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpReboundGoalsPg",
    label: "Rebound Goals / GP (Góly z dorážok na zápas)",
    source: "moneypuck",
    description: "Góly strelené z dorážok pred bránkoviskom na zápas.",
    defaultInvert: false,
    unit: "G/GP",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safeRate(c.reboundGoals, c.gp ?? 0);
      const lVal = safeRate(l.reboundGoals, l.gp ?? 0);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpDzoneGiveaways60",
    label: "D-Zone Giveaways / 60 (Straty puku vo vlastnom pásme)",
    source: "moneypuck",
    description: "Straty puku vo vlastnom obrannom pásme za 60 minút (menej = lepšie).",
    defaultInvert: true,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.dZoneGiveaways, c.toi);
      const lVal = safePer60(l.dZoneGiveaways, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpHdShots60",
    label: "High-Danger Shots / 60 (Strely z bezprostrednej blízkosti)",
    source: "moneypuck",
    description: "Vlastné strely z nebezpečného pásma pred bránkou za 60 minút.",
    defaultInvert: false,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.hdShots, c.toi);
      const lVal = safePer60(l.hdShots, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpHdGoalsPg",
    label: "High-Danger Goals / GP (Góly z tutoviek na zápas)",
    source: "moneypuck",
    description: "Góly strelené z bezprostrednej blízkosti pred bránou na zápas.",
    defaultInvert: false,
    unit: "G/GP",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safeRate(c.hdGoals, c.gp ?? 0);
      const lVal = safeRate(l.hdGoals, l.gp ?? 0);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpHdXg60",
    label: "High-Danger xG / 60 (Očakávané góly z tutoviek / 60)",
    source: "moneypuck",
    description: "Kvalita vytvorených nebezpečných šancí v slote za 60 minút.",
    defaultInvert: false,
    unit: "HD xG/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.hdXg, c.toi);
      const lVal = safePer60(l.hdXg, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpMdShots60",
    label: "Medium-Danger Shots / 60 (Strely zo strednej vzdialenosti)",
    source: "moneypuck",
    description: "Strely z kruhov a strednej vzdialenosti za 60 minút.",
    defaultInvert: false,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.mdShots, c.toi);
      const lVal = safePer60(l.mdShots, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpLdShots60",
    label: "Low-Danger Shots / 60 (Strely z diaľky / od modrej)",
    source: "moneypuck",
    description: "Strely z diaľky a od mantinelov za 60 minút.",
    defaultInvert: false,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.ldShots, c.toi);
      const lVal = safePer60(l.ldShots, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpOzoneStartsPct",
    label: "O-Zone Start % (Vhadzovania v útočnom pásme)",
    source: "moneypuck",
    description: "Percento striedaní začatých v útočnom pásme oproti obrannému.",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cTot = (c.oZoneShiftStarts ?? 0) + (c.dZoneShiftStarts ?? 0);
      const lTot = (l.oZoneShiftStarts ?? 0) + (l.dZoneShiftStarts ?? 0);
      const cVal = cTot > 0 ? (c.oZoneShiftStarts ?? 0) / cTot : null;
      const lVal = lTot > 0 ? (l.oZoneShiftStarts ?? 0) / lTot : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpOnIceCorsiPct",
    label: "On-Ice Corsi % (CF% Pomer striel tímu na ľade)",
    source: "moneypuck",
    description: "Percentuálny pomer všetkých streleckých pokusov tímu s hráčom na ľade (>50% = dominancia).",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = c.onIceCorsiPct != null && c.onIceCorsiPct > 0 ? c.onIceCorsiPct * 100 : null;
      const lVal = l.onIceCorsiPct != null && l.onIceCorsiPct > 0 ? l.onIceCorsiPct * 100 : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpOnIceFenwickPct",
    label: "On-Ice Fenwick % (FF% Pomer neblokovaných striel)",
    source: "moneypuck",
    description: "Percentuálny pomer neblokovaných striel tímu, keď je hráč na ľade.",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = c.onIceFenwickPct != null && c.onIceFenwickPct > 0 ? c.onIceFenwickPct * 100 : null;
      const lVal = l.onIceFenwickPct != null && l.onIceFenwickPct > 0 ? l.onIceFenwickPct * 100 : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpShiftsPg",
    label: "Shifts / GP (Počet striedaní na zápas)",
    source: "moneypuck",
    description: "Priemerný počet odohraných striedaní za zápas.",
    defaultInvert: false,
    unit: "striedania/GP",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safeRate(c.shifts, c.gp ?? 0);
      const lVal = safeRate(l.shifts, l.gp ?? 0);
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

// ========================= GOALIE METRIC CATALOG =========================
export const GOALIE_CATALOG_METRICS: CatalogMetricItem[] = [
  // ========================= MONEYPUCK GOALIE =========================
  {
    key: "svPct",
    label: "Save % (Celková úspešnosť zásahov)",
    source: "moneypuck",
    description: "Celková percentuálna úspešnosť zásahov brankára (SV%).",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.svPct,
        adv.last?.svPct,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "gaa",
    label: "GAA (Priemer inkasovaných gólov / 60 min)",
    source: "moneypuck",
    description: "Priemerný počet inkasovaných gólov za 60 minút hry (menej je lepšie).",
    defaultInvert: true,
    unit: "GAA",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.gaa,
        adv.last?.gaa,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "gsax",
    label: "GSAx (Chytené góly nad očakávanie celkovo)",
    source: "moneypuck",
    description: "Celkový počet gólov, ktoré brankár chytil navyše oproti očakávaniu (xG − inkasované góly).",
    defaultInvert: false,
    unit: "GSAx",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.gsax,
        adv.last?.gsax,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "gsax60",
    label: "GSAx / 60 min (Chytené góly nad očakávanie za zápas)",
    source: "moneypuck",
    description: "GSAx prepočítané na 60 minút čistého času brankára na ľade.",
    defaultInvert: false,
    unit: "GSAx/60",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.gsax60,
        adv.last?.gsax60,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "hdSv",
    label: "High-Danger SV% (Úspešnosť pri tutovkách a dorážkach)",
    source: "moneypuck",
    description: "Úspešnosť zásahov proti strelám z bezprostrednej blízkosti a slotu (HD SV%).",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.hdSv,
        adv.last?.hdSv,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "hdGsax",
    label: "High-Danger GSAx (Chytené góly z tutoviek)",
    source: "moneypuck",
    description: "GSAx vygenerované výhradne proti strelám s vysokou nebezpečnosťou.",
    defaultInvert: false,
    unit: "HD GSAx",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.hdGsax,
        adv.last?.hdGsax,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "mdSv",
    label: "Medium-Danger SV% (Úspešnosť striel zo strednej vzdialenosti)",
    source: "moneypuck",
    description: "Úspešnosť zásahov zo stredného pásma a kruhov (MD SV%).",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.mdSv,
        adv.last?.mdSv,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "ldSv",
    label: "Low-Danger SV% (Úspešnosť z diaľky / modrej čiary)",
    source: "moneypuck",
    description: "Úspešnosť zásahov proti strelám z diaľky a od mantinelov (LD SV%).",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.ldSv,
        adv.last?.ldSv,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "rebCtrl",
    label: "Rebound Control (Kontrola dorážok xRebounds − Rebounds)",
    source: "moneypuck",
    description: "Miera eliminácie nebezpečných dorážok súperom oproti očakávaniu (kladné = menej dorážok).",
    defaultInvert: false,
    unit: "RebCtrl",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.rebCtrl,
        adv.last?.rebCtrl,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "freezePct",
    label: "Freeze % (Prerušenie hry / podržanie pukov)",
    source: "moneypuck",
    description: "Percento zásahov, po ktorých brankár bezpečne prikryl puk a prerušil hru.",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.freezePct,
        adv.last?.freezePct,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "icetime",
    label: "Ice Time / Vyťaženie brankára (Celkový čas v minútach)",
    source: "moneypuck",
    description: "Celkový odchytaný čas v sezóne vyjadrený v minútach (vytrvalosť & jednotka tímu).",
    defaultInvert: false,
    unit: "min",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      const c = adv.cur?.icetime != null ? adv.cur.icetime / 60 : null;
      const l = adv.last?.icetime != null ? adv.last.icetime / 60 : null;
      return blend(
        c,
        l,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "gp",
    label: "Games Played (Odchytané zápasy v sezóne)",
    source: "nhl",
    description: "Počet odchytaných zápasov v aktuálnej a predchádzajúcej sezóne.",
    defaultInvert: false,
    unit: "GP",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      const c = adv.cur?.gp ?? p.curSeasonGP ?? null;
      const l = adv.last?.gp ?? p.lastSeasonGP ?? null;
      return blend(c, l, c ?? 0, l ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "sz",
    label: "Výška brankára (Height cm)",
    source: "bio",
    description: "Výška brankára v centimetroch (veľkosť a priestorové pokrytie brány).",
    defaultInvert: false,
    unit: "cm",
    getValue: (p) => {
      const m = (p.height ?? "").match(/(\d+)\s*cm/);
      return m ? Number(m[1]) : (p.height ? Number(p.height) : null);
    },
  },
  {
    key: "weight",
    label: "Hmotnosť brankára (Weight lbs)",
    source: "bio",
    description: "Hmotnosť brankára v librách.",
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
    key: "goals",
    label: "Inkasované góly (Goals Against)",
    source: "moneypuck",
    description: "Celkový počet inkasovaných gólov brankára (menej je lepšie).",
    defaultInvert: true,
    unit: "GA",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.goals,
        adv.last?.goals,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "xGoals",
    label: "xGoals (Očakávané inkasované góly súpera)",
    source: "moneypuck",
    description: "Súčet xG všetkých striel, ktorým brankár čelil.",
    defaultInvert: false,
    unit: "xGA",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.xGoals,
        adv.last?.xGoals,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "shots",
    label: "Shots Against (Čelené strely na bránu)",
    source: "moneypuck",
    description: "Celkový počet striel smerujúcich do priestoru brány.",
    defaultInvert: false,
    unit: "SA",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.shots,
        adv.last?.shots,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "rebounds",
    label: "Rebounds Allowed (Vyprodukované dorážky pre súpera)",
    source: "moneypuck",
    description: "Počet dorážok, ktoré súper získal po zásahu brankára (menej je lepšie).",
    defaultInvert: true,
    unit: "Reb",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.rebounds,
        adv.last?.rebounds,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "xRebounds",
    label: "Expected Rebounds (Očakávané dorážky podľa typu striel)",
    source: "moneypuck",
    description: "Očakávaný počet dorážok vygenerovaný na základe kvality a trajektórie striel.",
    defaultInvert: false,
    unit: "xReb",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.xRebounds,
        adv.last?.xRebounds,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "freeze",
    label: "Puk prikrytý / Freezes (Počet prerušení hry)",
    source: "moneypuck",
    description: "Absolútny počet prerušení hry prikrytím alebo zovretím puku po strele.",
    defaultInvert: false,
    unit: "Frz",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.freeze,
        adv.last?.freeze,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "xFreeze",
    label: "Expected Freezes (Očakávané prerušenia)",
    source: "moneypuck",
    description: "Očakávaný počet prerušení hry podľa trajektórie a nebezpečnosti striel.",
    defaultInvert: false,
    unit: "xFrz",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.xFreeze,
        adv.last?.xFreeze,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "penalties",
    label: "Penalties (Tresty brankára)",
    source: "moneypuck",
    description: "Počet menších alebo väčších trestov udelených brankárovi (menej je lepšie).",
    defaultInvert: true,
    unit: "Pen",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.penalties,
        adv.last?.penalties,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "pim",
    label: "PIM (Trestné minúty brankára)",
    source: "moneypuck",
    description: "Celkové trestné minúty brankára (menej je lepšie).",
    defaultInvert: true,
    unit: "min",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.pim,
        adv.last?.pim,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "flurryAxg",
    label: "Flurry-Adjusted xG Against",
    source: "moneypuck",
    description: "Očakávané góly proti po očistení o rýchle opakované strely zblízka.",
    defaultInvert: false,
    unit: "xGA",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.flurryAxg,
        adv.last?.flurryAxg,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "unblockedShots",
    label: "Unblocked Shot Attempts Against (Nezblokované strely súpera)",
    source: "moneypuck",
    description: "Počet striel a striel mimo brány, ktoré neboli zblokované hráčmi v poli.",
    defaultInvert: false,
    unit: "USAT",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.unblockedShots,
        adv.last?.unblockedShots,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "age",
    label: "Vek brankára (Age)",
    source: "bio",
    description: "Aktuálny vek brankára.",
    defaultInvert: false,
    unit: "rokov",
    getValue: (p) => (p.age != null && p.age > 0 ? p.age : null),
  },
];

export const GOALIE_METRIC_BY_KEY: Record<string, CatalogMetricItem> = Object.fromEntries(
  GOALIE_CATALOG_METRICS.map((m) => [m.key, m])
);


