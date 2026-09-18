import { prisma } from "@/lib/prisma";
import { cleanName, isRookieName } from "@/lib/playerName";
import { ACTIVE_SEASON } from "@/lib/career-server";
import { PRE_SEASON, REGULAR_SEASON } from "@/lib/phase";
import { teamManagerLabel } from "@/lib/team-gm";
import { normalizeLang, type Lang } from "@/lib/i18n";

export type LeaderTeamInfo = {
  code: string;
  slug?: string | null;
  logoUrl?: string | null;
};

export type LeaderItem = {
  rank: number;
  name: string;
  sub?: string;
  value: string | number;
  slug?: string | null;
  photoUrl?: string | null;
  gmSlug?: string | null;
  teamCode?: string | null;
  teamSlug?: string | null;
  teamLogo?: string | null;
  teams?: LeaderTeamInfo[];
  extraList?: string[];
  hideTeam?: boolean;
};

export type RecordPhase = "all" | "regular" | "playoffs" | "pre";
export type MainRecordCategory = "all" | "skaters" | "goalies" | "gms" | "teams" | "trophies" | "games";

export type RecordSection = {
  id: string;
  title: string;
  description?: string;
  icon: string;
  phase: RecordPhase;
  phaseBadge?: string;
  items: LeaderItem[];
  unit?: string;
};

export type RecordCategoryGroup = {
  id: string;
  title: string;
  icon: string;
  phase?: RecordPhase;
  mainCategory: "skaters" | "goalies" | "gms" | "teams" | "trophies" | "games";
  records: RecordSection[];
};

export type LeagueRecordsData = {
  league: "NHL" | "AHL";
  cupName: string;
  phase: RecordPhase;
  category: MainRecordCategory;
  groups: RecordCategoryGroup[];
  isLiveOrPreview?: boolean;
};

function parseSeasonYear(s: string): number {
  const m = s.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : 2026;
}

function resolveTeams(teamIds: Set<number>, teamById: Map<number, any>): {
  teams?: LeaderTeamInfo[];
  teamCode?: string | null;
  teamLogo?: string | null;
  teamSlug?: string | null;
} {
  const list = [...teamIds]
    .map((id) => teamById.get(id))
    .filter(Boolean) as Array<{ code: string; slug?: string | null; logoUrl?: string | null }>;
  if (!list.length) return {};
  if (list.length === 1) {
    return {
      teamCode: list[0].code,
      teamLogo: list[0].logoUrl,
      teamSlug: list[0].slug,
    };
  }
  return {
    teams: list.map((t) => ({ code: t.code, slug: t.slug, logoUrl: t.logoUrl })),
    teamCode: list.map((t) => t.code).join(" / "),
    teamLogo: null,
    teamSlug: null,
  };
}

function calculateAge(
  birthDateStr: string | null | undefined,
  targetDate: Date | null,
  fallbackAge?: number | null,
  lang: Lang = "en"
): { years: number; days: number; formatted: string } | null {
  if (birthDateStr) {
    const birth = new Date(birthDateStr);
    if (!isNaN(birth.getTime())) {
      const target = targetDate ? new Date(targetDate) : new Date();
      let years = target.getFullYear() - birth.getFullYear();
      let m = target.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && target.getDate() < birth.getDate())) {
        years--;
      }
      const lastBirthday = new Date(birth);
      lastBirthday.setFullYear(birth.getFullYear() + years);
      const diffMs = target.getTime() - lastBirthday.getTime();
      const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const unitY = lang === "cs" ? "r" : lang === "de" ? "J" : lang === "ru" ? "г" : "y";
      const unitD = lang === "cs" ? "d" : lang === "de" ? "T" : lang === "ru" ? "д" : "d";
      return { years, days, formatted: `${years}${unitY} ${days}${unitD}` };
    }
  }
  if (fallbackAge != null && fallbackAge > 0) {
    const unitYears = lang === "cs" ? "rokov" : lang === "de" ? "Jahre" : lang === "ru" ? "лет" : "years old";
    return { years: fallbackAge, days: 0, formatted: `${fallbackAge} ${unitYears}` };
  }
  return null;
}

export function formatRecordDate(date: Date, lang: Lang): string {
  const loc = lang === "cs" ? "sk-SK" : lang === "de" ? "de-DE" : lang === "ru" ? "ru-RU" : "en-US";
  return date.toLocaleDateString(loc);
}

export function getRecordBadge(key: "regular" | "playoffs" | "pre" | "history" | "game" | "season" | "age", lang: Lang): string {
  const map: Record<string, Record<Lang, string>> = {
    regular: { en: "RS", cs: "ZČ", de: "HR", ru: "РС" },
    playoffs: { en: "Playoffs", cs: "Play-off", de: "Playoffs", ru: "Плей-офф" },
    pre: { en: "Pre-season", cs: "Príprava", de: "Pre-season", ru: "Предсезонка" },
    history: { en: "History", cs: "História", de: "Historie", ru: "История" },
    game: { en: "Game", cs: "Zápas", de: "Spiel", ru: "Матч" },
    season: { en: "Season", cs: "Sezóna", de: "Saison", ru: "Сезон" },
    age: { en: "Age", cs: "Vek", de: "Alter", ru: "Возраст" },
  };
  return map[key]?.[lang] ?? map[key]?.en ?? key;
}

export function getGroupTitle(id: string, lang: Lang, cupName: string): string {
  const map: Record<string, Record<Lang, string>> = {
    "gm-records": {
      en: "General Manager Records (GM)",
      cs: "Manažérske rekordy (GM)",
      de: "General-Manager-Rekorde (GM)",
      ru: "Рекорды генеральных менеджеров (GM)",
    },
    "career-skaters": {
      en: "Individual Career Records — Skaters (RS)",
      cs: "Individuálne kariérne rekordy — Korčuliari (ZČ)",
      de: "Individuelle Karriererekorde — Feldspieler (HR)",
      ru: "Индивидуальные рекорды карьеры — Полевые игроки (РС)",
    },
    "season-skaters": {
      en: "Individual Single-Season Records — Skaters (RS)",
      cs: "Individuálne sezónne rekordy — Korčuliari (ZČ)",
      de: "Individuelle Saisonrekorde — Feldspieler (HR)",
      ru: "Индивидуальные рекорды сезона — Полевые игроки (РС)",
    },
    "game-skaters": {
      en: "Individual Single-Game Records — Skaters (RS)",
      cs: "Individuálne zápasové rekordy — Korčuliari (ZČ)",
      de: "Individuelle Spielrekorde — Feldspieler (HR)",
      ru: "Индивидуальные рекорды матча — Полевые игроки (РС)",
    },
    "rookie-records": {
      en: "Individual Rookie Season Records (RS)",
      cs: "Individuálne sezónne rekordy nováčikov (ZČ)",
      de: "Individuelle Rookie-Saisonrekorde (HR)",
      ru: "Индивидуальные рекорды новичков в сезоне (РС)",
    },
    "playoff-career-skaters": {
      en: "Career Playoff Records — Skaters",
      cs: "Kariérne rekordy v play-off — Korčuliari",
      de: "Karriere-Playoff-Rekorde — Feldspieler",
      ru: "Рекорды плей-офф в карьере — Полевые игроки",
    },
    "playoff-season-skaters": {
      en: "Single-Playoff Records — Skaters",
      cs: "Rekordy v jednom play-off — Korčuliari",
      de: "Rekorde in einer Playoff-Saison — Feldspieler",
      ru: "Рекорды одного плей-офф — Полевые игроки",
    },
    "playoff-game-skaters": {
      en: "Single-Game Playoff Records — Skaters",
      cs: "Zápasové rekordy v play-off — Korčuliari",
      de: "Einzelspiel-Playoff-Rekorde — Feldspieler",
      ru: "Рекорды одного матча в плей-офф — Полевые игроки",
    },
    "career-goalies": {
      en: "Individual Career Records — Goalies (RS)",
      cs: "Individuálne kariérne rekordy — Brankári (ZČ)",
      de: "Individuelle Karriererekorde — Torhüter (HR)",
      ru: "Индивидуальные рекорды карьеры — Вратари (РС)",
    },
    "championships": {
      en: `${cupName} & Team Titles`,
      cs: `${cupName} & Tímové tituly`,
      de: `${cupName} & Team-Titel`,
      ru: `${cupName} и командные титулы`,
    },
    "team-seasons": {
      en: "Team Season & Streak Records (RS)",
      cs: "Tímové sezónne a sériové rekordy (ZČ)",
      de: "Team-Saison- und Serienrekorde (HR)",
      ru: "Командные сезонные и серийные рекорды (РС)",
    },
    "trophies": {
      en: "Trophies & Awards",
      cs: "Trofeje a ocenenia",
      de: "Trophäen & Auszeichnungen",
      ru: "Трофеи и награды",
    },
    "attendance-games": {
      en: "Attendance & Game Records (RS / All)",
      cs: "Návštevnosť a zápasové rekordy (ZČ / Všetko)",
      de: "Zuschauer- und Spielrekorde (HR / Alle)",
      ru: "Посещаемость и рекорды матчей (РС / Все)",
    },
    "age-records": {
      en: "Age Records (League Rosters)",
      cs: "Vekové rekordy (Súpisky ligy)",
      de: "Altersrekorde (Ligakader)",
      ru: "Возрастные рекорды (Составы лиги)",
    },
    "pre-season-group": {
      en: "Pre-season Exhibition Records",
      cs: "Prípravné zápasy (Pre-season rekordy)",
      de: "Vorbereitungsspiele (Pre-season Rekorde)",
      ru: "Предсезонные матчи (Рекорды предсезонки)",
    },
    "pre-skaters": {
      en: "Pre-season Exhibition Records (Skaters)",
      cs: "Prípravné zápasy (Korčuliari)",
      de: "Vorbereitungsspiele (Feldspieler)",
      ru: "Предсезонные матчи (Полевые игроки)",
    },
    "pre-goalies": {
      en: "Pre-season Exhibition Records (Goalies)",
      cs: "Prípravné zápasy (Brankári)",
      de: "Vorbereitungsspiele (Torhüter)",
      ru: "Предсезонные матчи (Вратари)",
    },
    "pre-teams": {
      en: "Pre-season Exhibition Records (Teams)",
      cs: "Prípravné zápasy (Tímy)",
      de: "Vorbereitungsspiele (Teams)",
      ru: "Предсезонные матчи (Команды)",
    },
  };
  return map[id]?.[lang] ?? map[id]?.en ?? id;
}

