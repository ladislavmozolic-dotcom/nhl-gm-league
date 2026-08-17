// CZ translation overlay for the tactics dial option labels + descriptions (which
// live as sim data in lib/sim/tactics.ts). `dialLabel`/`dialDesc` return Czech when
// lang === "cs" and a translation exists, otherwise the English sim data. de/ru fall
// back to English. Used by SystemEditor + LineEditor.

import { DIAL_LABELS, DIAL_DESC } from "./sim/tactics";
import type { Lang } from "./i18n";

type Sub = Record<string, string>;
type Group = Record<string, Sub>;

const LABELS_CS: Group = {
  tempo: { slow: "Pomalé / Kontrola", balanced: "Vyvážené", fast: "Rýchle / Tempo" },
  forecheck: { passive: "Pasívny (1-2-2)", balanced: "Vyvážený", aggressive: "Agresívny (2-1-2)" },
  puckStyle: { cycle: "Cyklovanie", balanced: "Vyvážené", rush: "Rush / Prechod", shotVolume: "Objem striel" },
  dZone: { collapse: "Zhustenie / Box", balanced: "Vyvážené", aggressive: "Agresívne / Osobka" },
  ppStyle: { balanced: "Vyvážená", umbrella: "Dáždnik", "131": "1-3-1", overload: "Preťaženie" },
  pkStyle: { balanced: "Vyvážené", box: "Box (pasívne)", diamond: "Diamant", aggressive: "Agresívne" },
};

const DESC_CS: Group = {
  tempo: {
    slow: "Drž puk a spomaľ hru — menej šancí na oboch stranách a menšia únava. Dobré na udržanie vedenia alebo pre tím bez hĺbky.",
    balanced: "Bez dôrazu na tempo — hraj ako hra príde.",
    fast: "Zrýchli hru na behanie — viac šancí pre aj proti, ale nohy sa unavia rýchlejšie. Chce korčuľovanie (SK) a výdrž (EN).",
  },
  forecheck: {
    passive: "Zostaň vzadu v 1-2-2, chráň stred a čakaj na chyby — menej trestov a sviežejšie nohy, ale prenecháš viac puku.",
    balanced: "Štandardný forčekový tlak.",
    aggressive: "Naháňaj puk hlboko v 2-1-2 — pritlačíš ich a vynútiš straty, ale prekonaný forček dáva prečíslenia a máš viac trestov + rýchlejšiu únavu. Chce dôraz (CK) a rýchlosť (SK).",
  },
  puckStyle: {
    cycle: "Drž puk dole a cyklu — viac striel z dlhého tlaku, ale každá o kúsok nižšej kvality. Chce prihrávku (PA) a silu (ST).",
    balanced: "Zmiešaný útok, bez rukopisu.",
    rush: "Útoč z rýchleho prechodu — menej striel, ale oveľa nebezpečnejších zo slotu. Chce zakončenie (SC), prihrávku (PA) a rýchlosť (SK).",
    shotVolume: "Hádž všetko na bránu odkiaľkoľvek — veľa striel od modrej, clony a dorážky; vysoký objem, nižšia priemerná nebezpečnosť. Chce strelcov (SC) a veľkosť pred bránou (váha).",
  },
  dZone: {
    collapse: "Zhusti sa do boxu, blokuj strely a ber slot — prenecháš perimeter, ale uberieš im nebezpečné šance. Chce obranu (DF).",
    balanced: "Štandardné pokrytie obranného pásma.",
    aggressive: "Napádaj puk osobne vo vlastnom pásme — viac zisku puku, ale ak stratíš hráča, nebezpečnosť proti rastie a máš viac trestov. Chce obranu (DF) a rýchlosť (SK).",
  },
  ppStyle: {
    balanced: "Bez rukopisu v presilovke.",
    umbrella: "Traja hore + hráč pred bránou — strely od modrej, clony a tečovanie. Chce strelca (SC).",
    "131": "Moderná 1-3-1: golfový úder z boku po krížnych prihrávkach — najsmrteľnejšia PP keď funguje. Chce sniper na one-timer (SC) + rozohrávača (PA).",
    overload: "Zaplň jednu stranu a cyklu dole na zadné dvierka — trpezlivá PP na držanie puku. Chce prihrávku (PA) a silu (ST).",
  },
  pkStyle: {
    balanced: "Štandardné oslabenie.",
    box: "Pasívny box — chráň slot, blokuj cesty, vyhadzuj keď môžeš. Solídne, prenecháš perimeter. Chce obranu (DF).",
    diamond: "Diamant — tlač na modrú a zabráň krížnej prihrávke; silné proti Dáždniku / 1-3-1. Chce obranu (DF) + rýchlosť (SK).",
    aggressive: "Napádaj puk a núť vyhadzovanie — zabíja PP čas, ale prekonaný tlak pustí veľkú šancu a riskuješ tresty. Chce rýchlosť (SK).",
  },
};

type DialKey = keyof typeof DIAL_LABELS;

export function dialLabel(lang: Lang, dial: DialKey, opt: string): string {
  if (lang === "cs" && LABELS_CS[dial]?.[opt]) return LABELS_CS[dial][opt];
  return (DIAL_LABELS[dial] as Record<string, string>)[opt] ?? opt;
}

export function dialDesc(lang: Lang, dial: DialKey, opt: string): string {
  if (lang === "cs" && DESC_CS[dial]?.[opt]) return DESC_CS[dial][opt];
  return DIAL_DESC[dial]?.[opt] ?? "";
}