export function getSectionTitle(id: string, lang: Lang, league: string, cupName: string): string {
  const map: Record<string, Record<Lang, string>> = {
    "gm-seasons-total": {
      en: `Most seasons in u${league} (as GM)`,
      cs: `Najviac odohraných sezón v u${league} (ako GM)`,
      de: `Meiste gespielte Saisons in u${league} (als GM)`,
      ru: `Больше всего сезонов в u${league} (как GM)`,
    },
    "gm-seasons-one-team": {
      en: `Most seasons in u${league} with one team`,
      cs: `Najviac odohraných sezón v u${league} u jedného tímu`,
      de: `Meiste Saisons in u${league} bei einem Team`,
      ru: `Больше всего сезонов в u${league} в одной команде`,
    },
    "gm-seasons-streak": {
      en: `Longest consecutive season streak in u${league}`,
      cs: `Najviac odohraných sezón v u${league} v rade`,
      de: `Meiste Saisons in Folge in u${league}`,
      ru: `Самая длинная серия сезонов подряд в u${league}`,
    },
    "gm-cups": {
      en: `Most ${cupName} titles won (as GM)`,
      cs: `Počet vyhraných ${cupName}ov (ako GM)`,
      de: `Gewonnene ${cupName}-Titel (als GM)`,
      ru: `Количество завоеванных ${cupName} (как GM)`,
    },
    "career-gp": {
      en: "Most career games played",
      cs: "Najviac odohraných zápasov v kariére",
      de: "Meiste Karrierespiele",
      ru: "Больше всего матчей в карьере",
    },
    "career-goals": {
      en: "Most career goals",
      cs: "Najviac gólov v kariére",
      de: "Meiste Karrieretore",
      ru: "Больше всего голов в карьере",
    },
    "career-assists": {
      en: "Most career assists",
      cs: "Najviac asistencií v kariére",
      de: "Meiste Karriere-Assists",
      ru: "Больше всего передач в карьере",
    },
    "career-points": {
      en: "Most career points",
      cs: "Najviac bodov v kariére",
      de: "Meiste Karrierepunkte",
      ru: "Больше всего очков в карьере",
    },
    "career-pim": {
      en: "Most career penalty minutes",
      cs: "Najviac trestných minút v kariére",
      de: "Meiste Karrierestrafminuten",
      ru: "Больше всего штрафных минут в карьере",
    },
    "career-plus-minus-best": {
      en: "Best career +/-",
      cs: "Najlepší +/- v kariére",
      de: "Beste Karriere-+/-",
      ru: "Лучший +/- в карьере",
    },
    "career-plus-minus-worst": {
      en: "Worst career +/-",
      cs: "Najhorší +/- v kariére",
      de: "Schlechteste Karriere-+/-",
      ru: "Худший +/- в карьере",
    },
    "career-pp-goals": {
      en: "Most career power-play goals (PPG)",
      cs: "Najviac presilovkových gólov v kariére (PPG)",
      de: "Meiste Karriere-Überzahltore (PPG)",
      ru: "Больше всего голов в большинстве в карьере (PPG)",
    },
    "career-pp-assists": {
      en: "Most career power-play assists (PPA)",
      cs: "Najviac presilovkových asistencií v kariére (PPA)",
      de: "Meiste Karriere-Überzahl-Assists (PPA)",
      ru: "Больше всего передач в большинстве в карьере (PPA)",
    },
    "career-pp-points": {
      en: "Most career power-play points (PPP)",
      cs: "Najviac presilovkových bodov v kariére (PPP)",
      de: "Meiste Karriere-Überzahlpunkte (PPP)",
      ru: "Больше всего очков в большинстве в карьере (PPP)",
    },
    "career-sh-goals": {
      en: "Most career shorthanded goals (SHG)",
      cs: "Najviac oslabovkových gólov v kariére (SHG)",
      de: "Meiste Karriere-Unterzahltore (SHG)",
      ru: "Больше всего голов в меньшинстве в карьере (SHG)",
    },
    "career-sh-assists": {
      en: "Most career shorthanded assists (SHA)",
      cs: "Najviac oslabovkových asistencií v kariére (SHA)",
      de: "Meiste Karriere-Unterzahl-Assists (SHA)",
      ru: "Больше всего передач в меньшинстве в карьере (SHA)",
    },
    "career-sh-points": {
      en: "Most career shorthanded points (SHP)",
      cs: "Najviac oslabovkových bodov v kariére (SHP)",
      de: "Meiste Karriere-Unterzahlpunkte (SHP)",
      ru: "Больше всего очков в меньшинстве в карьере (SHP)",
    },
    "career-ironman": {
      en: "Longest consecutive games played streak (Ironman)",
      cs: "Najviac odohraných zápasov v rade (Ironman streak)",
      de: "Längste Serie gespielter Spiele in Folge (Ironman)",
      ru: "Самая длинная серия сыгранных матчей подряд (Ironman)",
    },
    "career-goal-streak": {
      en: "Longest consecutive goal-scoring streak",
      cs: "Najdlhšia gólová séria v rade (zápasy s gólom)",
      de: "Längste Torserie in Folge",
      ru: "Самая длинная голевая серия подряд",
    },
    "career-assist-streak": {
      en: "Longest consecutive assist streak",
      cs: "Najdlhšia asistenčná séria v rade (zápasy s asistenciou)",
      de: "Längste Assist-Serie in Folge",
      ru: "Самая длинная ассистентская серия подряд",
    },
    "career-point-streak": {
      en: "Longest consecutive point-scoring streak",
      cs: "Najdlhšia bodová séria v rade (zápasy s bodom)",
      de: "Längste Punkteserie in Folge",
      ru: "Самая длинная результативная серия подряд",
    },
    "career-youngest-debut": {
      en: "Youngest player at game debut",
      cs: "Najmladší hráč pri debute v zápase",
      de: "Jüngster Spieler beim Spieldebüt",
      ru: "Самый молодой игрок при дебюте в матче",
    },
    "career-oldest-appearance": {
      en: "Oldest player in a game",
      cs: "Najstarší hráč v zápase",
      de: "Ältester Spieler in einem Spiel",
      ru: "Самый возрастной игрок в матче",
    },
    "season-goals": {
      en: "Most goals in a single season",
      cs: "Najviac gólov v jednej sezóne",
      de: "Meiste Tore in einer Saison",
      ru: "Больше всего голов за один сезон",
    },
    "season-assists": {
      en: "Most assists in a single season",
      cs: "Najviac asistencií v jednej sezóne",
      de: "Meiste Assists in einer Saison",
      ru: "Больше всего передач за один сезон",
    },
    "season-points": {
      en: "Most points in a single season",
      cs: "Najviac bodov v jednej sezóne",
      de: "Meiste Punkte in einer Saison",
      ru: "Больше всего очков за один сезон",
    },
    "season-pim": {
      en: "Most penalty minutes in a single season",
      cs: "Najviac trestných minút v jednej sezóne",
      de: "Meiste Strafminuten in einer Saison",
      ru: "Больше всего штрафных минут за один сезон",
    },
    "season-plus-minus-best": {
      en: "Best +/- in a single season",
      cs: "Najlepší +/- v jednej sezóne",
      de: "Beste +/- in einer Saison",
      ru: "Лучший +/- за один сезон",
    },
    "season-plus-minus-worst": {
      en: "Worst +/- in a single season",
      cs: "Najhorší +/- v jednej sezóne",
      de: "Schlechteste +/- in einer Saison",
      ru: "Худший +/- за один сезон",
    },
    "season-pp-goals": {
      en: "Most power-play goals in a season (PPG)",
      cs: "Najviac presilovkových gólov v jednej sezóne (PPG)",
      de: "Meiste Überzahltore in einer Saison (PPG)",
      ru: "Больше всего голов в большинстве за сезон (PPG)",
    },
    "season-pp-assists": {
      en: "Most power-play assists in a season (PPA)",
      cs: "Najviac presilovkových asistencií v jednej sezóne (PPA)",
      de: "Meiste Überzahl-Assists in einer Saison (PPA)",
      ru: "Больше всего передач в большинстве за сезон (PPA)",
    },
    "season-pp-points": {
      en: "Most power-play points in a season (PPP)",
      cs: "Najviac presilovkových bodov v jednej sezóne (PPP)",
      de: "Meiste Überzahlpunkte in einer Saison (PPP)",
      ru: "Больше всего очков в большинстве за сезон (PPP)",
    },
    "season-sh-goals": {
      en: "Most shorthanded goals in a season (SHG)",
      cs: "Najviac oslabovkových gólov v jednej sezóne (SHG)",
      de: "Meiste Unterzahltore in einer Saison (SHG)",
      ru: "Больше всего голов в меньшинстве за сезон (SHG)",
    },
    "season-sh-assists": {
      en: "Most shorthanded assists in a season (SHA)",
      cs: "Najviac oslabovkových asistencií v jednej sezóne (SHA)",
      de: "Meiste Unterzahl-Assists in einer Saison (SHA)",
      ru: "Больше всего передач в меньшинстве за сезон (SHA)",
    },
    "season-sh-points": {
      en: "Most shorthanded points in a season (SHP)",
      cs: "Najviac oslabovkových bodov v jednej sezóne (SHP)",
      de: "Meiste Unterzahlpunkte in einer Saison (SHP)",
      ru: "Больше всего очков в меньшинстве за сезон (SHP)",
    },
    "rookie-season-goals": {
      en: "Most goals in a rookie season",
      cs: "Najviac gólov v nováčikovskej sezóne",
      de: "Meiste Tore in der Rookie-Saison",
      ru: "Больше всего голов в сезоне новичка",
    },
    "rookie-season-assists": {
      en: "Most assists in a rookie season",
      cs: "Najviac asistencií v nováčikovskej sezóne",
      de: "Meiste Assists in der Rookie-Saison",
      ru: "Больше всего передач в сезоне новичка",
    },
    "rookie-season-points": {
      en: "Most points in a rookie season",
      cs: "Najviac bodov v nováčikovskej sezóne",
      de: "Meiste Punkte in der Rookie-Saison",
      ru: "Больше всего очков в сезоне новичка",
    },
    "rookie-season-pim": {
      en: "Most penalty minutes in a rookie season",
      cs: "Najviac trestných minút v nováčikovskej sezóne",
      de: "Meiste Strafminuten in der Rookie-Saison",
      ru: "Больше всего штрафных минут в сезоне новичка",
    },
    "rookie-season-plus-minus-best": {
      en: "Best +/- in a rookie season",
      cs: "Najlepší +/- v nováčikovskej sezóne",
      de: "Beste +/- in der Rookie-Saison",
      ru: "Лучший +/- в сезоне новичка",
    },
    "rookie-season-plus-minus-worst": {
      en: "Worst +/- in a rookie season",
      cs: "Najhorší +/- v nováčikovskej sezóne",
      de: "Schlechteste +/- in der Rookie-Saison",
      ru: "Худший +/- в сезоне новичка",
    },
    "game-goals": {
      en: "Most goals in a single game",
      cs: "Najviac gólov v jednom zápase",
      de: "Meiste Tore in einem Spiel",
      ru: "Больше всего голов в одном матче",
    },
    "game-assists": {
      en: "Most assists in a single game",
      cs: "Najviac asistencií v jednom zápase",
      de: "Meiste Assists in einem Spiel",
      ru: "Больше всего передач в одном матче",
    },
    "game-points": {
      en: "Most points in a single game",
      cs: "Najviac bodov v jednom zápase",
      de: "Meiste Punkte in einem Spiel",
      ru: "Больше всего очков в одном матче",
    },
    "game-pim": {
      en: "Most penalty minutes in a single game",
      cs: "Najviac trestných minút v jednom zápase",
      de: "Meiste Strafminuten in einem Spiel",
      ru: "Больше всего штрафных минут в одном матче",
    },
    "game-plus-minus-best": {
      en: "Best +/- in a single game",
      cs: "Najlepší +/- v jednom zápase",
      de: "Beste +/- in einem Spiel",
      ru: "Лучший +/- в одном матче",
    },
    "game-plus-minus-worst": {
      en: "Worst +/- in a single game",
      cs: "Najhorší +/- v jednom zápase",
      de: "Schlechteste +/- in einem Spiel",
      ru: "Худший +/- в одном матче",
    },
    "game-pp-goals": {
      en: "Most power-play goals in a game (PPG)",
      cs: "Najviac presilovkových gólov v jednom zápase (PPG)",
      de: "Meiste Überzahltore in einem Spiel (PPG)",
      ru: "Больше всего голов в большинстве в матче (PPG)",
    },
    "game-pp-assists": {
      en: "Most power-play assists in a game (PPA)",
      cs: "Najviac presilovkových asistencií v jednom zápase (PPA)",
      de: "Meiste Überzahl-Assists in einem Spiel (PPA)",
      ru: "Больше всего передач в большинстве в матче (PPA)",
    },
    "game-pp-points": {
      en: "Most power-play points in a game (PPP)",
      cs: "Najviac presilovkových bodov v jednom zápase (PPP)",
      de: "Meiste Überzahlpunkte in einem Spiel (PPP)",
      ru: "Больше всего очков в большинстве в матче (PPP)",
    },
    "game-sh-goals": {
      en: "Most shorthanded goals in a game (SHG)",
      cs: "Najviac oslabovkových gólov v jednom zápase (SHG)",
      de: "Meiste Unterzahltore in einem Spiel (SHG)",
      ru: "Больше всего голов в меньшинстве в матче (SHG)",
    },
    "game-sh-assists": {
      en: "Most shorthanded assists in a game (SHA)",
      cs: "Najviac oslabovkových asistencií v jednom zápase (SHA)",
      de: "Meiste Unterzahl-Assists in einem Spiel (SHA)",
      ru: "Больше всего передач в меньшинстве в матче (SHA)",
    },
    "game-sh-points": {
      en: "Most shorthanded points in a game (SHP)",
      cs: "Najviac oslabovkových bodov v jednom zápase (SHP)",
      de: "Meiste Unterzahlpunkte in einem Spiel (SHP)",
      ru: "Больше всего очков в меньшинстве в матче (SHP)",
    },
    "playoff-career-gp": {
      en: "Most career playoff games played",
      cs: "Najviac odohraných zápasov v play-off v kariére",
      de: "Meiste Playoff-Spiele in der Karriere",
      ru: "Больше всего матчей в плей-офф в карьере",
    },
    "playoff-career-goals": {
      en: "Most career playoff goals",
      cs: "Najviac gólov v play-off v kariére",
      de: "Meiste Playoff-Tore in der Karriere",
      ru: "Больше всего голов в плей-офф в карьере",
    },
    "playoff-career-assists": {
      en: "Most career playoff assists",
      cs: "Najviac asistencií v play-off v kariére",
      de: "Meiste Playoff-Assists in der Karriere",
      ru: "Больше всего передач в плей-офф в карьере",
    },
    "playoff-career-points": {
      en: "Most career playoff points",
      cs: "Najviac bodov v play-off v kariére",
      de: "Meiste Playoff-Punkte in der Karriere",
      ru: "Больше всего очков в плей-офф в карьере",
    },
    "playoff-career-pim": {
      en: "Most career playoff penalty minutes",
      cs: "Najviac trestných minút v play-off v kariére",
      de: "Meiste Playoff-Strafminuten in der Karriere",
      ru: "Больше всего штрафных минут в плей-офф в карьере",
    },
    "playoff-career-plus-minus-best": {
      en: "Best career playoff +/-",
      cs: "Najlepší +/- v play-off v kariére",
      de: "Beste Playoff-+/- in der Karriere",
      ru: "Лучший +/- в плей-офф в карьере",
    },
    "playoff-career-plus-minus-worst": {
      en: "Worst career playoff +/-",
      cs: "Najhorší +/- v play-off v kariére",
      de: "Schlechteste Playoff-+/- in der Karriere",
      ru: "Худший +/- в плей-офф в карьере",
    },
    "playoff-season-goals": {
      en: "Most goals in a single playoff season",
      cs: "Najviac gólov v jednom play-off",
      de: "Meiste Tore in einer Playoff-Saison",
      ru: "Больше всего голов в одном плей-офф",
    },
    "playoff-season-assists": {
      en: "Most assists in a single playoff season",
      cs: "Najviac asistencií v jednom play-off",
      de: "Meiste Assists in einer Playoff-Saison",
      ru: "Больше всего передач в одном плей-офф",
    },
    "playoff-season-points": {
      en: "Most points in a single playoff season",
      cs: "Najviac bodov v jednom play-off",
      de: "Meiste Punkte in einer Playoff-Saison",
      ru: "Больше всего очков в одном плей-офф",
    },
    "playoff-season-pim": {
      en: "Most penalty minutes in a single playoff season",
      cs: "Najviac trestných minút v jednom play-off",
      de: "Meiste Strafminuten in einer Playoff-Saison",
      ru: "Больше всего штрафных минут в одном плей-офф",
    },
    "playoff-season-plus-minus-best": {
      en: "Best +/- in a single playoff season",
      cs: "Najlepší +/- v jednom play-off",
      de: "Beste +/- in einer Playoff-Saison",
      ru: "Лучший +/- в одном плей-офф",
    },
    "playoff-season-plus-minus-worst": {
      en: "Worst +/- in a single playoff season",
      cs: "Najhorší +/- v jednom play-off",
      de: "Schlechteste +/- in einer Playoff-Saison",
      ru: "Худший +/- в одном плей-офф",
    },
    "playoff-game-goals": {
      en: "Most goals in a playoff game",
      cs: "Najviac gólov v zápase play-off",
      de: "Meiste Tore in einem Playoff-Spiel",
      ru: "Больше всего голов в матче плей-офф",
    },
    "playoff-game-assists": {
      en: "Most assists in a playoff game",
      cs: "Najviac asistencií v zápase play-off",
      de: "Meiste Assists in einem Playoff-Spiel",
      ru: "Больше всего передач в матче плей-офф",
    },
    "playoff-game-points": {
      en: "Most points in a playoff game",
      cs: "Najviac bodov v zápase play-off",
      de: "Meiste Punkte in einem Playoff-Spiel",
      ru: "Больше всего очков в матче плей-офф",
    },
    "playoff-game-pim": {
      en: "Most penalty minutes in a playoff game",
      cs: "Najviac trestných minút v zápase play-off",
      de: "Meiste Strafminuten in einem Playoff-Spiel",
      ru: "Больше всего штрафных минут в матче плей-офф",
    },
    "playoff-game-plus-minus-best": {
      en: "Best +/- in a playoff game",
      cs: "Najlepší +/- v zápase play-off",
      de: "Beste +/- in einem Playoff-Spiel",
      ru: "Лучший +/- в матче плей-офф",
    },
    "playoff-game-plus-minus-worst": {
      en: "Worst +/- in a playoff game",
      cs: "Najhorší +/- v zápase play-off",
      de: "Schlechteste +/- in einem Playoff-Spiel",
      ru: "Худший +/- в матче плей-офф",
    },
    "career-wins": {
      en: "Most career wins (Goalies)",
      cs: "Najviac výhier v kariére (brankár)",
      de: "Meiste Karrieresiege (Torhüter)",
      ru: "Больше всего побед в карьере (Вратари)",
    },
    "career-steals": {
      en: "Most career stolen games (steals)",
      cs: "Najviac ukradnutých zápasov (steals) v kariére",
      de: "Meiste gestohlene Spiele (Steals) in der Karriere",
      ru: "Больше всего украденных матчей (steals) в карьере",
    },
    "career-gsax": {
      en: "Best career GSAx (Goals Saved Above Expected)",
      cs: "Najlepší GSAx (Goals Saved Above Expected) v kariére",
      de: "Bestes Karriere-GSAx (Goals Saved Above Expected)",
      ru: "Лучший GSAx за карьеру (Goals Saved Above Expected)",
    },
    "career-shutouts": {
      en: "Most career shutouts",
      cs: "Najviac čistých kont v kariére",
      de: "Meiste Karriere-Shutouts",
      ru: "Больше всего сухих матчей за карьеру",
    },
    "team-cups": {
      en: `Most ${cupName} titles won (as team)`,
      cs: `Počet vyhraných ${cupName}ov (ako tím)`,
      de: `Gewonnene ${cupName}-Titel (als Team)`,
      ru: `Количество завоеванных ${cupName} (команда)`,
    },
    "skater-cups": {
      en: `Most ${cupName} titles won (Skater)`,
      cs: `Počet vyhraných ${cupName}ov (hráč / korčuliar)`,
      de: `Gewonnene ${cupName}-Titel (Feldspieler)`,
      ru: `Количество завоеванных ${cupName} (полевой игрок)`,
    },
    "goalie-cups": {
      en: `Most ${cupName} titles won (Goalie)`,
      cs: `Počet vyhraných ${cupName}ov (brankár)`,
      de: `Gewonnene ${cupName}-Titel (Torhüter)`,
      ru: `Количество завоеванных ${cupName} (вратарь)`,
    },
    "playoff-career-wins": {
      en: "Most career playoff wins (Goalies)",
      cs: "Najviac výhier brankára v play-off",
      de: "Meiste Playoff-Siege (Torhüter)",
      ru: "Больше всего побед в плей-офф (Вратари)",
    },
    "team-points-season": {
      en: "Most points in a single season",
      cs: "Najviac získaných bodov v jednej sezóne",
      de: "Meiste Punkte in einer Saison",
      ru: "Больше всего очков за один сезон",
    },
    "team-losses-season": {
      en: "Most losses in a single season (L + OTL/SOL)",
      cs: "Najviac prehraných zápasov v jednej sezóne (L + OTL/SOL)",
      de: "Meiste Niederlagen in einer Saison (L + OTL/SOL)",
      ru: "Больше всего поражений за один сезон (L + OTL/SOL)",
    },
    "team-win-streak": {
      en: "Longest winning streak",
      cs: "Najviac vyhraných zápasov v rade (Winning streak)",
      de: "Längste Siegesserie in Folge",
      ru: "Самая длинная победная серия подряд",
    },
    "team-lose-streak": {
      en: "Longest losing streak",
      cs: "Najviac prehraných zápasov v rade (Losing streak)",
      de: "Längste Niederlagenserie in Folge",
      ru: "Самая длинная серия поражений подряд",
    },
    "team-gf-season": {
      en: "Most goals scored in a single season",
      cs: "Najviac strelených gólov v jednej sezóne",
      de: "Meiste erzielte Tore in einer Saison",
      ru: "Больше всего забитых голов за один сезон",
    },
    "team-ga-season": {
      en: "Most goals conceded in a single season",
      cs: "Najviac inkasovaných gólov v jednej sezóne",
      de: "Meiste Gegentore in einer Saison",
      ru: "Больше всего пропущенных голов за один сезон",
    },
    "team-pim-season": {
      en: "Most penalty minutes in a single season",
      cs: "Najviac trestných minút v jednej sezóne",
      de: "Meiste Strafminuten in einer Saison",
      ru: "Больше всего штрафных минут за один сезон",
    },
    "highest-attendance": {
      en: "Highest single-game attendance",
      cs: "Najvyššia návštevnosť v jednom zápase",
      de: "Höchste Zuschauerzahl in einem Spiel",
      ru: "Наивысшая посещаемость в одном матче",
    },
    "lowest-attendance": {
      en: "Lowest single-game attendance",
      cs: "Najnižšia návštevnosť v jednom zápase",
      de: "Niedrigste Zuschauerzahl in einem Spiel",
      ru: "Наименьшая посещаемость в одном матче",
    },
    "highest-avg-attendance": {
      en: "Highest average attendance in a season",
      cs: "Najvyššia priemerná návštevnosť v jednej sezóne",
      de: "Höchster Zuschauerschnitt in einer Saison",
      ru: "Наивысшая средняя посещаемость за сезон",
    },
    "lowest-avg-attendance": {
      en: "Lowest average attendance in a season",
      cs: "Najnižšia priemerná návštevnosť v jednej sezóne",
      de: "Niedrigster Zuschauerschnitt in einer Saison",
      ru: "Наименьшая средняя посещаемость за сезон",
    },
    "highest-scoring-game": {
      en: "Highest scoring game (Most goals in a game)",
      cs: "Highest scoring game (Najviac gólov v zápase)",
      de: "Torreichstes Spiel (Meiste Tore)",
      ru: "Самый результативный матч (Больше всего голов)",
    },
    "largest-victory": {
      en: "Largest margin of victory",
      cs: "Najvyššie víťazstvo (Najväčší gólový rozdiel)",
      de: "Höchster Sieg (Größte Tordifferenz)",
      ru: "Самая крупная победа (Наибольшая разница голов)",
    },
    "youngest-player": {
      en: `Youngest active player in u${league}`,
      cs: `Najmladší hráč v lige u${league}`,
      de: `Jüngster aktiver Spieler in der u${league}`,
      ru: `Самый молодой активный игрок в u${league}`,
    },
    "oldest-player": {
      en: `Oldest active player in u${league}`,
      cs: `Najstarší hráč v lige u${league}`,
      de: `Ältester aktiver Spieler in der u${league}`,
      ru: `Самый возрастной активный игрок в u${league}`,
    },
    "pre-best-team": {
      en: "Best record in pre-season",
      cs: "Najlepšia bilancia v príprave (Pre-season)",
      de: "Beste Vorbereitungsbilanz (Pre-season)",
      ru: "Лучший результат в предсезонке",
    },
    "pre-top-scorer": {
      en: "Pre-season scoring leader",
      cs: "Najproduktívnejší hráč v príprave (Top Scorer)",
      de: "Topscorer der Vorbereitung",
      ru: "Лучший бомбардир предсезонки",
    },
    "pre-goals": {
      en: "Pre-season top goalscorer",
      cs: "Najlepší strelec v príprave (Góly)",
      de: "Bester Torschütze der Vorbereitung",
      ru: "Лучший снайпер предсезонки",
    },
    "pre-assists": {
      en: "Most assists in pre-season",
      cs: "Najviac asistencií v príprave",
      de: "Meiste Assists in der Vorbereitung",
      ru: "Больше всего передач в предсезонке",
    },
    "pre-single-game-pts": {
      en: "Most points in a single pre-season game",
      cs: "Najviac bodov v jednom zápase prípravy",
      de: "Meiste Punkte in einem Vorbereitungsspiel",
      ru: "Больше всего очков в одном матче предсезонки",
    },
    "pre-goalie-saves": {
      en: "Most goalie saves in pre-season",
      cs: "Najviac zákrokov brankára v príprave",
      de: "Meiste Torhüter-Paraden in der Vorbereitung",
      ru: "Больше всего сейвов вратаря в предсезонке",
    },
  };
  return map[id]?.[lang] ?? map[id]?.en ?? id;
}

export async function getLeagueRecords(
  league: "NHL" | "AHL" = "NHL",
  phase: RecordPhase = "all",
  category: MainRecordCategory = "all",
  lang: Lang = "en"
): Promise<LeagueRecordsData> {
  const isAhl = league === "AHL";
  const cupName = isAhl ? "Calder Cup" : "Stanley Cup";

  // 1. Fetch base teams & lookups
  const allTeams = await prisma.team.findMany({
    where: isAhl ? { isAffiliate: true } : { isAffiliate: false },
    select: {
      id: true,
      name: true,
      code: true,
      slug: true,
      logoUrl: true,
      gm: true,
      gmFirstName: true,
      gmLastName: true,
      gmNickname: true,
      passwordHash: true,
      arena: true,
      capacity: true,
      parentTeamId: true,
      parentTeam: {
        select: {
          id: true,
          name: true,
          code: true,
          slug: true,
          gm: true,
          gmFirstName: true,
          gmLastName: true,
          gmNickname: true,
          passwordHash: true,
        },
      },
    },
  });

  const teamById = new Map<number, (typeof allTeams)[number]>();
  allTeams.forEach((t) => teamById.set(t.id, t));

  const getTeamGm = (teamId: number | null | undefined): string => {
    if (!teamId) return "—";
    const tm = teamById.get(teamId);
    if (!tm) return "—";
    return teamManagerLabel(tm.parentTeam ? tm.parentTeam : tm);
  };

  // 2. Fetch Archived / Historical Record Data
  const [seasonRecords, seasonAwards, archivedSkaters, archivedGoalies, archivedTeams, allPlayersWithBirth] = await Promise.all([
    prisma.seasonRecord.findMany({ where: { league } }),
    prisma.seasonAward.findMany({ where: { league } }),
    prisma.playerSeasonStat.findMany({ where: { league } }),
    prisma.goalieSeasonStat.findMany({ where: { league } }),
    prisma.teamSeasonStat.findMany({ where: { league } }),
    prisma.player.findMany({
      where: { rosterType: isAhl ? "AHL" : "NHL" },
      select: { id: true, name: true, slug: true, photoUrl: true, position: true, isGoalie: true, birthDate: true, age: true, teamId: true, overall: true },
    }),
  ]);

  // 3. Fetch All Games (pre-season, regular season and playoffs)
  const allFinalGames = await prisma.game.findMany({
    where: { league, status: "FINAL" },
    select: {
      id: true,
      season: true,
      round: true,
      seriesId: true,
      gameDate: true,
      playedAt: true,
      homeTeamId: true,
      awayTeamId: true,
      homeGoals: true,
      awayGoals: true,
      winnerTeamId: true,
      attendance: true,
      endedIn: true,
      goalEvents: { select: { teamId: true } },
    },
    orderBy: [
      { season: "asc" },
      { round: "asc" },
      { gameDate: "asc" },
      { id: "asc" },
    ],
  });

  const preGames = allFinalGames.filter((g) => g.season.endsWith("-PRE") || g.season === PRE_SEASON);
  const regularGames = allFinalGames.filter((g) => !g.season.endsWith("-PRE") && g.season !== PRE_SEASON && g.seriesId == null);
  const playoffGames = allFinalGames.filter((g) => g.seriesId != null);

  const allGameIds = allFinalGames.map((g) => g.id);

  // 4. Fetch Skater & Goalie Game Stats for all played games
  const [allSkaterStats, allGoalieStats] = await Promise.all([
    allGameIds.length
      ? prisma.playerGameStat.findMany({
          where: { gameId: { in: allGameIds } },
          select: {
            playerId: true,
            teamId: true,
            gameId: true,
            goals: true,
            assists: true,
            points: true,
            pim: true,
            plusMinus: true,
            ppGoals: true,
            ppAssists: true,
            shGoals: true,
            shAssists: true,
            shots: true,
            hits: true,
            blocks: true,
            game: { select: { id: true, gameDate: true, playedAt: true, season: true, seriesId: true, round: true, league: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true } },
          },
        })
      : Promise.resolve([]),
    allGameIds.length
      ? prisma.goalieGameStat.findMany({
          where: { gameId: { in: allGameIds }, started: true },
          select: {
            playerId: true,
            teamId: true,
            gameId: true,
            shotsAgainst: true,
            saves: true,
            goalsAgainst: true,
            decision: true,
            xga: true,
            game: { select: { id: true, gameDate: true, playedAt: true, season: true, seriesId: true, round: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, goalEvents: true, league: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  // Player cache
  const playerMap = new Map<number, typeof allPlayersWithBirth[number]>();
  allPlayersWithBirth.forEach((p) => playerMap.set(p.id, p));

  const allReferencedPlayerIds = new Set<number>();
  archivedSkaters.forEach((s) => allReferencedPlayerIds.add(s.playerId));
  archivedGoalies.forEach((g) => allReferencedPlayerIds.add(g.playerId));
  allSkaterStats.forEach((s) => allReferencedPlayerIds.add(s.playerId));
  allGoalieStats.forEach((g) => allReferencedPlayerIds.add(g.playerId));
  seasonAwards.forEach((a) => { if (a.playerId) allReferencedPlayerIds.add(a.playerId); });

  const missingIds = [...allReferencedPlayerIds].filter((id) => !playerMap.has(id));
  if (missingIds.length) {
    const extra = await prisma.player.findMany({
      where: { id: { in: missingIds } },
      select: { id: true, name: true, slug: true, photoUrl: true, position: true, isGoalie: true, birthDate: true, age: true, teamId: true, overall: true },
    });
    extra.forEach((p) => playerMap.set(p.id, p));
  }

  // ==========================================
  // A. GM RECORDS (Manažérske rekordy)
  // ==========================================
  const gmTotalSeasons = new Map<string, { gm: string; teamId: number; seasons: Set<string> }>();
  const gmTeamSeasons = new Map<string, { gm: string; teamId: number; seasons: Set<string> }>();

  // Add historical seasons from archived teams
  for (const t of archivedTeams) {
    const gm = getTeamGm(t.teamId);
    if (!gm || gm === "—") continue;
    if (!gmTotalSeasons.has(gm)) gmTotalSeasons.set(gm, { gm, teamId: t.teamId, seasons: new Set() });
    gmTotalSeasons.get(gm)!.seasons.add(t.season);

    const key = `${gm}::${t.teamId}`;
    if (!gmTeamSeasons.has(key)) gmTeamSeasons.set(key, { gm, teamId: t.teamId, seasons: new Set() });
    gmTeamSeasons.get(key)!.seasons.add(t.season);
  }

  // Add active current season for all real registered GMs
  const activeLeagueTeams = allTeams.filter((t) => t.code !== "FA" && t.name !== "Free Agents");
  for (const tm of activeLeagueTeams) {
    const gm = getTeamGm(tm.id);
    if (!gm || gm === "—") continue;
    if (!gmTotalSeasons.has(gm)) gmTotalSeasons.set(gm, { gm, teamId: tm.id, seasons: new Set() });
    gmTotalSeasons.get(gm)!.seasons.add(ACTIVE_SEASON);

    const key = `${gm}::${tm.id}`;
    if (!gmTeamSeasons.has(key)) gmTeamSeasons.set(key, { gm, teamId: tm.id, seasons: new Set() });
    gmTeamSeasons.get(key)!.seasons.add(ACTIVE_SEASON);
  }

  const tTeam = lang === "cs" ? "Tím" : lang === "de" ? "Team" : lang === "ru" ? "Команда" : "Team";
  const tHome = lang === "cs" ? "Domáci" : lang === "de" ? "Heim" : lang === "ru" ? "Хозяева" : "Home";
  const tAway = lang === "cs" ? "Hostia" : lang === "de" ? "Gast" : lang === "ru" ? "Гости" : "Away";
  const tWinner = lang === "cs" ? "Víťaz" : lang === "de" ? "Sieger" : lang === "ru" ? "Победитель" : "Winner";
  const tLoser = lang === "cs" ? "Porazený" : lang === "de" ? "Verlierer" : lang === "ru" ? "Проигравший" : "Loser";
  const tBorn = lang === "cs" ? "Narodený" : lang === "de" ? "Geboren" : lang === "ru" ? "Родился" : "Born";
  const tPreseason = lang === "cs" ? "Príprava" : lang === "de" ? "Vorbereitung" : lang === "ru" ? "Предсезонка" : "Pre-season";
  const tPlayoffs = lang === "cs" ? "Play-off" : lang === "de" ? "Playoffs" : lang === "ru" ? "Плей-офф" : "Playoffs";
  const tSeason = lang === "cs" ? "Sezóna" : lang === "de" ? "Saison" : lang === "ru" ? "Сезон" : "Season";
  const tRookieSeason = lang === "cs" ? "Sezóna nováčika" : lang === "de" ? "Rookie-Saison" : lang === "ru" ? "Сезон новичка" : "Rookie season";
  const tPim = lang === "cs" ? "TM" : lang === "de" ? "Strafmin." : lang === "ru" ? "ШМ" : "PIM";
  const tTotal = lang === "cs" ? "celkovo" : lang === "de" ? "gesamt" : lang === "ru" ? "всего" : "total";
  const tInGame = lang === "cs" ? "v zápase" : lang === "de" ? "im Spiel" : lang === "ru" ? "за матч" : "in a game";
  const tInGamePo = lang === "cs" ? "v zápase PO" : lang === "de" ? "im Playoff-Spiel" : lang === "ru" ? "в матче плей-офф" : "in playoff game";
  const tScore = lang === "cs" ? "Skóre" : lang === "de" ? "Ergebnis" : lang === "ru" ? "Счет" : "Score";
  const tResult = lang === "cs" ? "Výsledok" : lang === "de" ? "Ergebnis" : lang === "ru" ? "Результат" : "Result";
  const tPlayer = lang === "cs" ? "Hráč" : lang === "de" ? "Spieler" : lang === "ru" ? "Игрок" : "Player";
  const tGoalie = lang === "cs" ? "Brankár" : lang === "de" ? "Torhüter" : lang === "ru" ? "Вратарь" : "Goalie";

  const fmtSeasonsCount = (count: number) => {
    if (lang === "cs") return `${count} ${count === 1 ? "sezóna" : count < 5 ? "sezóny" : "sezón"}`;
    if (lang === "de") return `${count} ${count === 1 ? "Saison" : "Saisons"}`;
    if (lang === "ru") return `${count} ${count === 1 ? "сезон" : count < 5 ? "сезона" : "сезонов"}`;
    return `${count} ${count === 1 ? "season" : "seasons"}`;
  };

  const fmtStreakInRow = (count: number) => {
    if (lang === "cs") return `${count} v rade`;
    if (lang === "de") return `${count} in Folge`;
    if (lang === "ru") return `${count} подряд`;
    return `${count} consecutive`;
  };

  const fmtSpan = (start: string, end: string) => {
    if (start === end) return start;
    if (lang === "cs") return `${start} až ${end}`;
    if (lang === "de") return `${start} bis ${end}`;
    if (lang === "ru") return `${start} по ${end}`;
    return `${start} to ${end}`;
  };

  const gmSeasonsLeader: LeaderItem[] = [...gmTotalSeasons.values()]
    .map((entry) => {
      const tm = teamById.get(entry.teamId);
      const parentTm = tm?.parentTeam ? tm.parentTeam : tm;
      const nick = parentTm?.gmNickname ? `@${parentTm.gmNickname}` : null;
      const sub = [nick, tm?.name].filter(Boolean).join(" · ");
      return {
        rank: 1,
        name: entry.gm,
        sub: sub || undefined,
        teamCode: tm?.code ?? tm?.name,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        gmSlug: parentTm?.slug,
        value: fmtSeasonsCount(entry.seasons.size),
        rawVal: entry.seasons.size,
      };
    })
    .sort((a, b) => b.rawVal - a.rawVal || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  const gmOneTeamLeader: LeaderItem[] = [...gmTeamSeasons.values()]
    .map((entry) => {
      const tm = teamById.get(entry.teamId);
      const parentTm = tm?.parentTeam ? tm.parentTeam : tm;
      const nick = parentTm?.gmNickname ? `@${parentTm.gmNickname}` : null;
      const sub = [nick, tm?.name].filter(Boolean).join(" · ");
      return {
        rank: 1,
        name: entry.gm,
        sub: sub || undefined,
        teamCode: tm?.code ?? tm?.name,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        gmSlug: parentTm?.slug,
        value: fmtSeasonsCount(entry.seasons.size),
        rawVal: entry.seasons.size,
      };
    })
    .sort((a, b) => b.rawVal - a.rawVal || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  const gmStreakLeader: LeaderItem[] = [...gmTotalSeasons.values()]
    .map((entry) => {
      const sortedSeasons = [...entry.seasons].sort();
      let maxStreak = 1;
      let currentStreak = 1;
      let bestStart = sortedSeasons[0] ?? ACTIVE_SEASON;
      let bestEnd = sortedSeasons[0] ?? ACTIVE_SEASON;
      let currentStart = sortedSeasons[0] ?? ACTIVE_SEASON;

      for (let i = 1; i < sortedSeasons.length; i++) {
        const currYear = parseSeasonYear(sortedSeasons[i]);
        const prevYear = parseSeasonYear(sortedSeasons[i - 1]);
        if (currYear === prevYear + 1) {
          currentStreak++;
        } else {
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
            bestStart = currentStart;
            bestEnd = sortedSeasons[i - 1];
          }
          currentStreak = 1;
          currentStart = sortedSeasons[i];
        }
      }
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
        bestStart = currentStart;
        bestEnd = sortedSeasons[sortedSeasons.length - 1];
      }

      const tm = teamById.get(entry.teamId);
      const parentTm = tm?.parentTeam ? tm.parentTeam : tm;
      const nick = parentTm?.gmNickname ? `@${parentTm.gmNickname}` : null;
      const spanText = fmtSpan(bestStart, bestEnd);
      const sub = [nick, spanText].filter(Boolean).join(" · ");

      return {
        rank: 1,
        name: entry.gm,
        sub,
        teamCode: tm?.code ?? tm?.name,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        gmSlug: parentTm?.slug,
        value: fmtStreakInRow(maxStreak),
        rawVal: maxStreak,
      };
    })
    .sort((a, b) => b.rawVal - a.rawVal || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  // ==========================================
  // B. STANLEY CUP / CALDER CUP CHAMPIONSHIPS
  // ==========================================
  const champRecords = seasonRecords.filter((r) => r.championTeamId != null);

  const teamCups = new Map<number, string[]>();
  for (const r of champRecords) {
    if (!r.championTeamId) continue;
    if (!teamCups.has(r.championTeamId)) teamCups.set(r.championTeamId, []);
    teamCups.get(r.championTeamId)!.push(r.season);
  }

  const teamCupLeaders: LeaderItem[] = [...teamCups.entries()]
    .map(([teamId, seasons]) => {
      const tm = teamById.get(teamId);
      return {
        rank: 1,
        name: tm?.name ?? tTeam,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${seasons.length}× ${cupName}`,
        sub: seasons.sort().join(", "),
        extraList: seasons.sort(),
        rawVal: seasons.length,
      };
    })
    .sort((a, b) => b.rawVal - a.rawVal)
    .slice(0, 5)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  const gmCups = new Map<string, Array<{ season: string; teamName: string; teamCode?: string }>>();
  for (const r of champRecords) {
    if (!r.championTeamId) continue;
    const tm = teamById.get(r.championTeamId);
    const gm = getTeamGm(r.championTeamId);
    if (!gm || gm === "—") continue;
    if (!gmCups.has(gm)) gmCups.set(gm, []);
    gmCups.get(gm)!.push({
      season: r.season,
      teamName: tm?.name ?? "",
      teamCode: tm?.code ?? tm?.name,
    });
  }

  const gmCupLeaders: LeaderItem[] = [...gmCups.entries()]
    .map(([gm, items]) => ({
      rank: 1,
      name: gm,
      value: `${items.length}× ${cupName}`,
      sub: items.map((i) => `${i.season} (${i.teamCode ?? i.teamName})`).join(", "),
      extraList: items.map((i) => `${i.season} (${i.teamCode ?? i.teamName})`),
      rawVal: items.length,
    }))
    .sort((a, b) => b.rawVal - a.rawVal)
    .slice(0, 5)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  const champSeasonTeam = new Map<string, number>();
  champRecords.forEach((r) => {
    if (r.championTeamId) champSeasonTeam.set(r.season, r.championTeamId);
  });

  const playerRings = new Map<number, Array<{ season: string; teamId: number }>>();
  const addRing = (playerId: number, season: string, teamId: number) => {
    if (!playerRings.has(playerId)) playerRings.set(playerId, []);
    const list = playerRings.get(playerId)!;
    if (!list.some((x) => x.season === season)) {
      list.push({ season, teamId });
    }
  };

  for (const s of archivedSkaters) {
    if (s.gp > 0 && champSeasonTeam.get(s.season) === s.teamId) {
      addRing(s.playerId, s.season, s.teamId);
    }
  }
  for (const g of archivedGoalies) {
    if (g.gp > 0 && champSeasonTeam.get(g.season) === g.teamId) {
      addRing(g.playerId, g.season, g.teamId);
    }
  }

  const skaterRingsLeader: LeaderItem[] = [];
  const goalieRingsLeader: LeaderItem[] = [];

  for (const [playerId, rings] of playerRings.entries()) {
    const p = playerMap.get(playerId);
    if (!p) continue;
    const isGoalie = p.position === "G" || p.isGoalie;
    const items = rings.map((r) => {
      const tm = teamById.get(r.teamId);
      return `${r.season} (${tm?.code ?? tm?.name ?? tTeam})`;
    });
    const row: LeaderItem & { rawVal: number } = {
      rank: 1,
      name: cleanName(p.name),
      slug: p.slug,
      photoUrl: p.photoUrl,
      hideTeam: true,
      value: `${rings.length}× ${cupName}`,
      sub: items.join(", "),
      extraList: items,
      rawVal: rings.length,
    };
    if (isGoalie) {
      goalieRingsLeader.push(row);
    } else {
      skaterRingsLeader.push(row);
    }
  }

  skaterRingsLeader.sort((a, b) => (b as any).rawVal - (a as any).rawVal);
  skaterRingsLeader.splice(5);
  skaterRingsLeader.forEach((item, idx) => { item.rank = idx + 1; });

  goalieRingsLeader.sort((a, b) => (b as any).rawVal - (a as any).rawVal);
  goalieRingsLeader.splice(5);
  goalieRingsLeader.forEach((item, idx) => { item.rank = idx + 1; });

  // ==========================================
  // D. SKATER & GOALIE SPLITS & DEBUT TRACKING
  // ==========================================
  const archivedRegSkaters = archivedSkaters.filter((s) => !s.isPlayoff);
  const archivedPlayoffSkaters = archivedSkaters.filter((s) => s.isPlayoff);
  const archivedRegGoalies = archivedGoalies.filter((g) => !g.isPlayoff);
  const archivedPlayoffGoalies = archivedGoalies.filter((g) => g.isPlayoff);

  const regSkaterStats = allSkaterStats.filter((s) => !s.game.season.endsWith("-PRE") && s.game.season !== PRE_SEASON && s.game.seriesId == null);
  const playoffSkaterStats = allSkaterStats.filter((s) => s.game.seriesId != null);
  const preSkaterStats = allSkaterStats.filter((s) => s.game.season.endsWith("-PRE") || s.game.season === PRE_SEASON);

  const regGoalieStats = allGoalieStats.filter((g) => !g.game.season.endsWith("-PRE") && g.game.season !== PRE_SEASON && g.game.seriesId == null);
  const playoffGoalieStats = allGoalieStats.filter((g) => g.game.seriesId != null);
  const preGoalieStats = allGoalieStats.filter((g) => g.game.season.endsWith("-PRE") || g.game.season === PRE_SEASON);

  // Debut season determination for rookie records
  const allSeasonOccurrences = new Map<number, Set<string>>();
  archivedSkaters.forEach((s) => {
    if (!allSeasonOccurrences.has(s.playerId)) allSeasonOccurrences.set(s.playerId, new Set());
    allSeasonOccurrences.get(s.playerId)!.add(s.season);
  });
  archivedGoalies.forEach((g) => {
    if (!allSeasonOccurrences.has(g.playerId)) allSeasonOccurrences.set(g.playerId, new Set());
    allSeasonOccurrences.get(g.playerId)!.add(g.season);
  });
  allSkaterStats.forEach((s) => {
    if (!allSeasonOccurrences.has(s.playerId)) allSeasonOccurrences.set(s.playerId, new Set());
    allSeasonOccurrences.get(s.playerId)!.add(s.game.season);
  });
  allGoalieStats.forEach((g) => {
    if (!allSeasonOccurrences.has(g.playerId)) allSeasonOccurrences.set(g.playerId, new Set());
    allSeasonOccurrences.get(g.playerId)!.add(g.game.season);
  });

  const playerDebutSeason = new Map<number, string>();
  for (const [pId, seasons] of allSeasonOccurrences.entries()) {
    const sorted = [...seasons].sort();
    if (sorted.length) playerDebutSeason.set(pId, sorted[0]);
  }

  // ==========================================
  // E. CAREER REGULAR-SEASON RECORDS (ZČ Kariéra)
  // ==========================================
  type SkaterCareerAcc = {
    playerId: number;
    gp: number;
    goals: number;
    assists: number;
    points: number;
    shots: number;
    pim: number;
    plusMinus: number;
    ppGoals: number;
    ppAssists: number;
    ppPoints: number;
    shGoals: number;
    shAssists: number;
    shPoints: number;
    teamId: number | null;
  };

  type GoalieCareerAcc = {
    playerId: number;
    gp: number;
    wins: number;
    losses: number;
    otl: number;
    shutouts: number;
    shotsAgainst: number;
    saves: number;
    goalsAgainst: number;
    steals: number;
    gsax: number;
    teamId: number | null;
  };

  const skCareerMap = new Map<number, SkaterCareerAcc>();
  const glCareerMap = new Map<number, GoalieCareerAcc>();

  const getSkAcc = (id: number): SkaterCareerAcc => {
    let acc = skCareerMap.get(id);
    if (!acc) {
      acc = {
        playerId: id,
        gp: 0,
        goals: 0,
        assists: 0,
        points: 0,
        shots: 0,
        pim: 0,
        plusMinus: 0,
        ppGoals: 0,
        ppAssists: 0,
        ppPoints: 0,
        shGoals: 0,
        shAssists: 0,
        shPoints: 0,
        teamId: null,
      };
      skCareerMap.set(id, acc);
    }
    return acc;
  };

  const getGlAcc = (id: number): GoalieCareerAcc => {
    let acc = glCareerMap.get(id);
    if (!acc) {
      acc = { playerId: id, gp: 0, wins: 0, losses: 0, otl: 0, shutouts: 0, shotsAgainst: 0, saves: 0, goalsAgainst: 0, steals: 0, gsax: 0, teamId: null };
      glCareerMap.set(id, acc);
    }
    return acc;
  };

  // 1. Archived career stats (Regular season)
  for (const s of archivedRegSkaters) {
    const a = getSkAcc(s.playerId);
    a.gp += s.gp;
    a.goals += s.goals;
    a.assists += s.assists;
    a.points += s.points;
    a.shots += s.shots;
    a.pim += s.pim;
    a.plusMinus += s.plusMinus;
    a.ppGoals += s.ppGoals ?? 0;
    a.ppAssists += s.ppAssists ?? 0;
    a.ppPoints += (s.ppGoals ?? 0) + (s.ppAssists ?? 0);
    a.shGoals += s.shGoals ?? 0;
    a.shAssists += s.shAssists ?? 0;
    a.shPoints += (s.shGoals ?? 0) + (s.shAssists ?? 0);
    a.teamId = s.teamId;
  }

  for (const g of archivedRegGoalies) {
    const a = getGlAcc(g.playerId);
    a.gp += g.gp;
    a.wins += g.wins;
    a.losses += g.losses;
    a.otl += g.otl;
    a.shutouts += g.shutouts;
    a.shotsAgainst += g.shotsAgainst;
    a.saves += g.saves;
    a.goalsAgainst += g.goalsAgainst;
    a.teamId = g.teamId;
  }

  // 2. Add regular season game stats from live games
  for (const s of regSkaterStats) {
    const a = getSkAcc(s.playerId);
    a.gp += 1;
    a.goals += s.goals;
    a.assists += s.assists;
    a.points += s.points;
    a.shots += s.shots;
    a.pim += s.pim;
    a.plusMinus += s.plusMinus;
    a.ppGoals += s.ppGoals ?? 0;
    a.ppAssists += s.ppAssists ?? 0;
    a.ppPoints += (s.ppGoals ?? 0) + (s.ppAssists ?? 0);
    a.shGoals += s.shGoals ?? 0;
    a.shAssists += s.shAssists ?? 0;
    a.shPoints += (s.shGoals ?? 0) + (s.shAssists ?? 0);
    if (s.teamId) a.teamId = s.teamId;
  }

  for (const g of regGoalieStats) {
    const a = getGlAcc(g.playerId);
    a.gp += 1;
    a.shotsAgainst += g.shotsAgainst;
    a.saves += g.saves;
    a.goalsAgainst += g.goalsAgainst;
    if (g.teamId) a.teamId = g.teamId;

    if (g.decision === "W") a.wins++;
    else if (g.decision === "OTL") a.otl++;
    else if (g.decision === "L") a.losses++;

    if (g.goalsAgainst === 0) a.shutouts++;

    const gsax = (g.xga ?? 0) - g.goalsAgainst;
    a.gsax += gsax;

    if (g.decision === "W" && g.game) {
      const isHome = g.teamId === g.game.homeTeamId;
      const teamGoals = (isHome ? g.game.homeGoals : g.game.awayGoals) ?? 0;
      const oppGoals = (isHome ? g.game.awayGoals : g.game.homeGoals) ?? 0;
      const enGoals = g.game.goalEvents.filter((ev) => ev.teamId === g.teamId).length;
      const margin = Math.max(0, teamGoals - enGoals - oppGoals);
      if (gsax > margin) {
        a.steals++;
      }
    }
  }

  const skRowItem = (s: { playerId: number }, val: string | number, sub?: string): LeaderItem => {
    const p = playerMap.get(s.playerId);
    return {
      rank: 1,
      name: p ? cleanName(p.name) : "—",
      slug: p?.slug,
      photoUrl: p?.photoUrl,
      hideTeam: true,
      value: val,
      sub,
    };
  };

  const glRowItem = (g: { playerId: number }, val: string | number, sub?: string): LeaderItem => {
    const p = playerMap.get(g.playerId);
    return {
      rank: 1,
      name: p ? cleanName(p.name) : "—",
      slug: p?.slug,
      photoUrl: p?.photoUrl,
      hideTeam: true,
      value: val,
      sub,
    };
  };

  const skList = [...skCareerMap.values()];
  const glList = [...glCareerMap.values()];

  const topSkaters = (fn: (s: SkaterCareerAcc) => number, valFmt: (s: SkaterCareerAcc) => string | number, subFmt?: (s: SkaterCareerAcc) => string, sortAsc = false) =>
    [...skList]
      .filter((s) => (sortAsc ? fn(s) < 0 : fn(s) > 0))
      .sort((a, b) => (sortAsc ? fn(a) - fn(b) : fn(b) - fn(a)))
      .slice(0, 5)
      .map((s, idx) => ({ ...skRowItem(s, valFmt(s), subFmt?.(s)), rank: idx + 1 }));

  const topGoalies = (fn: (g: GoalieCareerAcc) => number, valFmt: (g: GoalieCareerAcc) => string | number, subFmt?: (g: GoalieCareerAcc) => string) =>
    [...glList]
      .filter((g) => fn(g) !== 0)
      .sort((a, b) => fn(b) - fn(a))
      .slice(0, 5)
      .map((g, idx) => ({ ...glRowItem(g, valFmt(g), subFmt?.(g)), rank: idx + 1 }));

  const careerGpItems = topSkaters((s) => s.gp, (s) => `${s.gp} GP`, (s) => `${s.goals}G + ${s.assists}A · ${s.points} PTS`);
  const careerGoalsItems = topSkaters((s) => s.goals, (s) => `${s.goals} G`, (s) => `${s.gp} GP · ${s.points} PTS`);
  const careerAssistsItems = topSkaters((s) => s.assists, (s) => `${s.assists} A`, (s) => `${s.gp} GP · ${s.points} PTS`);
  const careerPointsItems = topSkaters((s) => s.points, (s) => `${s.points} PTS`, (s) => `${s.goals}G + ${s.assists}A (${s.gp} GP)`);
  const careerPimItems = topSkaters((s) => s.pim, (s) => `${s.pim} ${tPim}`, (s) => `${s.gp} GP · ${s.points} PTS`);
  const careerPlusMinusBestItems = topSkaters((s) => s.plusMinus, (s) => `+${s.plusMinus} +/-`, (s) => `${s.gp} GP · ${s.points} PTS`);
  const careerPlusMinusWorstItems = topSkaters((s) => s.plusMinus, (s) => `${s.plusMinus} +/-`, (s) => `${s.gp} GP · ${s.points} PTS`, true);

  const careerPpGoalsItems = topSkaters((s) => s.ppGoals, (s) => `${s.ppGoals} PPG`, (s) => `${s.goals} G ${tTotal} · ${s.gp} GP`);
  const careerPpAssistsItems = topSkaters((s) => s.ppAssists, (s) => `${s.ppAssists} PPA`, (s) => `${s.assists} A ${tTotal} · ${s.gp} GP`);
  const careerPpPointsItems = topSkaters((s) => s.ppPoints, (s) => `${s.ppPoints} PPP`, (s) => `${s.ppGoals} PPG + ${s.ppAssists} PPA (${s.points} PTS)`);

  const careerShGoalsItems = topSkaters((s) => s.shGoals, (s) => `${s.shGoals} SHG`, (s) => `${s.goals} G ${tTotal} · ${s.gp} GP`);
  const careerShAssistsItems = topSkaters((s) => s.shAssists, (s) => `${s.shAssists} SHA`, (s) => `${s.assists} A ${tTotal} · ${s.gp} GP`);
  const careerShPointsItems = topSkaters((s) => s.shPoints, (s) => `${s.shPoints} SHP`, (s) => `${s.shGoals} SHG + ${s.shAssists} SHA (${s.points} PTS)`);

  // Streaks across regular season games
  const playerRegGameStats = new Map<number, typeof regSkaterStats>();
  for (const s of regSkaterStats) {
    if (!playerRegGameStats.has(s.playerId)) playerRegGameStats.set(s.playerId, []);
    playerRegGameStats.get(s.playerId)!.push(s);
  }

  for (const [, list] of playerRegGameStats.entries()) {
    list.sort((a, b) => {
      const da = a.game.gameDate ? new Date(a.game.gameDate).getTime() : 0;
      const db = b.game.gameDate ? new Date(b.game.gameDate).getTime() : 0;
      return da - db || a.gameId - b.gameId;
    });
  }

  type StreakInfo = { playerId: number; streak: number; startSeason: string; endSeason: string };
  const goalStreaks: StreakInfo[] = [];
  const assistStreaks: StreakInfo[] = [];
  const pointStreaks: StreakInfo[] = [];
  const ironmanStreaks: StreakInfo[] = [];

  for (const [pId, list] of playerRegGameStats.entries()) {
    let maxG = 0, curG = 0, startG = "", curStartG = "", endG = "";
    let maxA = 0, curA = 0, startA = "", curStartA = "", endA = "";
    let maxP = 0, curP = 0, startP = "", curStartP = "", endP = "";
    let maxIron = 0, curIron = 0, startIron = "", curStartIron = "", endIron = "";

    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      const seas = g.game.season;

      // Iron
      if (curIron === 0) curStartIron = seas;
      curIron++;
      if (curIron > maxIron) {
        maxIron = curIron;
        startIron = curStartIron;
        endIron = seas;
      }

      // Goal
      if (g.goals > 0) {
        if (curG === 0) curStartG = seas;
        curG++;
        if (curG > maxG) {
          maxG = curG;
          startG = curStartG;
          endG = seas;
        }
      } else {
        curG = 0;
      }

      // Assist
      if (g.assists > 0) {
        if (curA === 0) curStartA = seas;
        curA++;
        if (curA > maxA) {
          maxA = curA;
          startA = curStartA;
          endA = seas;
        }
      } else {
        curA = 0;
      }

      // Point
      if (g.points > 0) {
        if (curP === 0) curStartP = seas;
        curP++;
        if (curP > maxP) {
          maxP = curP;
          startP = curStartP;
          endP = seas;
        }
      } else {
        curP = 0;
      }
    }

    if (maxIron > 0) ironmanStreaks.push({ playerId: pId, streak: maxIron, startSeason: startIron, endSeason: endIron });
    if (maxG > 0) goalStreaks.push({ playerId: pId, streak: maxG, startSeason: startG, endSeason: endG });
    if (maxA > 0) assistStreaks.push({ playerId: pId, streak: maxA, startSeason: startA, endSeason: endA });
    if (maxP > 0) pointStreaks.push({ playerId: pId, streak: maxP, startSeason: startP, endSeason: endP });
  }

  const buildStreakLeader = (list: StreakInfo[], unitSuffix: string): LeaderItem[] =>
    list
      .filter((s) => s.streak > 0)
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 5)
      .map((item, idx) => {
        const p = playerMap.get(item.playerId);
        const spanText = item.startSeason === item.endSeason ? `${tSeason} ${item.startSeason}` : fmtSpan(item.startSeason, item.endSeason);
        return {
          rank: idx + 1,
          name: p ? cleanName(p.name) : tPlayer,
          slug: p?.slug,
          photoUrl: p?.photoUrl,
          hideTeam: true,
          value: `${item.streak} ${unitSuffix}`,
          sub: spanText,
        };
      });

  const ironmanLeader = buildStreakLeader(ironmanStreaks, lang === "cs" ? "zápasov v rade" : lang === "de" ? "Spiele in Folge" : lang === "ru" ? "матчей подряд" : "consecutive GP");
  const goalStreakLeader = buildStreakLeader(goalStreaks, lang === "cs" ? "zápasov s gólom" : lang === "de" ? "Torspiele in Folge" : lang === "ru" ? "матчей с голом" : "game goal streak");
  const assistStreakLeader = buildStreakLeader(assistStreaks, lang === "cs" ? "zápasov s asistenciou" : lang === "de" ? "Assist-Spiele in Folge" : lang === "ru" ? "матчей с передачей" : "game assist streak");
  const pointStreakLeader = buildStreakLeader(pointStreaks, lang === "cs" ? "zápasov s bodom" : lang === "de" ? "Punktespiele in Folge" : lang === "ru" ? "матчей с очками" : "game point streak");

  // Player first match and last match dates for debut / oldest appearance
  type PlayerMatchSpan = { playerId: number; firstDate: Date; lastDate: Date; firstSeason: string; lastSeason: string };
  const playerMatchDates = new Map<number, PlayerMatchSpan>();

  const recordPlayerGameDate = (playerId: number, gameDate: Date | null, season: string) => {
    const d = gameDate ? new Date(gameDate) : new Date("2026-01-01");
    if (!playerMatchDates.has(playerId)) {
      playerMatchDates.set(playerId, { playerId, firstDate: d, lastDate: d, firstSeason: season, lastSeason: season });
    } else {
      const span = playerMatchDates.get(playerId)!;
      if (d.getTime() < span.firstDate.getTime()) {
        span.firstDate = d;
        span.firstSeason = season;
      }
      if (d.getTime() > span.lastDate.getTime()) {
        span.lastDate = d;
        span.lastSeason = season;
      }
    }
  };

  for (const s of regSkaterStats) {
    recordPlayerGameDate(s.playerId, s.game.gameDate, s.game.season);
  }
  for (const g of regGoalieStats) {
    recordPlayerGameDate(g.playerId, g.game.gameDate, g.game.season);
  }

  const matchDebutYoungest: LeaderItem[] = [...playerMatchDates.values()]
    .map((span) => {
      const p = playerMap.get(span.playerId);
      if (!p) return null;
      const age = calculateAge(p.birthDate, span.firstDate, p.age, lang);
      if (!age || age.years < 15 || age.years > 65) return null;
      const totalDays = age.years * 365 + age.days;
      return { span, p, age, totalDays };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => a.totalDays - b.totalDays)
    .slice(0, 5)
    .map(({ span, p, age }, idx) => ({
      rank: idx + 1,
      name: cleanName(p.name),
      slug: p.slug,
      photoUrl: p.photoUrl,
      hideTeam: true,
      value: age.formatted,
      sub: `${lang === "cs" ? "Debut v sezóne" : lang === "de" ? "Debüt in Saison" : lang === "ru" ? "Дебют в сезоне" : "Debut in season"} ${span.firstSeason} (${formatRecordDate(span.firstDate, lang)})`,
    }));

  const matchAppearanceOldest: LeaderItem[] = [...playerMatchDates.values()]
    .map((span) => {
      const p = playerMap.get(span.playerId);
      if (!p) return null;
      const age = calculateAge(p.birthDate, span.lastDate, p.age, lang);
      if (!age || age.years < 15 || age.years > 65) return null;
      const totalDays = age.years * 365 + age.days;
      return { span, p, age, totalDays };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.totalDays - a.totalDays)
    .slice(0, 5)
    .map(({ span, p, age }, idx) => ({
      rank: idx + 1,
      name: cleanName(p.name),
      slug: p.slug,
      photoUrl: p.photoUrl,
      hideTeam: true,
      value: age.formatted,
      sub: `${lang === "cs" ? "Zápas v sezóne" : lang === "de" ? "Spiel in Saison" : lang === "ru" ? "Матч в сезоне" : "Game in season"} ${span.lastSeason} (${formatRecordDate(span.lastDate, lang)})`,
    }));

  const secBadgeReg = getRecordBadge("regular", lang);

  const skaterCareerSections: RecordSection[] = [
    { id: "career-gp", title: getSectionTitle("career-gp", lang, league, cupName), icon: "🏒", phase: "regular", phaseBadge: secBadgeReg, items: careerGpItems },
    { id: "career-goals", title: getSectionTitle("career-goals", lang, league, cupName), icon: "🎯", phase: "regular", phaseBadge: secBadgeReg, items: careerGoalsItems },
    { id: "career-assists", title: getSectionTitle("career-assists", lang, league, cupName), icon: "🪄", phase: "regular", phaseBadge: secBadgeReg, items: careerAssistsItems },
    { id: "career-points", title: getSectionTitle("career-points", lang, league, cupName), icon: "⭐", phase: "regular", phaseBadge: secBadgeReg, items: careerPointsItems },
    { id: "career-pim", title: getSectionTitle("career-pim", lang, league, cupName), icon: "⏱️", phase: "regular", phaseBadge: secBadgeReg, items: careerPimItems },
    { id: "career-plus-minus-best", title: getSectionTitle("career-plus-minus-best", lang, league, cupName), icon: "🟢", phase: "regular", phaseBadge: secBadgeReg, items: careerPlusMinusBestItems },
    { id: "career-plus-minus-worst", title: getSectionTitle("career-plus-minus-worst", lang, league, cupName), icon: "🔴", phase: "regular", phaseBadge: secBadgeReg, items: careerPlusMinusWorstItems },
    { id: "career-pp-goals", title: getSectionTitle("career-pp-goals", lang, league, cupName), icon: "⚡", phase: "regular", phaseBadge: secBadgeReg, items: careerPpGoalsItems },
    { id: "career-pp-assists", title: getSectionTitle("career-pp-assists", lang, league, cupName), icon: "🏒", phase: "regular", phaseBadge: secBadgeReg, items: careerPpAssistsItems },
    { id: "career-pp-points", title: getSectionTitle("career-pp-points", lang, league, cupName), icon: "⭐", phase: "regular", phaseBadge: secBadgeReg, items: careerPpPointsItems },
    { id: "career-sh-goals", title: getSectionTitle("career-sh-goals", lang, league, cupName), icon: "🛡️", phase: "regular", phaseBadge: secBadgeReg, items: careerShGoalsItems },
    { id: "career-sh-assists", title: getSectionTitle("career-sh-assists", lang, league, cupName), icon: "🧤", phase: "regular", phaseBadge: secBadgeReg, items: careerShAssistsItems },
    { id: "career-sh-points", title: getSectionTitle("career-sh-points", lang, league, cupName), icon: "⭐", phase: "regular", phaseBadge: secBadgeReg, items: careerShPointsItems },
    { id: "career-ironman", title: getSectionTitle("career-ironman", lang, league, cupName), icon: "🛡️", phase: "regular", phaseBadge: secBadgeReg, items: ironmanLeader },
    { id: "career-goal-streak", title: getSectionTitle("career-goal-streak", lang, league, cupName), icon: "🔥", phase: "regular", phaseBadge: secBadgeReg, items: goalStreakLeader },
    { id: "career-assist-streak", title: getSectionTitle("career-assist-streak", lang, league, cupName), icon: "🪄", phase: "regular", phaseBadge: secBadgeReg, items: assistStreakLeader },
    { id: "career-point-streak", title: getSectionTitle("career-point-streak", lang, league, cupName), icon: "⚡", phase: "regular", phaseBadge: secBadgeReg, items: pointStreakLeader },
    { id: "career-youngest-debut", title: getSectionTitle("career-youngest-debut", lang, league, cupName), icon: "👶", phase: "regular", phaseBadge: secBadgeReg, items: matchDebutYoungest },
    { id: "career-oldest-appearance", title: getSectionTitle("career-oldest-appearance", lang, league, cupName), icon: "👴", phase: "regular", phaseBadge: secBadgeReg, items: matchAppearanceOldest },
  ];

  // ==========================================
  // F. SINGLE SEASON SKATER RECORDS (ZČ Jedna sezóna)
  // ==========================================
  type SeasonSkaterAcc = {
    playerId: number;
    season: string;
    teamIds: Set<number>;
    gp: number;
    goals: number;
    assists: number;
    points: number;
    pim: number;
    plusMinus: number;
    ppGoals: number;
    ppAssists: number;
    ppPoints: number;
    shGoals: number;
    shAssists: number;
    shPoints: number;
  };

  const seasonSkaterMap = new Map<string, SeasonSkaterAcc>();

  for (const s of archivedRegSkaters) {
    const key = `${s.playerId}::${s.season}`;
    if (!seasonSkaterMap.has(key)) {
      seasonSkaterMap.set(key, {
        playerId: s.playerId,
        season: s.season,
        teamIds: new Set(),
        gp: 0,
        goals: 0,
        assists: 0,
        points: 0,
        pim: 0,
        plusMinus: 0,
        ppGoals: 0,
        ppAssists: 0,
        ppPoints: 0,
        shGoals: 0,
        shAssists: 0,
        shPoints: 0,
      });
    }
    const acc = seasonSkaterMap.get(key)!;
    acc.gp += s.gp;
    acc.goals += s.goals;
    acc.assists += s.assists;
    acc.points += s.points;
    acc.pim += s.pim;
    acc.plusMinus += s.plusMinus;
    acc.ppGoals += s.ppGoals ?? 0;
    acc.ppAssists += s.ppAssists ?? 0;
    acc.ppPoints += (s.ppGoals ?? 0) + (s.ppAssists ?? 0);
    acc.shGoals += s.shGoals ?? 0;
    acc.shAssists += s.shAssists ?? 0;
    acc.shPoints += (s.shGoals ?? 0) + (s.shAssists ?? 0);
    if (s.teamId) acc.teamIds.add(s.teamId);
  }

  for (const s of regSkaterStats) {
    const season = s.game.season;
    const key = `${s.playerId}::${season}`;
    if (!seasonSkaterMap.has(key)) {
      seasonSkaterMap.set(key, {
        playerId: s.playerId,
        season,
        teamIds: new Set(),
        gp: 0,
        goals: 0,
        assists: 0,
        points: 0,
        pim: 0,
        plusMinus: 0,
        ppGoals: 0,
        ppAssists: 0,
        ppPoints: 0,
        shGoals: 0,
        shAssists: 0,
        shPoints: 0,
      });
    }
    const acc = seasonSkaterMap.get(key)!;
    acc.gp += 1;
    acc.goals += s.goals;
    acc.assists += s.assists;
    acc.points += s.points;
    acc.pim += s.pim;
    acc.plusMinus += s.plusMinus;
    acc.ppGoals += s.ppGoals ?? 0;
    acc.ppAssists += s.ppAssists ?? 0;
    acc.ppPoints += (s.ppGoals ?? 0) + (s.ppAssists ?? 0);
    acc.shGoals += s.shGoals ?? 0;
    acc.shAssists += s.shAssists ?? 0;
    acc.shPoints += (s.shGoals ?? 0) + (s.shAssists ?? 0);
    if (s.teamId) acc.teamIds.add(s.teamId);
  }

  const allSeasonSkaters = [...seasonSkaterMap.values()];

  const buildSeasonSkaterLeader = (
    list: SeasonSkaterAcc[],
    sortFn: (a: SeasonSkaterAcc, b: SeasonSkaterAcc) => number,
    filterFn: (s: SeasonSkaterAcc) => boolean,
    valFmt: (s: SeasonSkaterAcc) => string | number,
    subFmt: (s: SeasonSkaterAcc) => string
  ): LeaderItem[] =>
    list
      .filter(filterFn)
      .sort(sortFn)
      .slice(0, 5)
      .map((entry, idx) => {
        const p = playerMap.get(entry.playerId);
        const tmInfo = resolveTeams(entry.teamIds, teamById);
        return {
          rank: idx + 1,
          name: p ? cleanName(p.name) : "Hráč",
          slug: p?.slug,
          photoUrl: p?.photoUrl,
          ...tmInfo,
          value: valFmt(entry),
          sub: subFmt(entry),
        };
      });

  const seasonGoalsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.goals - a.goals || b.points - a.points, (s) => s.goals > 0, (s) => `${s.goals} G`, (s) => `${tSeason} ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const seasonAssistsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.assists - a.assists || b.points - a.points, (s) => s.assists > 0, (s) => `${s.assists} A`, (s) => `${tSeason} ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const seasonPointsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.points - a.points || b.goals - a.goals, (s) => s.points > 0, (s) => `${s.points} PTS`, (s) => `${tSeason} ${s.season} · ${s.goals}G + ${s.assists}A (${s.gp} GP)`);
  const seasonPimLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.pim - a.pim, (s) => s.pim > 0, (s) => `${s.pim} ${tPim}`, (s) => `${tSeason} ${s.season} · ${s.gp} GP`);
  const seasonPlusMinusBestLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.plusMinus - a.plusMinus || b.points - a.points, (s) => s.plusMinus > 0, (s) => `+${s.plusMinus} +/-`, (s) => `${tSeason} ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const seasonPlusMinusWorstLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => a.plusMinus - b.plusMinus || a.points - b.points, (s) => s.plusMinus < 0, (s) => `${s.plusMinus} +/-`, (s) => `${tSeason} ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const seasonPpGoalsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.ppGoals - a.ppGoals || b.goals - a.goals, (s) => s.ppGoals > 0, (s) => `${s.ppGoals} PPG`, (s) => `${tSeason} ${s.season} · ${s.goals} G ${tTotal} (${s.gp} GP)`);
  const seasonPpAssistsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.ppAssists - a.ppAssists || b.assists - a.assists, (s) => s.ppAssists > 0, (s) => `${s.ppAssists} PPA`, (s) => `${tSeason} ${s.season} · ${s.assists} A ${tTotal} (${s.gp} GP)`);
  const seasonPpPointsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.ppPoints - a.ppPoints || b.points - a.points, (s) => s.ppPoints > 0, (s) => `${s.ppPoints} PPP`, (s) => `${tSeason} ${s.season} · ${s.ppGoals} PPG + ${s.ppAssists} PPA (${s.points} PTS)`);
  const seasonShGoalsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.shGoals - a.shGoals || b.goals - a.goals, (s) => s.shGoals > 0, (s) => `${s.shGoals} SHG`, (s) => `${tSeason} ${s.season} · ${s.goals} G ${tTotal} (${s.gp} GP)`);
  const seasonShAssistsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.shAssists - a.shAssists || b.assists - a.assists, (s) => s.shAssists > 0, (s) => `${s.shAssists} SHA`, (s) => `${tSeason} ${s.season} · ${s.assists} A ${tTotal} (${s.gp} GP)`);
  const seasonShPointsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.shPoints - a.shPoints || b.points - a.points, (s) => s.shPoints > 0, (s) => `${s.shPoints} SHP`, (s) => `${tSeason} ${s.season} · ${s.shGoals} SHG + ${s.shAssists} SHA (${s.points} PTS)`);

  const skaterSeasonSections: RecordSection[] = [
    { id: "season-goals", title: getSectionTitle("season-goals", lang, league, cupName), icon: "🎯", phase: "regular", phaseBadge: secBadgeReg, items: seasonGoalsLeader },
    { id: "season-assists", title: getSectionTitle("season-assists", lang, league, cupName), icon: "🪄", phase: "regular", phaseBadge: secBadgeReg, items: seasonAssistsLeader },
    { id: "season-points", title: getSectionTitle("season-points", lang, league, cupName), icon: "⭐", phase: "regular", phaseBadge: secBadgeReg, items: seasonPointsLeader },
    { id: "season-pim", title: getSectionTitle("season-pim", lang, league, cupName), icon: "⏱️", phase: "regular", phaseBadge: secBadgeReg, items: seasonPimLeader },
    { id: "season-plus-minus-best", title: getSectionTitle("season-plus-minus-best", lang, league, cupName), icon: "🟢", phase: "regular", phaseBadge: secBadgeReg, items: seasonPlusMinusBestLeader },
    { id: "season-plus-minus-worst", title: getSectionTitle("season-plus-minus-worst", lang, league, cupName), icon: "🔴", phase: "regular", phaseBadge: secBadgeReg, items: seasonPlusMinusWorstLeader },
    { id: "season-pp-goals", title: getSectionTitle("season-pp-goals", lang, league, cupName), icon: "⚡", phase: "regular", phaseBadge: secBadgeReg, items: seasonPpGoalsLeader },
    { id: "season-pp-assists", title: getSectionTitle("season-pp-assists", lang, league, cupName), icon: "🏒", phase: "regular", phaseBadge: secBadgeReg, items: seasonPpAssistsLeader },
    { id: "season-pp-points", title: getSectionTitle("season-pp-points", lang, league, cupName), icon: "⭐", phase: "regular", phaseBadge: secBadgeReg, items: seasonPpPointsLeader },
    { id: "season-sh-goals", title: getSectionTitle("season-sh-goals", lang, league, cupName), icon: "🛡️", phase: "regular", phaseBadge: secBadgeReg, items: seasonShGoalsLeader },
    { id: "season-sh-assists", title: getSectionTitle("season-sh-assists", lang, league, cupName), icon: "🧤", phase: "regular", phaseBadge: secBadgeReg, items: seasonShAssistsLeader },
    { id: "season-sh-points", title: getSectionTitle("season-sh-points", lang, league, cupName), icon: "⭐", phase: "regular", phaseBadge: secBadgeReg, items: seasonShPointsLeader },
  ];

  // ==========================================
  // G. ROOKIE REGULAR-SEASON RECORDS (ZČ Nováčikovia)
  // ==========================================
  const rookieSeasonSkaters = allSeasonSkaters.filter((s) => {
    const p = playerMap.get(s.playerId);
    return playerDebutSeason.get(s.playerId) === s.season || (p && isRookieName(p.name));
  });

  const rookieGoalsLeader = buildSeasonSkaterLeader(rookieSeasonSkaters, (a, b) => b.goals - a.goals || b.points - a.points, (s) => s.goals > 0, (s) => `${s.goals} G`, (s) => `${tRookieSeason} ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const rookieAssistsLeader = buildSeasonSkaterLeader(rookieSeasonSkaters, (a, b) => b.assists - a.assists || b.points - a.points, (s) => s.assists > 0, (s) => `${s.assists} A`, (s) => `${tRookieSeason} ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const rookiePointsLeader = buildSeasonSkaterLeader(rookieSeasonSkaters, (a, b) => b.points - a.points || b.goals - a.goals, (s) => s.points > 0, (s) => `${s.points} PTS`, (s) => `${tRookieSeason} ${s.season} · ${s.goals}G + ${s.assists}A (${s.gp} GP)`);
  const rookiePimLeader = buildSeasonSkaterLeader(rookieSeasonSkaters, (a, b) => b.pim - a.pim, (s) => s.pim > 0, (s) => `${s.pim} ${tPim}`, (s) => `${tRookieSeason} ${s.season} · ${s.gp} GP`);
  const rookiePlusMinusBestLeader = buildSeasonSkaterLeader(rookieSeasonSkaters, (a, b) => b.plusMinus - a.plusMinus || b.points - a.points, (s) => s.plusMinus > 0, (s) => `+${s.plusMinus} +/-`, (s) => `${tRookieSeason} ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const rookiePlusMinusWorstLeader = buildSeasonSkaterLeader(rookieSeasonSkaters, (a, b) => a.plusMinus - b.plusMinus || a.points - b.points, (s) => s.plusMinus < 0, (s) => `${s.plusMinus} +/-`, (s) => `${tRookieSeason} ${s.season} · ${s.points} PTS (${s.gp} GP)`);

  const rookieSections: RecordSection[] = [
    { id: "rookie-season-goals", title: getSectionTitle("rookie-season-goals", lang, league, cupName), icon: "🎯", phase: "regular", phaseBadge: secBadgeReg, items: rookieGoalsLeader },
    { id: "rookie-season-assists", title: getSectionTitle("rookie-season-assists", lang, league, cupName), icon: "🪄", phase: "regular", phaseBadge: secBadgeReg, items: rookieAssistsLeader },
    { id: "rookie-season-points", title: getSectionTitle("rookie-season-points", lang, league, cupName), icon: "⭐", phase: "regular", phaseBadge: secBadgeReg, items: rookiePointsLeader },
    { id: "rookie-season-pim", title: getSectionTitle("rookie-season-pim", lang, league, cupName), icon: "⏱️", phase: "regular", phaseBadge: secBadgeReg, items: rookiePimLeader },
    { id: "rookie-season-plus-minus-best", title: getSectionTitle("rookie-season-plus-minus-best", lang, league, cupName), icon: "🟢", phase: "regular", phaseBadge: secBadgeReg, items: rookiePlusMinusBestLeader },
    { id: "rookie-season-plus-minus-worst", title: getSectionTitle("rookie-season-plus-minus-worst", lang, league, cupName), icon: "🔴", phase: "regular", phaseBadge: secBadgeReg, items: rookiePlusMinusWorstLeader },
  ];

  // ==========================================
  // H. SINGLE GAME SKATER RECORDS (ZČ Jeden zápas)
  // ==========================================
  const buildGameSkaterLeader = (
    list: typeof regSkaterStats,
    sortFn: (a: (typeof regSkaterStats)[0], b: (typeof regSkaterStats)[0]) => number,
    filterFn: (s: (typeof regSkaterStats)[0]) => boolean,
    valFmt: (s: (typeof regSkaterStats)[0]) => string | number,
    subFmt: (s: (typeof regSkaterStats)[0]) => string
  ): LeaderItem[] =>
    list
      .filter(filterFn)
      .sort(sortFn)
      .slice(0, 5)
      .map((s, idx) => {
        const p = playerMap.get(s.playerId);
        const tm = s.teamId ? teamById.get(s.teamId) : null;
        return {
          rank: idx + 1,
          name: p ? cleanName(p.name) : tPlayer,
          slug: p?.slug,
          photoUrl: p?.photoUrl,
          teamCode: tm?.code,
          teamSlug: tm?.slug,
          teamLogo: tm?.logoUrl,
          value: valFmt(s),
          sub: subFmt(s),
        };
      });

  const getGameDateStr = (g: any) => (g?.gameDate ? formatRecordDate(new Date(g.gameDate), lang) : g?.season ?? "");

  const gameGoalsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => b.goals - a.goals || b.points - a.points, (s) => s.goals > 0, (s) => `${s.goals} G ${tInGame}`, (s) => `${s.game.season} (${getGameDateStr(s.game)}) · ${s.points} PTS`);
  const gameAssistsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => b.assists - a.assists || b.points - a.points, (s) => s.assists > 0, (s) => `${s.assists} A ${tInGame}`, (s) => `${s.game.season} (${getGameDateStr(s.game)}) · ${s.points} PTS`);
  const gamePointsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => b.points - a.points || b.goals - a.goals, (s) => s.points > 0, (s) => `${s.points} PTS ${tInGame}`, (s) => `${s.goals}G + ${s.assists}A · ${s.game.season} (${getGameDateStr(s.game)})`);
  const gamePimLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => b.pim - a.pim, (s) => s.pim > 0, (s) => `${s.pim} ${tPim} ${tInGame}`, (s) => `${s.game.season} (${getGameDateStr(s.game)})`);
  const gamePlusMinusBestLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => b.plusMinus - a.plusMinus || b.points - a.points, (s) => s.plusMinus > 0, (s) => `+${s.plusMinus} +/- ${tInGame}`, (s) => `${s.game.season} (${getGameDateStr(s.game)}) · ${s.points} PTS`);
  const gamePlusMinusWorstLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => a.plusMinus - b.plusMinus || a.points - b.points, (s) => s.plusMinus < 0, (s) => `${s.plusMinus} +/- ${tInGame}`, (s) => `${s.game.season} (${getGameDateStr(s.game)}) · ${s.points} PTS`);
  const gamePpGoalsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => (b.ppGoals ?? 0) - (a.ppGoals ?? 0) || b.goals - a.goals, (s) => (s.ppGoals ?? 0) > 0, (s) => `${s.ppGoals} PPG ${tInGame}`, (s) => `${s.goals} G ${tTotal} · ${s.game.season} (${getGameDateStr(s.game)})`);
  const gamePpAssistsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => (b.ppAssists ?? 0) - (a.ppAssists ?? 0) || b.assists - a.assists, (s) => (s.ppAssists ?? 0) > 0, (s) => `${s.ppAssists} PPA ${tInGame}`, (s) => `${s.assists} A ${tTotal} · ${s.game.season} (${getGameDateStr(s.game)})`);
  const gamePpPointsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => ((b.ppGoals ?? 0) + (b.ppAssists ?? 0)) - ((a.ppGoals ?? 0) + (a.ppAssists ?? 0)) || b.points - a.points, (s) => (s.ppGoals ?? 0) + (s.ppAssists ?? 0) > 0, (s) => `${(s.ppGoals ?? 0) + (s.ppAssists ?? 0)} PPP ${tInGame}`, (s) => `${s.ppGoals} PPG + ${s.ppAssists} PPA · ${s.game.season}`);
  const gameShGoalsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => (b.shGoals ?? 0) - (a.shGoals ?? 0) || b.goals - a.goals, (s) => (s.shGoals ?? 0) > 0, (s) => `${s.shGoals} SHG ${tInGame}`, (s) => `${s.goals} G ${tTotal} · ${s.game.season} (${getGameDateStr(s.game)})`);
  const gameShAssistsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => (b.shAssists ?? 0) - (a.shAssists ?? 0) || b.assists - a.assists, (s) => (s.shAssists ?? 0) > 0, (s) => `${s.shAssists} SHA ${tInGame}`, (s) => `${s.assists} A ${tTotal} · ${s.game.season} (${getGameDateStr(s.game)})`);
  const gameShPointsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => ((b.shGoals ?? 0) + (b.shAssists ?? 0)) - ((a.shGoals ?? 0) + (a.shAssists ?? 0)) || b.points - a.points, (s) => (s.shGoals ?? 0) + (s.shAssists ?? 0) > 0, (s) => `${(s.shGoals ?? 0) + (s.shAssists ?? 0)} SHP ${tInGame}`, (s) => `${s.shGoals} SHG + ${s.shAssists} SHA · ${s.game.season}`);

  const skaterGameSections: RecordSection[] = [
    { id: "game-goals", title: getSectionTitle("game-goals", lang, league, cupName), icon: "🎯", phase: "regular", phaseBadge: secBadgeReg, items: gameGoalsLeader },
    { id: "game-assists", title: getSectionTitle("game-assists", lang, league, cupName), icon: "🪄", phase: "regular", phaseBadge: secBadgeReg, items: gameAssistsLeader },
    { id: "game-points", title: getSectionTitle("game-points", lang, league, cupName), icon: "⭐", phase: "regular", phaseBadge: secBadgeReg, items: gamePointsLeader },
    { id: "game-pim", title: getSectionTitle("game-pim", lang, league, cupName), icon: "⏱️", phase: "regular", phaseBadge: secBadgeReg, items: gamePimLeader },
    { id: "game-plus-minus-best", title: getSectionTitle("game-plus-minus-best", lang, league, cupName), icon: "🟢", phase: "regular", phaseBadge: secBadgeReg, items: gamePlusMinusBestLeader },
    { id: "game-plus-minus-worst", title: getSectionTitle("game-plus-minus-worst", lang, league, cupName), icon: "🔴", phase: "regular", phaseBadge: secBadgeReg, items: gamePlusMinusWorstLeader },
    { id: "game-pp-goals", title: getSectionTitle("game-pp-goals", lang, league, cupName), icon: "⚡", phase: "regular", phaseBadge: secBadgeReg, items: gamePpGoalsLeader },
    { id: "game-pp-assists", title: getSectionTitle("game-pp-assists", lang, league, cupName), icon: "🏒", phase: "regular", phaseBadge: secBadgeReg, items: gamePpAssistsLeader },
    { id: "game-pp-points", title: getSectionTitle("game-pp-points", lang, league, cupName), icon: "⭐", phase: "regular", phaseBadge: secBadgeReg, items: gamePpPointsLeader },
    { id: "game-sh-goals", title: getSectionTitle("game-sh-goals", lang, league, cupName), icon: "🛡️", phase: "regular", phaseBadge: secBadgeReg, items: gameShGoalsLeader },
    { id: "game-sh-assists", title: getSectionTitle("game-sh-assists", lang, league, cupName), icon: "🧤", phase: "regular", phaseBadge: secBadgeReg, items: gameShAssistsLeader },
    { id: "game-sh-points", title: getSectionTitle("game-sh-points", lang, league, cupName), icon: "⭐", phase: "regular", phaseBadge: secBadgeReg, items: gameShPointsLeader },
  ];

  // ==========================================
  // I. PLAYOFF SKATER RECORDS (Play-off Kariéra, Sezóna, Zápas)
  // ==========================================
  // 1. Playoff Career Skaters
  const poSkCareerMap = new Map<number, SkaterCareerAcc>();
  const getPoSkAcc = (id: number): SkaterCareerAcc => {
    let acc = poSkCareerMap.get(id);
    if (!acc) {
      acc = {
        playerId: id,
        gp: 0,
        goals: 0,
        assists: 0,
        points: 0,
        shots: 0,
        pim: 0,
        plusMinus: 0,
        ppGoals: 0,
        ppAssists: 0,
        ppPoints: 0,
        shGoals: 0,
        shAssists: 0,
        shPoints: 0,
        teamId: null,
      };
      poSkCareerMap.set(id, acc);
    }
    return acc;
  };

  for (const s of archivedPlayoffSkaters) {
    const a = getPoSkAcc(s.playerId);
    a.gp += s.gp;
    a.goals += s.goals;
    a.assists += s.assists;
    a.points += s.points;
    a.pim += s.pim;
    a.plusMinus += s.plusMinus;
    a.teamId = s.teamId;
  }
  for (const s of playoffSkaterStats) {
    const a = getPoSkAcc(s.playerId);
    a.gp += 1;
    a.goals += s.goals;
    a.assists += s.assists;
    a.points += s.points;
    a.pim += s.pim;
    a.plusMinus += s.plusMinus;
    if (s.teamId) a.teamId = s.teamId;
  }

  const poSkCareerList = [...poSkCareerMap.values()];
  const secBadgePo = getRecordBadge("playoffs", lang);

  const poCareerGpLeader = poSkCareerList.filter((s) => s.gp > 0).sort((a, b) => b.gp - a.gp).slice(0, 5).map((s, idx) => ({ ...skRowItem(s, `${s.gp} GP`, `${s.goals}G + ${s.assists}A · ${s.points} PTS`), rank: idx + 1 }));
  const poCareerGoalsLeader = poSkCareerList.filter((s) => s.goals > 0).sort((a, b) => b.goals - a.goals || b.points - a.points).slice(0, 5).map((s, idx) => ({ ...skRowItem(s, `${s.goals} G`, `${s.gp} GP · ${s.points} PTS`), rank: idx + 1 }));
  const poCareerAssistsLeader = poSkCareerList.filter((s) => s.assists > 0).sort((a, b) => b.assists - a.assists || b.points - a.points).slice(0, 5).map((s, idx) => ({ ...skRowItem(s, `${s.assists} A`, `${s.gp} GP · ${s.points} PTS`), rank: idx + 1 }));
  const poCareerPointsLeader = poSkCareerList.filter((s) => s.points > 0).sort((a, b) => b.points - a.points || b.goals - a.goals).slice(0, 5).map((s, idx) => ({ ...skRowItem(s, `${s.points} PTS`, `${s.goals}G + ${s.assists}A (${s.gp} GP)`), rank: idx + 1 }));
  const poCareerPimLeader = poSkCareerList.filter((s) => s.pim > 0).sort((a, b) => b.pim - a.pim).slice(0, 5).map((s, idx) => ({ ...skRowItem(s, `${s.pim} ${tPim}`, `${s.gp} GP · ${s.points} PTS`), rank: idx + 1 }));
  const poCareerPlusMinusBestLeader = poSkCareerList.filter((s) => s.plusMinus > 0).sort((a, b) => b.plusMinus - a.plusMinus).slice(0, 5).map((s, idx) => ({ ...skRowItem(s, `+${s.plusMinus} +/-`, `${s.gp} GP · ${s.points} PTS`), rank: idx + 1 }));
  const poCareerPlusMinusWorstLeader = poSkCareerList.filter((s) => s.plusMinus < 0).sort((a, b) => a.plusMinus - b.plusMinus).slice(0, 5).map((s, idx) => ({ ...skRowItem(s, `${s.plusMinus} +/-`, `${s.gp} GP · ${s.points} PTS`), rank: idx + 1 }));

  const playoffSkaterCareerSections: RecordSection[] = [
    { id: "playoff-career-gp", title: getSectionTitle("playoff-career-gp", lang, league, cupName), icon: "🏒", phase: "playoffs", phaseBadge: secBadgePo, items: poCareerGpLeader },
    { id: "playoff-career-goals", title: getSectionTitle("playoff-career-goals", lang, league, cupName), icon: "🎯", phase: "playoffs", phaseBadge: secBadgePo, items: poCareerGoalsLeader },
    { id: "playoff-career-assists", title: getSectionTitle("playoff-career-assists", lang, league, cupName), icon: "🪄", phase: "playoffs", phaseBadge: secBadgePo, items: poCareerAssistsLeader },
    { id: "playoff-career-points", title: getSectionTitle("playoff-career-points", lang, league, cupName), icon: "⭐", phase: "playoffs", phaseBadge: secBadgePo, items: poCareerPointsLeader },
    { id: "playoff-career-pim", title: getSectionTitle("playoff-career-pim", lang, league, cupName), icon: "⏱️", phase: "playoffs", phaseBadge: secBadgePo, items: poCareerPimLeader },
    { id: "playoff-career-plus-minus-best", title: getSectionTitle("playoff-career-plus-minus-best", lang, league, cupName), icon: "🟢", phase: "playoffs", phaseBadge: secBadgePo, items: poCareerPlusMinusBestLeader },
    { id: "playoff-career-plus-minus-worst", title: getSectionTitle("playoff-career-plus-minus-worst", lang, league, cupName), icon: "🔴", phase: "playoffs", phaseBadge: secBadgePo, items: poCareerPlusMinusWorstLeader },
  ];

  // 2. Playoff Single Season / Run Skaters
  const poSeasonSkaterMap = new Map<string, SeasonSkaterAcc>();
  for (const s of archivedPlayoffSkaters) {
    const key = `${s.playerId}::${s.season}`;
    if (!poSeasonSkaterMap.has(key)) {
      poSeasonSkaterMap.set(key, {
        playerId: s.playerId,
        season: s.season,
        teamIds: new Set(),
        gp: 0,
        goals: 0,
        assists: 0,
        points: 0,
        pim: 0,
        plusMinus: 0,
        ppGoals: 0,
        ppAssists: 0,
        ppPoints: 0,
        shGoals: 0,
        shAssists: 0,
        shPoints: 0,
      });
    }
    const acc = poSeasonSkaterMap.get(key)!;
    acc.gp += s.gp;
    acc.goals += s.goals;
    acc.assists += s.assists;
    acc.points += s.points;
    acc.pim += s.pim;
    acc.plusMinus += s.plusMinus;
    if (s.teamId) acc.teamIds.add(s.teamId);
  }
  for (const s of playoffSkaterStats) {
    const season = s.game.season;
    const key = `${s.playerId}::${season}`;
    if (!poSeasonSkaterMap.has(key)) {
      poSeasonSkaterMap.set(key, {
        playerId: s.playerId,
        season,
        teamIds: new Set(),
        gp: 0,
        goals: 0,
        assists: 0,
        points: 0,
        pim: 0,
        plusMinus: 0,
        ppGoals: 0,
        ppAssists: 0,
        ppPoints: 0,
        shGoals: 0,
        shAssists: 0,
        shPoints: 0,
      });
    }
    const acc = poSeasonSkaterMap.get(key)!;
    acc.gp += 1;
    acc.goals += s.goals;
    acc.assists += s.assists;
    acc.points += s.points;
    acc.pim += s.pim;
    acc.plusMinus += s.plusMinus;
    if (s.teamId) acc.teamIds.add(s.teamId);
  }

  const allPoSeasonSkaters = [...poSeasonSkaterMap.values()];

  const poSeasonGoalsLeader = buildSeasonSkaterLeader(allPoSeasonSkaters, (a, b) => b.goals - a.goals || b.points - a.points, (s) => s.goals > 0, (s) => `${s.goals} G`, (s) => `${tPlayoffs} ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const poSeasonAssistsLeader = buildSeasonSkaterLeader(allPoSeasonSkaters, (a, b) => b.assists - a.assists || b.points - a.points, (s) => s.assists > 0, (s) => `${s.assists} A`, (s) => `${tPlayoffs} ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const poSeasonPointsLeader = buildSeasonSkaterLeader(allPoSeasonSkaters, (a, b) => b.points - a.points || b.goals - a.goals, (s) => s.points > 0, (s) => `${s.points} PTS`, (s) => `${tPlayoffs} ${s.season} · ${s.goals}G + ${s.assists}A (${s.gp} GP)`);
  const poSeasonPimLeader = buildSeasonSkaterLeader(allPoSeasonSkaters, (a, b) => b.pim - a.pim, (s) => s.pim > 0, (s) => `${s.pim} ${tPim}`, (s) => `${tPlayoffs} ${s.season} · ${s.gp} GP`);
  const poSeasonPlusMinusBestLeader = buildSeasonSkaterLeader(allPoSeasonSkaters, (a, b) => b.plusMinus - a.plusMinus || b.points - a.points, (s) => s.plusMinus > 0, (s) => `+${s.plusMinus} +/-`, (s) => `${tPlayoffs} ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const poSeasonPlusMinusWorstLeader = buildSeasonSkaterLeader(allPoSeasonSkaters, (a, b) => a.plusMinus - b.plusMinus || a.points - b.points, (s) => s.plusMinus < 0, (s) => `${s.plusMinus} +/-`, (s) => `${tPlayoffs} ${s.season} · ${s.points} PTS (${s.gp} GP)`);

  const playoffSkaterSeasonSections: RecordSection[] = [
    { id: "playoff-season-goals", title: getSectionTitle("playoff-season-goals", lang, league, cupName), icon: "🎯", phase: "playoffs", phaseBadge: secBadgePo, items: poSeasonGoalsLeader },
    { id: "playoff-season-assists", title: getSectionTitle("playoff-season-assists", lang, league, cupName), icon: "🪄", phase: "playoffs", phaseBadge: secBadgePo, items: poSeasonAssistsLeader },
    { id: "playoff-season-points", title: getSectionTitle("playoff-season-points", lang, league, cupName), icon: "⭐", phase: "playoffs", phaseBadge: secBadgePo, items: poSeasonPointsLeader },
    { id: "playoff-season-pim", title: getSectionTitle("playoff-season-pim", lang, league, cupName), icon: "⏱️", phase: "playoffs", phaseBadge: secBadgePo, items: poSeasonPimLeader },
    { id: "playoff-season-plus-minus-best", title: getSectionTitle("playoff-season-plus-minus-best", lang, league, cupName), icon: "🟢", phase: "playoffs", phaseBadge: secBadgePo, items: poSeasonPlusMinusBestLeader },
    { id: "playoff-season-plus-minus-worst", title: getSectionTitle("playoff-season-plus-minus-worst", lang, league, cupName), icon: "🔴", phase: "playoffs", phaseBadge: secBadgePo, items: poSeasonPlusMinusWorstLeader },
  ];

  // 3. Playoff Single Game Skaters
  const poGameGoalsLeader = buildGameSkaterLeader(playoffSkaterStats, (a, b) => b.goals - a.goals || b.points - a.points, (s) => s.goals > 0, (s) => `${s.goals} G ${tInGamePo}`, (s) => `${s.game.season} (${getGameDateStr(s.game)}) · ${s.points} PTS`);
  const poGameAssistsLeader = buildGameSkaterLeader(playoffSkaterStats, (a, b) => b.assists - a.assists || b.points - a.points, (s) => s.assists > 0, (s) => `${s.assists} A ${tInGamePo}`, (s) => `${s.game.season} (${getGameDateStr(s.game)}) · ${s.points} PTS`);
  const poGamePointsLeader = buildGameSkaterLeader(playoffSkaterStats, (a, b) => b.points - a.points || b.goals - a.goals, (s) => s.points > 0, (s) => `${s.points} PTS ${tInGamePo}`, (s) => `${s.goals}G + ${s.assists}A · ${s.game.season} (${getGameDateStr(s.game)})`);
  const poGamePimLeader = buildGameSkaterLeader(playoffSkaterStats, (a, b) => b.pim - a.pim, (s) => s.pim > 0, (s) => `${s.pim} ${tPim} ${tInGamePo}`, (s) => `${s.game.season} (${getGameDateStr(s.game)})`);
  const poGamePlusMinusBestLeader = buildGameSkaterLeader(playoffSkaterStats, (a, b) => b.plusMinus - a.plusMinus || b.points - a.points, (s) => s.plusMinus > 0, (s) => `+${s.plusMinus} +/- ${tInGamePo}`, (s) => `${s.game.season} (${getGameDateStr(s.game)}) · ${s.points} PTS`);
  const poGamePlusMinusWorstLeader = buildGameSkaterLeader(playoffSkaterStats, (a, b) => a.plusMinus - b.plusMinus || a.points - b.points, (s) => s.plusMinus < 0, (s) => `${s.plusMinus} +/- ${tInGamePo}`, (s) => `${s.game.season} (${getGameDateStr(s.game)}) · ${s.points} PTS`);

  const playoffSkaterGameSections: RecordSection[] = [
    { id: "playoff-game-goals", title: getSectionTitle("playoff-game-goals", lang, league, cupName), icon: "🎯", phase: "playoffs", phaseBadge: secBadgePo, items: poGameGoalsLeader },
    { id: "playoff-game-assists", title: getSectionTitle("playoff-game-assists", lang, league, cupName), icon: "🪄", phase: "playoffs", phaseBadge: secBadgePo, items: poGameAssistsLeader },
    { id: "playoff-game-points", title: getSectionTitle("playoff-game-points", lang, league, cupName), icon: "⭐", phase: "playoffs", phaseBadge: secBadgePo, items: poGamePointsLeader },
    { id: "playoff-game-pim", title: getSectionTitle("playoff-game-pim", lang, league, cupName), icon: "⏱️", phase: "playoffs", phaseBadge: secBadgePo, items: poGamePimLeader },
    { id: "playoff-game-plus-minus-best", title: getSectionTitle("playoff-game-plus-minus-best", lang, league, cupName), icon: "🟢", phase: "playoffs", phaseBadge: secBadgePo, items: poGamePlusMinusBestLeader },
    { id: "playoff-game-plus-minus-worst", title: getSectionTitle("playoff-game-plus-minus-worst", lang, league, cupName), icon: "🔴", phase: "playoffs", phaseBadge: secBadgePo, items: poGamePlusMinusWorstLeader },
  ];

  // Playoff Career Wins from real playoff goalie stats
  const playoffGoalieAcc = new Map<number, { playerId: number; teamId: number | null; gp: number; wins: number; saves: number; shutouts: number }>();
  for (const g of playoffGoalieStats) {
    if (!playoffGoalieAcc.has(g.playerId)) {
      playoffGoalieAcc.set(g.playerId, { playerId: g.playerId, teamId: g.teamId, gp: 0, wins: 0, saves: 0, shutouts: 0 });
    }
    const acc = playoffGoalieAcc.get(g.playerId)!;
    acc.gp += 1;
    if (g.decision === "W") acc.wins += 1;
    acc.saves += g.saves;
    if (g.goalsAgainst === 0) acc.shutouts += 1;
    if (g.teamId) acc.teamId = g.teamId;
  }

  const playoffCareerWins: LeaderItem[] = [...playoffGoalieAcc.values()]
    .filter((g) => g.wins > 0)
    .sort((a, b) => b.wins - a.wins || b.saves - a.saves)
    .slice(0, 5)
    .map((g, idx) => {
      const p = playerMap.get(g.playerId);
      return {
        rank: idx + 1,
        name: p ? cleanName(p.name) : tGoalie,
        slug: p?.slug,
        photoUrl: p?.photoUrl,
        hideTeam: true,
        value: `${g.wins} W`,
        sub: `${g.gp} GP · ${g.shutouts} SO`,
      };
    });

  // Goalie Regular Season Career Records
  const careerWinsItems = topGoalies((g) => g.wins, (g) => `${g.wins} W`, (g) => `${g.gp} GP · ${g.shutouts} SO`);
  const careerStealsItems = topGoalies((g) => g.steals, (g) => `${g.steals} STL`, (g) => `${g.wins} W · ${g.gp} GP`);
  const careerGsaxItems = topGoalies((g) => g.gsax, (g) => (g.gsax > 0 ? `+${g.gsax.toFixed(1)} GSAx` : `${g.gsax.toFixed(1)} GSAx`), (g) => `${g.gp} GP · ${g.goalsAgainst} GA`);
  const careerShutoutsItems = topGoalies((g) => g.shutouts, (g) => `${g.shutouts} SO`, (g) => `${g.gp} GP · ${g.wins} W`);

  const goalieCareerSections: RecordSection[] = [
    { id: "career-wins", title: getSectionTitle("career-wins", lang, league, cupName), icon: "🧤", phase: "regular", phaseBadge: secBadgeReg, items: careerWinsItems },
    { id: "career-steals", title: getSectionTitle("career-steals", lang, league, cupName), icon: "🥷", phase: "regular", phaseBadge: secBadgeReg, items: careerStealsItems },
    { id: "career-gsax", title: getSectionTitle("career-gsax", lang, league, cupName), icon: "📊", phase: "regular", phaseBadge: secBadgeReg, items: careerGsaxItems },
    { id: "career-shutouts", title: getSectionTitle("career-shutouts", lang, league, cupName), icon: "🧱", phase: "regular", phaseBadge: secBadgeReg, items: careerShutoutsItems },
  ];

  // ==========================================
  // E. ATTENDANCE & GAME RECORDS (Návštevnosť a zápasy)
  // ==========================================
  const nonPreGames = allFinalGames.filter((g) => !g.season.endsWith("-PRE") && g.season !== PRE_SEASON);
  const gamesWithAtt = nonPreGames.filter((g) => (g.attendance ?? 0) > 0);

  const highestAttGames: LeaderItem[] = [...gamesWithAtt]
    .sort((a, b) => (b.attendance ?? 0) - (a.attendance ?? 0))
    .slice(0, 5)
    .map((g, idx) => {
      const home = teamById.get(g.homeTeamId);
      const away = teamById.get(g.awayTeamId);
      const dateStr = g.gameDate ? formatRecordDate(new Date(g.gameDate), lang) : g.season;
      const numFmt = (g.attendance ?? 0).toLocaleString(lang === "cs" ? "sk-SK" : lang === "de" ? "de-DE" : lang === "ru" ? "ru-RU" : "en-US");
      const unitFans = lang === "cs" ? "divákov" : lang === "de" ? "Zuschauer" : lang === "ru" ? "зрителей" : "fans";
      return {
        rank: idx + 1,
        name: `${home?.code ?? home?.name ?? tHome} vs ${away?.code ?? away?.name ?? tAway}`,
        teamCode: home?.code,
        teamSlug: home?.slug,
        teamLogo: home?.logoUrl,
        hideTeam: true,
        value: `${numFmt} ${unitFans}`,
        sub: `${g.season} · ${dateStr} · ${tScore}: ${g.homeGoals}:${g.awayGoals}`,
      };
    });

  const lowestAttGames: LeaderItem[] = [...gamesWithAtt]
    .sort((a, b) => (a.attendance ?? 0) - (b.attendance ?? 0))
    .slice(0, 5)
    .map((g, idx) => {
      const home = teamById.get(g.homeTeamId);
      const away = teamById.get(g.awayTeamId);
      const dateStr = g.gameDate ? formatRecordDate(new Date(g.gameDate), lang) : g.season;
      const numFmt = (g.attendance ?? 0).toLocaleString(lang === "cs" ? "sk-SK" : lang === "de" ? "de-DE" : lang === "ru" ? "ru-RU" : "en-US");
      const unitFans = lang === "cs" ? "divákov" : lang === "de" ? "Zuschauer" : lang === "ru" ? "зрителей" : "fans";
      return {
        rank: idx + 1,
        name: `${home?.code ?? home?.name ?? tHome} vs ${away?.code ?? away?.name ?? tAway}`,
        teamCode: home?.code,
        teamSlug: home?.slug,
        teamLogo: home?.logoUrl,
        hideTeam: true,
        value: `${numFmt} ${unitFans}`,
        sub: `${g.season} · ${dateStr} · ${tScore}: ${g.homeGoals}:${g.awayGoals}`,
      };
    });

  type TeamSeasonAtt = { teamId: number; season: string; totalAtt: number; games: number };
  const teamSeasonAttMap = new Map<string, TeamSeasonAtt>();

  for (const g of gamesWithAtt) {
    const key = `${g.homeTeamId}::${g.season}`;
    if (!teamSeasonAttMap.has(key)) {
      teamSeasonAttMap.set(key, { teamId: g.homeTeamId, season: g.season, totalAtt: 0, games: 0 });
    }
    const acc = teamSeasonAttMap.get(key)!;
    acc.totalAtt += g.attendance ?? 0;
    acc.games += 1;
  }

  const teamSeasonAttList = [...teamSeasonAttMap.values()]
    .filter((entry) => entry.games >= 2)
    .map((entry) => ({
      ...entry,
      avg: Math.round(entry.totalAtt / entry.games),
    }));

  const unitPerGame = lang === "cs" ? "/ zápas" : lang === "de" ? "/ Spiel" : lang === "ru" ? "/ матч" : "/ game";
  const unitHomeGames = lang === "cs" ? "domácich zápasov" : lang === "de" ? "Heimspiele" : lang === "ru" ? "домашних матчей" : "home games";

  const highestAvgAtt: LeaderItem[] = [...teamSeasonAttList]
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5)
    .map((entry, idx) => {
      const tm = teamById.get(entry.teamId);
      const numFmt = entry.avg.toLocaleString(lang === "cs" ? "sk-SK" : lang === "de" ? "de-DE" : lang === "ru" ? "ru-RU" : "en-US");
      return {
        rank: idx + 1,
        name: tm?.name ?? tTeam,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${numFmt} ${unitPerGame}`,
        sub: `${tSeason} ${entry.season} (${entry.games} ${unitHomeGames})`,
      };
    });

  const lowestAvgAtt: LeaderItem[] = [...teamSeasonAttList]
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 5)
    .map((entry, idx) => {
      const tm = teamById.get(entry.teamId);
      const numFmt = entry.avg.toLocaleString(lang === "cs" ? "sk-SK" : lang === "de" ? "de-DE" : lang === "ru" ? "ru-RU" : "en-US");
      return {
        rank: idx + 1,
        name: tm?.name ?? tTeam,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${numFmt} ${unitPerGame}`,
        sub: `${tSeason} ${entry.season} (${entry.games} ${unitHomeGames})`,
      };
    });

  const unitGoals = lang === "cs" ? "gólov" : lang === "de" ? "Tore" : lang === "ru" ? "голов" : "goals";

  const highestScoringGames: LeaderItem[] = [...nonPreGames]
    .map((g) => ({
      g,
      totalGoals: (g.homeGoals ?? 0) + (g.awayGoals ?? 0),
    }))
    .filter((x) => x.totalGoals > 0)
    .sort((a, b) => b.totalGoals - a.totalGoals)
    .slice(0, 5)
    .map(({ g, totalGoals }, idx) => {
      const home = teamById.get(g.homeTeamId);
      const away = teamById.get(g.awayTeamId);
      const dateStr = g.gameDate ? formatRecordDate(new Date(g.gameDate), lang) : g.season;
      return {
        rank: idx + 1,
        name: `${home?.code ?? home?.name ?? tHome} vs ${away?.code ?? away?.name ?? tAway}`,
        teamCode: home?.code,
        teamSlug: home?.slug,
        teamLogo: home?.logoUrl,
        hideTeam: true,
        value: `${totalGoals} ${unitGoals}`,
        sub: `${tResult} ${g.homeGoals}:${g.awayGoals} · ${g.season} (${dateStr})`,
      };
    });

  const highestVictoryGames: LeaderItem[] = [...nonPreGames]
    .map((g) => {
      const hg = g.homeGoals ?? 0;
      const ag = g.awayGoals ?? 0;
      const diff = Math.abs(hg - ag);
      const winnerId = hg > ag ? g.homeTeamId : g.awayTeamId;
      const loserId = hg > ag ? g.awayTeamId : g.homeTeamId;
      const winScore = Math.max(hg, ag);
      const loseScore = Math.min(hg, ag);
      return { g, diff, winnerId, loserId, winScore, loseScore };
    })
    .filter((x) => x.diff > 0)
    .sort((a, b) => b.diff - a.diff || b.winScore - a.winScore)
    .slice(0, 5)
    .map(({ g, diff, winnerId, loserId, winScore, loseScore }, idx) => {
      const winTeam = teamById.get(winnerId);
      const loseTeam = teamById.get(loserId);
      const dateStr = g.gameDate ? formatRecordDate(new Date(g.gameDate), lang) : g.season;
      const valText =
        lang === "cs"
          ? `o ${diff} gólov (${winScore}:${loseScore})`
          : lang === "de"
          ? `um ${diff} Tore (${winScore}:${loseScore})`
          : lang === "ru"
          ? `на ${diff} голов (${winScore}:${loseScore})`
          : `by ${diff} goals (${winScore}:${loseScore})`;
      return {
        rank: idx + 1,
        name: `${winTeam?.code ?? winTeam?.name ?? tWinner} vs ${loseTeam?.code ?? loseTeam?.name ?? tLoser}`,
        teamCode: winTeam?.code,
        teamSlug: winTeam?.slug,
        teamLogo: winTeam?.logoUrl,
        hideTeam: true,
        value: valText,
        sub: `${g.season} · ${dateStr}`,
      };
    });

  // ==========================================
  // F. TEAM SEASON & STREAK RECORDS (Tímové sezónne rekordy ZČ)
  // ==========================================
  type CombinedTeamSeason = {
    teamId: number;
    season: string;
    gp: number;
    wins: number;
    losses: number;
    otl: number;
    points: number;
    gf: number;
    ga: number;
    totalLosses: number;
  };

  const teamSeasons: CombinedTeamSeason[] = archivedTeams.map((t) => ({
    teamId: t.teamId,
    season: t.season,
    gp: t.gp,
    wins: t.wins,
    losses: t.losses,
    otl: t.otl,
    points: t.points,
    gf: t.gf,
    ga: t.ga,
    totalLosses: t.losses + t.otl,
  }));

  const unitPts = lang === "cs" ? "bodov" : lang === "de" ? "Punkte" : lang === "ru" ? "очков" : "points";
  const unitLosses = lang === "cs" ? "prehier" : lang === "de" ? "Niederlagen" : lang === "ru" ? "поражений" : "losses";
  const unitGf = lang === "cs" ? "strelených gólov" : lang === "de" ? "erzielte Tore" : lang === "ru" ? "забитых голов" : "goals scored";
  const unitGa = lang === "cs" ? "inkasovaných gólov" : lang === "de" ? "Gegentore" : lang === "ru" ? "пропущенных голов" : "goals against";
  const unitGPerGame = lang === "cs" ? "G/Zápas" : lang === "de" ? "Tore/Spiel" : lang === "ru" ? "Г/Матч" : "G/Game";
  const unitGaPerGame = lang === "cs" ? "GA/Zápas" : lang === "de" ? "Gegentore/Spiel" : lang === "ru" ? "ПГ/Матч" : "GA/Game";

  const mostPointsSeason: LeaderItem[] = [...teamSeasons]
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .slice(0, 5)
    .map((t, idx) => {
      const tm = teamById.get(t.teamId);
      return {
        rank: idx + 1,
        name: tm?.name ?? tTeam,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${t.points} ${unitPts}`,
        sub: `${tSeason} ${t.season} · ${t.wins}-${t.losses}-${t.otl} (${t.gp} GP)`,
      };
    });

  const mostLossesSeason: LeaderItem[] = [...teamSeasons]
    .sort((a, b) => b.totalLosses - a.totalLosses || b.losses - a.losses)
    .slice(0, 5)
    .map((t, idx) => {
      const tm = teamById.get(t.teamId);
      return {
        rank: idx + 1,
        name: tm?.name ?? tTeam,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${t.totalLosses} ${unitLosses}`,
        sub: `${tSeason} ${t.season} (${t.losses} L + ${t.otl} OTL/SOL)`,
      };
    });

  const mostGfSeason: LeaderItem[] = [...teamSeasons]
    .sort((a, b) => b.gf - a.gf)
    .slice(0, 5)
    .map((t, idx) => {
      const tm = teamById.get(t.teamId);
      const perGame = t.gp > 0 ? (t.gf / t.gp).toFixed(2) : "0.00";
      return {
        rank: idx + 1,
        name: tm?.name ?? tTeam,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${t.gf} ${unitGf}`,
        sub: `${tSeason} ${t.season} (${perGame} ${unitGPerGame})`,
      };
    });

  const mostGaSeason: LeaderItem[] = [...teamSeasons]
    .sort((a, b) => b.ga - a.ga)
    .slice(0, 5)
    .map((t, idx) => {
      const tm = teamById.get(t.teamId);
      const perGame = t.gp > 0 ? (t.ga / t.gp).toFixed(2) : "0.00";
      return {
        rank: idx + 1,
        name: tm?.name ?? tTeam,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${t.ga} ${unitGa}`,
        sub: `${tSeason} ${t.season} (${perGame} ${unitGaPerGame})`,
      };
    });

  const teamSeasonPimMap = new Map<string, { teamId: number; season: string; pim: number }>();
  for (const s of archivedSkaters) {
    const key = `${s.teamId}::${s.season}`;
    if (!teamSeasonPimMap.has(key)) teamSeasonPimMap.set(key, { teamId: s.teamId, season: s.season, pim: 0 });
    teamSeasonPimMap.get(key)!.pim += s.pim;
  }
  for (const s of regSkaterStats) {
    if (!s.teamId) continue;
    const season = s.game.season;
    const key = `${s.teamId}::${season}`;
    if (!teamSeasonPimMap.has(key)) teamSeasonPimMap.set(key, { teamId: s.teamId, season, pim: 0 });
    teamSeasonPimMap.get(key)!.pim += s.pim;
  }

  const mostPimSeason: LeaderItem[] = [...teamSeasonPimMap.values()]
    .sort((a, b) => b.pim - a.pim)
    .slice(0, 5)
    .map((entry, idx) => {
      const tm = teamById.get(entry.teamId);
      return {
        rank: idx + 1,
        name: tm?.name ?? tTeam,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${entry.pim} ${tPim}`,
        sub: `${tSeason} ${entry.season}`,
      };
    });

  const unitWinsStreak = lang === "cs" ? "výhier v rade" : lang === "de" ? "Siege in Folge" : lang === "ru" ? "побед подряд" : "consecutive wins";
  const unitLossesStreak = lang === "cs" ? "prehier v rade" : lang === "de" ? "Niederlagen in Folge" : lang === "ru" ? "поражений подряд" : "consecutive losses";

  const teamWinStreaks: LeaderItem[] = [];
  const teamLoseStreaks: LeaderItem[] = [];

  for (const team of allTeams) {
    const teamGames = regularGames.filter((g) => g.homeTeamId === team.id || g.awayTeamId === team.id);
    if (!teamGames.length) continue;

    let maxWinStreak = 0;
    let curWinStreak = 0;
    let winStartGame = "";
    let winEndGame = "";
    let curWinStart = "";

    let maxLoseStreak = 0;
    let curLoseStreak = 0;
    let loseStartGame = "";
    let loseEndGame = "";
    let curLoseStart = "";

    for (let i = 0; i < teamGames.length; i++) {
      const g = teamGames[i];
      const isWon = g.winnerTeamId === team.id;
      const gameLabel = `${g.season} (Z${g.round ?? i + 1})`;

      if (isWon) {
        if (curWinStreak === 0) curWinStart = gameLabel;
        curWinStreak++;
        if (curWinStreak > maxWinStreak) {
          maxWinStreak = curWinStreak;
          winStartGame = curWinStart;
          winEndGame = gameLabel;
        }
      } else {
        curWinStreak = 0;
      }

      if (!isWon) {
        if (curLoseStreak === 0) curLoseStart = gameLabel;
        curLoseStreak++;
        if (curLoseStreak > maxLoseStreak) {
          maxLoseStreak = curLoseStreak;
          loseStartGame = curLoseStart;
          loseEndGame = gameLabel;
        }
      } else {
        curLoseStreak = 0;
      }
    }

    if (maxWinStreak > 0) {
      teamWinStreaks.push({
        rank: 1,
        name: team.name,
        teamCode: team.code,
        teamSlug: team.slug,
        teamLogo: team.logoUrl,
        value: `${maxWinStreak} ${unitWinsStreak}`,
        sub: winStartGame === winEndGame ? winStartGame : `${winStartGame} → ${winEndGame}`,
        rawVal: maxWinStreak,
      } as any);
    }

    if (maxLoseStreak > 0) {
      teamLoseStreaks.push({
        rank: 1,
        name: team.name,
        teamCode: team.code,
        teamSlug: team.slug,
        teamLogo: team.logoUrl,
        value: `${maxLoseStreak} ${unitLossesStreak}`,
        sub: loseStartGame === loseEndGame ? loseStartGame : `${loseStartGame} → ${loseEndGame}`,
        rawVal: maxLoseStreak,
      } as any);
    }
  }

  teamWinStreaks.sort((a, b) => (b as any).rawVal - (a as any).rawVal);
  teamWinStreaks.splice(5);
  teamWinStreaks.forEach((item, idx) => { item.rank = idx + 1; });

  teamLoseStreaks.sort((a, b) => (b as any).rawVal - (a as any).rawVal);
  teamLoseStreaks.splice(5);
  teamLoseStreaks.forEach((item, idx) => { item.rank = idx + 1; });

  // ==========================================
  // G. AGE RECORDS (Vekové rekordy)
  // ==========================================
  const now = new Date();
  const playerAges = allPlayersWithBirth
    .map((p) => {
      const age = calculateAge(p.birthDate, now, p.age, lang);
      if (!age || age.years < 15 || age.years > 65) return null;
      return {
        p,
        age,
        totalDays: age.years * 365 + age.days,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const youngestPlayers: LeaderItem[] = [...playerAges]
    .sort((a, b) => a.totalDays - b.totalDays)
    .slice(0, 5)
    .map(({ p, age }, idx) => {
      const tm = p.teamId ? teamById.get(p.teamId) : null;
      return {
        rank: idx + 1,
        name: cleanName(p.name),
        slug: p.slug,
        photoUrl: p.photoUrl,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: age.formatted,
        sub: `${tm?.name ?? tTeam} · ${tBorn} ${p.birthDate}`,
      };
    });

  const oldestPlayers: LeaderItem[] = [...playerAges]
    .sort((a, b) => b.totalDays - a.totalDays)
    .slice(0, 5)
    .map(({ p, age }, idx) => {
      const tm = p.teamId ? teamById.get(p.teamId) : null;
      return {
        rank: idx + 1,
        name: cleanName(p.name),
        slug: p.slug,
        photoUrl: p.photoUrl,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: age.formatted,
        sub: `${tm?.name ?? tTeam} · ${tBorn} ${p.birthDate}`,
      };
    });

  // ==========================================
  // H. PRE-SEASON RECORDS (Reálne dáta z prípravy)
  // ==========================================
  // 1. Preseason Standings (Real teams W-L-OTL)
  type PreTeamAcc = { teamId: number; gp: number; w: number; l: number; otl: number; points: number; gf: number; ga: number };
  const preTeamMap = new Map<number, PreTeamAcc>();
  for (const t of allTeams) {
    preTeamMap.set(t.id, { teamId: t.id, gp: 0, w: 0, l: 0, otl: 0, points: 0, gf: 0, ga: 0 });
  }

  for (const g of preGames) {
    const h = preTeamMap.get(g.homeTeamId);
    const a = preTeamMap.get(g.awayTeamId);
    const hg = g.homeGoals ?? 0;
    const ag = g.awayGoals ?? 0;
    const isOt = g.endedIn != null && g.endedIn !== "";

    if (h) {
      h.gp += 1;
      h.gf += hg;
      h.ga += ag;
      if (hg > ag) {
        h.w += 1;
        h.points += 2;
      } else if (isOt) {
        h.otl += 1;
        h.points += 1;
      } else {
        h.l += 1;
      }
    }

    if (a) {
      a.gp += 1;
      a.gf += ag;
      a.ga += hg;
      if (ag > hg) {
        a.w += 1;
        a.points += 2;
      } else if (isOt) {
        a.otl += 1;
        a.points += 1;
      } else {
        a.l += 1;
      }
    }
  }

  const preSeasonBestTeams: LeaderItem[] = [...preTeamMap.values()]
    .filter((t) => t.gp > 0)
    .sort((a, b) => b.points - a.points || b.w - a.w || (b.gf - b.ga) - (a.gf - a.ga))
    .slice(0, 5)
    .map((t, idx) => {
      const tm = teamById.get(t.teamId);
      return {
        rank: idx + 1,
        name: tm?.name ?? tTeam,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${t.points} ${unitPts} (${t.w}-${t.l}-${t.otl})`,
        sub: `${tScore} ${t.gf}:${t.ga} (${t.gp} GP · ${tPreseason} ${ACTIVE_SEASON})`,
      };
    });

  // 2. Preseason Top Scorers
  const preSkaterAcc = new Map<number, { playerId: number; teamIds: Set<number>; gp: number; goals: number; assists: number; points: number; shots: number; pim: number }>();

  for (const s of preSkaterStats) {
    if (!preSkaterAcc.has(s.playerId)) {
      preSkaterAcc.set(s.playerId, { playerId: s.playerId, teamIds: new Set(), gp: 0, goals: 0, assists: 0, points: 0, shots: 0, pim: 0 });
    }
    const acc = preSkaterAcc.get(s.playerId)!;
    acc.gp += 1;
    acc.goals += s.goals;
    acc.assists += s.assists;
    acc.points += s.points;
    acc.shots += s.shots;
    acc.pim += s.pim;
    if (s.teamId) acc.teamIds.add(s.teamId);
  }

  const preSeasonScorers: LeaderItem[] = [...preSkaterAcc.values()]
    .filter((s) => s.points > 0)
    .sort((a, b) => b.points - a.points || b.goals - a.goals)
    .slice(0, 5)
    .map((s, idx) => {
      const p = playerMap.get(s.playerId);
      const tmInfo = resolveTeams(s.teamIds, teamById);
      return {
        rank: idx + 1,
        name: p ? cleanName(p.name) : tPlayer,
        slug: p?.slug,
        photoUrl: p?.photoUrl,
        ...tmInfo,
        value: `${s.points} PTS`,
        sub: `${s.goals}G + ${s.assists}A (${s.gp} GP · ${tPreseason} ${ACTIVE_SEASON})`,
      };
    });

  const preSeasonGoals: LeaderItem[] = [...preSkaterAcc.values()]
    .filter((s) => s.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.points - a.points)
    .slice(0, 5)
    .map((s, idx) => {
      const p = playerMap.get(s.playerId);
      const tmInfo = resolveTeams(s.teamIds, teamById);
      return {
        rank: idx + 1,
        name: p ? cleanName(p.name) : tPlayer,
        slug: p?.slug,
        photoUrl: p?.photoUrl,
        ...tmInfo,
        value: `${s.goals} G`,
        sub: `${s.points} PTS (${s.gp} GP · ${tPreseason} ${ACTIVE_SEASON})`,
      };
    });

  const preSeasonAssists: LeaderItem[] = [...preSkaterAcc.values()]
    .filter((s) => s.assists > 0)
    .sort((a, b) => b.assists - a.assists || b.points - a.points)
    .slice(0, 5)
    .map((s, idx) => {
      const p = playerMap.get(s.playerId);
      const tmInfo = resolveTeams(s.teamIds, teamById);
      return {
        rank: idx + 1,
        name: p ? cleanName(p.name) : tPlayer,
        slug: p?.slug,
        photoUrl: p?.photoUrl,
        ...tmInfo,
        value: `${s.assists} A`,
        sub: `${s.points} PTS (${s.gp} GP · ${tPreseason} ${ACTIVE_SEASON})`,
      };
    });

  // 3. Preseason Single-game scoring records
  const preSingleGamePoints: LeaderItem[] = [...preSkaterStats]
    .filter((s) => s.points > 0)
    .sort((a, b) => b.points - a.points || b.goals - a.goals)
    .slice(0, 5)
    .map((s, idx) => {
      const p = playerMap.get(s.playerId);
      const tm = s.teamId ? teamById.get(s.teamId) : null;
      const dateStr = s.game?.gameDate ? formatRecordDate(new Date(s.game.gameDate), lang) : "";
      return {
        rank: idx + 1,
        name: p ? cleanName(p.name) : tPlayer,
        slug: p?.slug,
        photoUrl: p?.photoUrl,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${s.points} PTS ${tInGame}`,
        sub: `${s.goals}G + ${s.assists}A · ${dateStr}`,
      };
    });

  // 4. Preseason Goalie Saves
  const preGoalieAcc = new Map<number, { playerId: number; teamIds: Set<number>; gp: number; wins: number; saves: number; shots: number; ga: number; shutouts: number }>();

  for (const g of preGoalieStats) {
    if (!preGoalieAcc.has(g.playerId)) {
      preGoalieAcc.set(g.playerId, { playerId: g.playerId, teamIds: new Set(), gp: 0, wins: 0, saves: 0, shots: 0, ga: 0, shutouts: 0 });
    }
    const acc = preGoalieAcc.get(g.playerId)!;
    acc.gp += 1;
    if (g.decision === "W") acc.wins += 1;
    acc.saves += g.saves;
    acc.shots += g.shotsAgainst;
    acc.ga += g.goalsAgainst;
    if (g.goalsAgainst === 0) acc.shutouts += 1;
    if (g.teamId) acc.teamIds.add(g.teamId);
  }

  const unitSaves = lang === "cs" ? "zákrokov" : lang === "de" ? "Paraden" : lang === "ru" ? "сейвов" : "saves";

  const preGoalieSaves: LeaderItem[] = [...preGoalieAcc.values()]
    .filter((g) => g.saves > 0)
    .sort((a, b) => b.saves - a.saves || b.wins - a.wins)
    .slice(0, 5)
    .map((g, idx) => {
      const p = playerMap.get(g.playerId);
      const tmInfo = resolveTeams(g.teamIds, teamById);
      const svPct = g.shots > 0 ? ((g.saves / g.shots) * 100).toFixed(1) : "0.0";
      return {
        rank: idx + 1,
        name: p ? cleanName(p.name) : tGoalie,
        slug: p?.slug,
        photoUrl: p?.photoUrl,
        ...tmInfo,
        value: `${g.saves} ${unitSaves}`,
        sub: `${svPct}% SV% · ${g.wins} W (${g.gp} GP · ${tPreseason} ${ACTIVE_SEASON})`,
      };
    });

  // ==========================================
  // I. AWARDS & TROPHIES
  // ==========================================
  const awardCategoryCounts = new Map<string, Map<string, { name: string; slug?: string | null; photoUrl?: string | null; teamId?: number | null; count: number; seasons: string[] }>>();

  for (const a of seasonAwards) {
    let cat = a.category;
    if (cat === "Hart" || cat === "Hart Memorial") cat = "Hart Memorial Trophy";
    else if (cat === "Art Ross") cat = "Art Ross Trophy";
    else if (cat === "Rocket Richard") cat = "Maurice 'Rocket' Richard Trophy";
    else if (cat === "Norris" || cat === "James Norris") cat = "James Norris Memorial Trophy";
    else if (cat === "Vezina" || cat === "Vézina") cat = "Vézina Trophy";
    else if (cat === "Conn Smythe") cat = "Conn Smythe Trophy";
    else if (cat === "Ted Lindsay") cat = "Ted Lindsay Award";
    else if (cat === "Selke" || cat === "Frank J. Selke") cat = "Frank J. Selke Trophy";
    else if (cat === "Lady Byng") cat = "Lady Byng Trophy";
    else if (cat === "Plus-Minus" || cat === "NHL Plus - Minus Award") cat = "NHL Plus - Minus Award";
    else if (cat === "GM of the Year" || cat === "General Manager of the Year" || cat === "Sam Pollock") cat = "Sam Pollock Trophy (GM of the Year)";

    if (!awardCategoryCounts.has(cat)) awardCategoryCounts.set(cat, new Map());
    const catMap = awardCategoryCounts.get(cat)!;

    let winnerKey = "";
    let winnerName = "";
    let winnerSlug: string | null = null;
    let winnerPhotoUrl: string | null = null;
    let teamId = a.teamId;

    if (a.playerId) {
      winnerKey = `p_${a.playerId}`;
      const p = playerMap.get(a.playerId);
      winnerName = p ? cleanName(p.name) : cleanName(a.playerName || "—");
      winnerSlug = p?.slug ?? null;
      winnerPhotoUrl = p?.photoUrl ?? null;
      if (!teamId && p?.teamId) teamId = p.teamId;
    } else if (a.playerName) {
      winnerKey = `name_${a.playerName}`;
      winnerName = cleanName(a.playerName);
    } else if (a.teamId) {
      winnerKey = `t_${a.teamId}`;
      const tm = teamById.get(a.teamId);
      winnerName = (cat.includes("GM") || cat.includes("Pollock")) ? getTeamGm(a.teamId) : (tm?.name ?? tTeam);
    } else {
      continue;
    }

    if (!catMap.has(winnerKey)) {
      catMap.set(winnerKey, { name: winnerName, slug: winnerSlug, photoUrl: winnerPhotoUrl, teamId, count: 0, seasons: [] });
    }
    const entry = catMap.get(winnerKey)!;
    entry.count++;
    entry.seasons.push(a.season);
  }

  const buildAwardLeader = (catTitle: string, aliasKeys: string[], awardPhase: RecordPhase = "all"): RecordSection => {
    let combinedMap = new Map<string, { name: string; slug?: string | null; photoUrl?: string | null; teamId?: number | null; count: number; seasons: string[] }>();
    for (const k of aliasKeys) {
      const m = awardCategoryCounts.get(k);
      if (m) {
        for (const [key, val] of m.entries()) {
          if (!combinedMap.has(key)) {
            combinedMap.set(key, { ...val, seasons: [...val.seasons] });
          } else {
            const existing = combinedMap.get(key)!;
            existing.count += val.count;
            existing.seasons.push(...val.seasons);
          }
        }
      }
    }

    const items: LeaderItem[] = [...combinedMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((entry, idx) => {
        return {
          rank: idx + 1,
          name: entry.name,
          slug: entry.slug,
          photoUrl: entry.photoUrl,
          hideTeam: true,
          value: `${entry.count}×`,
          sub: entry.seasons.sort().join(", "),
        };
      });

    const awardBadge =
      awardPhase === "playoffs"
        ? getRecordBadge("playoffs", lang)
        : awardPhase === "pre"
        ? getRecordBadge("pre", lang)
        : getRecordBadge("regular", lang);

    return {
      id: catTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title: catTitle,
      icon: "🏵️",
      phase: awardPhase,
      phaseBadge: awardBadge,
      items,
    };
  };

  const trophySections: RecordSection[] = [
    buildAwardLeader("Hart Memorial Trophy", ["Hart Memorial Trophy", "Hart", "Hart (MVP)"], "regular"),
    buildAwardLeader("Art Ross Trophy", ["Art Ross Trophy", "Art Ross", "Art Ross (Points)"], "regular"),
    buildAwardLeader("Maurice 'Rocket' Richard Trophy", ["Maurice 'Rocket' Richard Trophy", "Rocket Richard", "Rocket Richard (Goals)"], "regular"),
    buildAwardLeader("James Norris Memorial Trophy", ["James Norris Memorial Trophy", "Norris", "Norris (Defense)"], "regular"),
    buildAwardLeader("Vézina Trophy", ["Vézina Trophy", "Vezina", "Vezina Trophy", "Vezina (Goalie)"], "regular"),
    buildAwardLeader("Conn Smythe Trophy", ["Conn Smythe Trophy", "Conn Smythe", "Conn Smythe (Playoffs)"], "playoffs"),
    buildAwardLeader("Ted Lindsay Award", ["Ted Lindsay Award", "Ted Lindsay"], "regular"),
    buildAwardLeader("Frank J. Selke Trophy", ["Frank J. Selke Trophy", "Selke", "Selke (Def. Fwd)"], "regular"),
    buildAwardLeader("Lady Byng Trophy", ["Lady Byng Trophy", "Lady Byng"], "regular"),
    buildAwardLeader("NHL Plus - Minus Award", ["NHL Plus - Minus Award", "Plus-Minus"], "regular"),
    buildAwardLeader("Sam Pollock Trophy (GM of the Year)", ["Sam Pollock Trophy (GM of the Year)", "GM of the Year", "General Manager of the Year Award"], "all"),
  ];

  // ==========================================
  // J. COMPOSE FINAL CATEGORY GROUPS
  // ==========================================
  const badgeHistory = getRecordBadge("history", lang);
  const badgeGame = getRecordBadge("game", lang);
  const badgeSeason = getRecordBadge("season", lang);
  const badgeAge = getRecordBadge("age", lang);
  const badgePre = getRecordBadge("pre", lang);

  const rawGroups: RecordCategoryGroup[] = [
    {
      id: "gm-records",
      title: getGroupTitle("gm-records", lang, cupName),
      icon: "👔",
      phase: "all",
      mainCategory: "gms",
      records: [
        {
          id: "gm-seasons-total",
          title: getSectionTitle("gm-seasons-total", lang, league, cupName),
          icon: "📅",
          phase: "all",
          phaseBadge: badgeHistory,
          items: gmSeasonsLeader,
        },
        {
          id: "gm-seasons-one-team",
          title: getSectionTitle("gm-seasons-one-team", lang, league, cupName),
          icon: "🏢",
          phase: "all",
          phaseBadge: badgeHistory,
          items: gmOneTeamLeader,
        },
        {
          id: "gm-seasons-streak",
          title: getSectionTitle("gm-seasons-streak", lang, league, cupName),
          icon: "🔥",
          phase: "all",
          phaseBadge: badgeHistory,
          items: gmStreakLeader,
        },
        {
          id: "gm-cups",
          title: getSectionTitle("gm-cups", lang, league, cupName),
          icon: "🏆",
          phase: "playoffs",
          phaseBadge: secBadgePo,
          items: gmCupLeaders,
        },
      ],
    },
    {
      id: "career-skaters",
      title: getGroupTitle("career-skaters", lang, cupName),
      icon: "🏒",
      phase: "regular",
      mainCategory: "skaters",
      records: skaterCareerSections,
    },
    {
      id: "season-skaters",
      title: getGroupTitle("season-skaters", lang, cupName),
      icon: "📅",
      phase: "regular",
      mainCategory: "skaters",
      records: skaterSeasonSections,
    },
    {
      id: "game-skaters",
      title: getGroupTitle("game-skaters", lang, cupName),
      icon: "⚡",
      phase: "regular",
      mainCategory: "skaters",
      records: skaterGameSections,
    },
    {
      id: "rookie-records",
      title: getGroupTitle("rookie-records", lang, cupName),
      icon: "👶",
      phase: "regular",
      mainCategory: "skaters",
      records: rookieSections,
    },
    {
      id: "playoff-career-skaters",
      title: getGroupTitle("playoff-career-skaters", lang, cupName),
      icon: "⭐",
      phase: "playoffs",
      mainCategory: "skaters",
      records: playoffSkaterCareerSections,
    },
    {
      id: "playoff-season-skaters",
      title: getGroupTitle("playoff-season-skaters", lang, cupName),
      icon: "🔥",
      phase: "playoffs",
      mainCategory: "skaters",
      records: playoffSkaterSeasonSections,
    },
    {
      id: "playoff-game-skaters",
      title: getGroupTitle("playoff-game-skaters", lang, cupName),
      icon: "⚡",
      phase: "playoffs",
      mainCategory: "skaters",
      records: playoffSkaterGameSections,
    },
    {
      id: "career-goalies",
      title: getGroupTitle("career-goalies", lang, cupName),
      icon: "🧤",
      phase: "regular",
      mainCategory: "goalies",
      records: goalieCareerSections,
    },
    {
      id: "championships",
      title: getGroupTitle("championships", lang, cupName),
      icon: "🏆",
      phase: "playoffs",
      mainCategory: "teams",
      records: [
        {
          id: "team-cups",
          title: getSectionTitle("team-cups", lang, league, cupName),
          icon: "🏆",
          phase: "playoffs",
          phaseBadge: secBadgePo,
          items: teamCupLeaders,
        },
        {
          id: "skater-cups",
          title: getSectionTitle("skater-cups", lang, league, cupName),
          icon: "💍",
          phase: "playoffs",
          phaseBadge: secBadgePo,
          items: skaterRingsLeader,
        },
        {
          id: "goalie-cups",
          title: getSectionTitle("goalie-cups", lang, league, cupName),
          icon: "🧤",
          phase: "playoffs",
          phaseBadge: secBadgePo,
          items: goalieRingsLeader,
        },
        {
          id: "playoff-career-wins",
          title: getSectionTitle("playoff-career-wins", lang, league, cupName),
          icon: "🧤",
          phase: "playoffs",
          phaseBadge: secBadgePo,
          items: playoffCareerWins,
        },
      ],
    },
    {
      id: "team-seasons",
      title: getGroupTitle("team-seasons", lang, cupName),
      icon: "📊",
      phase: "regular",
      mainCategory: "teams",
      records: [
        {
          id: "team-points-season",
          title: getSectionTitle("team-points-season", lang, league, cupName),
          icon: "🥇",
          phase: "regular",
          phaseBadge: secBadgeReg,
          items: mostPointsSeason,
        },
        {
          id: "team-losses-season",
          title: getSectionTitle("team-losses-season", lang, league, cupName),
          icon: "💔",
          phase: "regular",
          phaseBadge: secBadgeReg,
          items: mostLossesSeason,
        },
        {
          id: "team-win-streak",
          title: getSectionTitle("team-win-streak", lang, league, cupName),
          icon: "🔥",
          phase: "regular",
          phaseBadge: secBadgeReg,
          items: teamWinStreaks,
        },
        {
          id: "team-lose-streak",
          title: getSectionTitle("team-lose-streak", lang, league, cupName),
          icon: "🧊",
          phase: "regular",
          phaseBadge: secBadgeReg,
          items: teamLoseStreaks,
        },
        {
          id: "team-gf-season",
          title: getSectionTitle("team-gf-season", lang, league, cupName),
          icon: "🎯",
          phase: "regular",
          phaseBadge: secBadgeReg,
          items: mostGfSeason,
        },
        {
          id: "team-ga-season",
          title: getSectionTitle("team-ga-season", lang, league, cupName),
          icon: "🛡️",
          phase: "regular",
          phaseBadge: secBadgeReg,
          items: mostGaSeason,
        },
        {
          id: "team-pim-season",
          title: getSectionTitle("team-pim-season", lang, league, cupName),
          icon: "⏱️",
          phase: "regular",
          phaseBadge: secBadgeReg,
          items: mostPimSeason,
        },
      ],
    },
    {
      id: "trophies",
      title: getGroupTitle("trophies", lang, cupName),
      icon: "🏵️",
      phase: "all",
      mainCategory: "trophies",
      records: trophySections,
    },
    {
      id: "attendance-games",
      title: getGroupTitle("attendance-games", lang, cupName),
      icon: "🏟️",
      phase: "all",
      mainCategory: "games",
      records: [
        {
          id: "highest-attendance",
          title: getSectionTitle("highest-attendance", lang, league, cupName),
          icon: "👥",
          phase: "all",
          phaseBadge: badgeGame,
          items: highestAttGames,
        },
        {
          id: "lowest-attendance",
          title: getSectionTitle("lowest-attendance", lang, league, cupName),
          icon: "👤",
          phase: "all",
          phaseBadge: badgeGame,
          items: lowestAttGames,
        },
        {
          id: "highest-avg-attendance",
          title: getSectionTitle("highest-avg-attendance", lang, league, cupName),
          icon: "📈",
          phase: "all",
          phaseBadge: badgeSeason,
          items: highestAvgAtt,
        },
        {
          id: "lowest-avg-attendance",
          title: getSectionTitle("lowest-avg-attendance", lang, league, cupName),
          icon: "📉",
          phase: "all",
          phaseBadge: badgeSeason,
          items: lowestAvgAtt,
        },
        {
          id: "highest-scoring-game",
          title: getSectionTitle("highest-scoring-game", lang, league, cupName),
          icon: "🚨",
          phase: "all",
          phaseBadge: badgeGame,
          items: highestScoringGames,
        },
        {
          id: "largest-victory",
          title: getSectionTitle("largest-victory", lang, league, cupName),
          icon: "⚡",
          phase: "all",
          phaseBadge: badgeGame,
          items: highestVictoryGames,
        },
      ],
    },
    {
      id: "age-records",
      title: getGroupTitle("age-records", lang, cupName),
      icon: "🎂",
      phase: "all",
      mainCategory: "games",
      records: [
        {
          id: "youngest-player",
          title: getSectionTitle("youngest-player", lang, league, cupName),
          icon: "👶",
          phase: "all",
          phaseBadge: badgeAge,
          items: youngestPlayers,
        },
        {
          id: "oldest-player",
          title: getSectionTitle("oldest-player", lang, league, cupName),
          icon: "👴",
          phase: "all",
          phaseBadge: badgeAge,
          items: oldestPlayers,
        },
      ],
    },
    {
      id: "pre-skaters",
      title: getGroupTitle("pre-skaters", lang, cupName),
      icon: "☀️",
      phase: "pre",
      mainCategory: "skaters",
      records: [
        {
          id: "pre-top-scorer",
          title: getSectionTitle("pre-top-scorer", lang, league, cupName),
          icon: "⭐",
          phase: "pre",
          phaseBadge: badgePre,
          items: preSeasonScorers,
        },
        {
          id: "pre-goals",
          title: getSectionTitle("pre-goals", lang, league, cupName),
          icon: "🎯",
          phase: "pre",
          phaseBadge: badgePre,
          items: preSeasonGoals,
        },
        {
          id: "pre-assists",
          title: getSectionTitle("pre-assists", lang, league, cupName),
          icon: "🪄",
          phase: "pre",
          phaseBadge: badgePre,
          items: preSeasonAssists,
        },
        {
          id: "pre-single-game-pts",
          title: getSectionTitle("pre-single-game-pts", lang, league, cupName),
          icon: "⚡",
          phase: "pre",
          phaseBadge: badgePre,
          items: preSingleGamePoints,
        },
      ],
    },
    {
      id: "pre-goalies",
      title: getGroupTitle("pre-goalies", lang, cupName),
      icon: "☀️",
      phase: "pre",
      mainCategory: "goalies",
      records: [
        {
          id: "pre-goalie-saves",
          title: getSectionTitle("pre-goalie-saves", lang, league, cupName),
          icon: "🧤",
          phase: "pre",
          phaseBadge: badgePre,
          items: preGoalieSaves,
        },
      ],
    },
    {
      id: "pre-teams",
      title: getGroupTitle("pre-teams", lang, cupName),
      icon: "☀️",
      phase: "pre",
      mainCategory: "teams",
      records: [
        {
          id: "pre-best-team",
          title: getSectionTitle("pre-best-team", lang, league, cupName),
          icon: "🥇",
          phase: "pre",
          phaseBadge: badgePre,
          items: preSeasonBestTeams,
        },
      ],
    },
  ];

  // Filter groups according to the selected category and phase
  let filteredGroups = rawGroups;

  if (category !== "all") {
    filteredGroups = filteredGroups.filter((g) => g.mainCategory === category);
  }

  if (phase === "regular") {
    filteredGroups = filteredGroups
      .map((g) => ({
        ...g,
        records: g.records.filter((r) => r.phase === "regular" || r.phase === "all"),
      }))
      .filter((g) => g.records.length > 0 && g.phase !== "pre" && g.id !== "championships");
  } else if (phase === "playoffs") {
    filteredGroups = filteredGroups
      .map((g) => ({
        ...g,
        records: g.records.filter((r) => r.phase === "playoffs"),
      }))
      .filter((g) => g.records.length > 0);
  } else if (phase === "pre") {
    filteredGroups = filteredGroups
      .map((g) => ({
        ...g,
        records: g.records.filter((r) => r.phase === "pre"),
      }))
      .filter((g) => g.records.length > 0);
  }

  return {
    league,
    cupName,
    phase,
    category,
    groups: filteredGroups,
    isLiveOrPreview: seasonRecords.length === 0,
  };
}

export type RecordHolder = {
  who: string;
  slug?: string | null;
  team?: string | null;
  season?: string | null;
  detail?: string | null;
  gameId?: number | null;
  value: number | string;
};

export type OldRecordRow = { key: string; label: string; unit: string; holder: RecordHolder | null };
export type OldRecordGroup = { title: string; icon: string; rows: OldRecordRow[] };

export async function leagueRecords(): Promise<OldRecordGroup[]> {
  const data = await getLeagueRecords("NHL", "all");
  return data.groups.map((g) => ({
    title: g.title,
    icon: g.icon,
    rows: g.records.map((r) => {
      const top = r.items[0];
      return {
        key: r.id,
        label: r.title,
        unit: r.unit ?? "",
        holder: top
          ? {
              who: top.name,
              slug: top.slug,
              team: top.teamCode,
              season: top.sub,
              detail: top.extraList?.join(", "),
              value: top.value,
            }
          : null,
      };
    }),
  }));
}

export async function recordThresholds(): Promise<{ points: number; goals: number; saves: number; teamGoals: number }> {
  const [maxPts, maxSaves, maxTeamGoals] = await Promise.all([
    prisma.playerGameStat.aggregate({ _max: { points: true, goals: true } }),
    prisma.goalieGameStat.aggregate({ _max: { saves: true } }),
    prisma.game.aggregate({ _max: { homeGoals: true, awayGoals: true } }),
  ]);
  const tg = Math.max(maxTeamGoals._max.homeGoals ?? 0, maxTeamGoals._max.awayGoals ?? 0);
  return {
    points: maxPts._max.points ?? 0,
    goals: maxPts._max.goals ?? 0,
    saves: maxSaves._max.saves ?? 0,
    teamGoals: tg,
  };
}

