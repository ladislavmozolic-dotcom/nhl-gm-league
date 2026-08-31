// Lightweight i18n. A `lang` cookie selects the language; strings live in DICT keyed
// by "section.key". `t()` falls back to English, then the raw key, so a missing
// translation never crashes — it just shows English. Adding a language = add it to
// LANGS + LANG_NAMES and fill in the entries below (or leave blank → English shows).

export type Lang = "en" | "cs" | "de" | "ru";
export const LANGS: Lang[] = ["en", "cs", "de", "ru"];
export const LANG_NAMES: Record<Lang, string> = { en: "English", cs: "Čeština", de: "Deutsch", ru: "Русский" };
export const LANG_CODE: Record<Lang, string> = { en: "EN", cs: "CZ", de: "DE", ru: "RU" };
export const DEFAULT_LANG: Lang = "en";
export const LANG_COOKIE = "lang";

type Entry = Partial<Record<Lang, string>> & { en: string };
type Dict = Record<string, Entry>;

// section.key → per-language strings (en required; others optional)
export const DICT: Dict = {
  // top-nav labels (menu keys from lib/menu-config.ts)
  "menu.home": { en: "Home", cs: "Domov", de: "Start", ru: "Главная" },
  "menu.scores": { en: "Scores", cs: "Výsledky", de: "Ergebnisse", ru: "Результаты" },
  "menu.standings": { en: "Standings", cs: "Tabulka", de: "Tabelle", ru: "Таблица" },
  "menu.schedule": { en: "Schedule", cs: "Rozpis", de: "Spielplan", ru: "Расписание" },
  "menu.trades": { en: "Trades", cs: "Výměny", de: "Transfers", ru: "Обмены" },
  "menu.teams": { en: "Teams", cs: "Týmy", de: "Teams", ru: "Команды" },
  "menu.finance": { en: "Finance", cs: "Finance", de: "Finanzen", ru: "Финансы" },
  "menu.stats": { en: "Stats", cs: "Statistiky", de: "Statistiken", ru: "Статистика" },
  "menu.frenzy": { en: "Free Agent Frenzy", cs: "Volní hráči", de: "Free Agents", ru: "Свободные агенты" },
  "menu.players": { en: "Players", cs: "Hráči", de: "Spieler", ru: "Игроки" },
  "menu.league": { en: "League", cs: "Liga", de: "Liga", ru: "Лига" },
  "menu.draft": { en: "Entry Draft", cs: "Draft", de: "Draft", ru: "Драфт" },
  "menu.history": { en: "History", cs: "Historie", de: "Historie", ru: "История" },
  "menu.tools": { en: "Tools", cs: "Nástroje", de: "Werkzeuge", ru: "Инструменты" },
  "menu.ahl": { en: "AHL", cs: "AHL", de: "AHL", ru: "АХЛ" },
  // common UI
  "ui.gmLogin": { en: "GM Login", cs: "Přihlášení GM", de: "GM-Login", ru: "Вход GM" },
  "ui.myTeam": { en: "My team", cs: "Můj tým", de: "Mein Team", ru: "Моя команда" },
  "ui.profile": { en: "Profile", cs: "Profil", de: "Profil", ru: "Профиль" },
  "ui.logout": { en: "Log out", cs: "Odhlásit", de: "Abmelden", ru: "Выйти" },
  "ui.switchTeam": { en: "Switch team", cs: "Změnit tým", de: "Team wechseln", ru: "Сменить команду" },
  "ui.signedIn": { en: "Signed in", cs: "Přihlášen", de: "Angemeldet", ru: "Вы вошли" },
  "ui.admin": { en: "Admin", cs: "Admin", de: "Admin", ru: "Админ" },
  "ui.adminPanel": { en: "Admin Panel", cs: "Admin panel", de: "Admin-Panel", ru: "Админ-панель" },
  "ui.linesTactics": { en: "Lines & tactics", cs: "Sestavy & taktika", de: "Aufstellung & Taktik", ru: "Составы и тактика" },
  "ui.language": { en: "Language", cs: "Jazyk", de: "Sprache", ru: "Язык" },
  "ui.viewAll": { en: "view →", cs: "zobrazit →", de: "ansehen →", ru: "смотреть →" },
  "ui.points": { en: "points", cs: "body", de: "Punkte", ru: "очки" },
  "ui.playoffs": { en: "Playoffs", cs: "Playoff", de: "Playoffs", ru: "Плей-офф" },
  "ui.allRosters": { en: "All Rosters", cs: "Všechny soupisky", de: "Alle Kader", ru: "Все составы" },
  // Homepage
  "home.nextSim": { en: "Next Simulation", cs: "Nejbližší simulace", de: "Nächste Simulation", ru: "Следующая симуляция" },
  "home.threeStars": { en: "3 Stars of the Day", cs: "3 hvězdy dne", de: "3 Sterne des Tages", ru: "3 звезды дня" },
  "home.leagueLeader": { en: "League Leader", cs: "Lídr ligy", de: "Liga-Führender", ru: "Лидер лиги" },
  "home.tonightsBest": { en: "Tonight's Best", cs: "Nejlepší dnes", de: "Das Beste heute", ru: "Лучшее за вечер" },
  "home.storyOfNight": { en: "the story of the night →", cs: "příběh večera →", de: "die Story des Abends →", ru: "история вечера →" },
  "home.scoringLeaders": { en: "Scoring Leaders", cs: "Produktivita", de: "Scorer-Wertung", ru: "Бомбардиры" },
  "home.tradeBlock": { en: "Trade Block", cs: "Na trhu", de: "Transferliste", ru: "На обмен" },
  "home.noTradeBlock": { en: "No players on the block. GMs list players from their team's Trades page.", cs: "Žádní hráči na trhu. GM je přidávají ze stránky Výměny svého týmu.", de: "Keine Spieler auf der Liste. GMs listen Spieler über die Transfer-Seite ihres Teams.", ru: "Нет игроков на обмен. GM добавляют их со страницы обменов своей команды." },
  "home.waiverWire": { en: "Waiver Wire", cs: "Waiver wire", de: "Waiver Wire", ru: "Драфт отказов" },
  "home.noWaivers": { en: "Nobody is on waivers right now.", cs: "Momentálně nikdo není na listině waiver.", de: "Aktuell steht niemand auf der Waiver-Liste.", ru: "Сейчас никто не находится на драфте отказов." },
  "home.birthdays": { en: "Today's Birthdays", cs: "Dnešní narozeniny", de: "Heutige Geburtstage", ru: "Дни рождения сегодня" },
  "home.latestArticle": { en: "Latest Article", cs: "Poslední článek", de: "Neuester Artikel", ru: "Последняя статья" },
  "home.addArticle": { en: "+ Add Article", cs: "+ Přidat článek", de: "+ Artikel", ru: "+ Статья" },
  "home.noNews": { en: "No news yet. Sign in as a GM and write the first article.", cs: "Zatím žádné novinky. Přihlas se jako GM a napiš první článek.", de: "Noch keine News. Melde dich als GM an und schreibe den ersten Artikel.", ru: "Пока нет новостей. Войдите как GM и напишите первую статью." },
  "home.freeAgents": { en: "Free Agents", cs: "Volní hráči", de: "Free Agents", ru: "Свободные агенты" },
  "home.quickLinks": { en: "Quick Links", cs: "Rychlé odkazy", de: "Schnellzugriff", ru: "Быстрые ссылки" },
  "home.eastern": { en: "Eastern Conference", cs: "Východní konference", de: "Eastern Conference", ru: "Восточная конференция" },
  "home.western": { en: "Western Conference", cs: "Západní konference", de: "Western Conference", ru: "Западная конференция" },
  // Admin panel (en base; de/ru fall back to en)
  "admin.subtitle": { en: "League operations — schedule, simulation, finance, rosters and tools.", cs: "Prevádzka ligy — rozpis, simulácia, financie, súpisky a nástroje." },
  "admin.grpSeason": { en: "Season & Simulation", cs: "Sezóna & Simulácia" },
  "admin.grpRosters": { en: "Rosters & Players", cs: "Súpisky & Hráči" },
  "admin.grpFinance": { en: "Finance & Draft", cs: "Financie & Draft" },
  "admin.grpContent": { en: "Content & Site", cs: "Obsah & Stránka" },
  "admin.dashboard.d": { en: "Today at a glance — games ready, missing lines, pending trades — and Simulate Day.", cs: "Dnešok na jednom mieste — pripravené zápasy, chýbajúce zostavy, čakajúce trejdy — a Simulate Day." },
  "admin.season.d": { en: "Generate the schedule, play the season, run the playoffs.", cs: "Vygeneruj rozpis, odohraj sezónu, spusti playoff." },
  "admin.simulation.d": { en: "Tune goals, shots, penalties, fights, goalie fatigue, playoff format.", cs: "Ladenie gólov, striel, trestov, bitiek, únavy brankára, formátu PO." },
  "admin.calibration.d": { en: "Grade the engine against NHL targets — rates, balance, xG, EDGE, injuries.", cs: "Ohodnoť engine voči NHL cieľom — rates, balans, xG, EDGE, zranenia." },
  "admin.simGuide.d": { en: "How chemistry forms and how ratings work together — a reference guide.", cs: "Ako vzniká chémia a ako spolupracujú ratingy — referenčný sprievodca." },
  "admin.lines.d": { en: "When each GM last submitted lines before the simulation.", cs: "Kedy naposledy každý GM odovzdal zostavy pred simuláciou." },
  "admin.rosters.d": { en: "Start the season with ProfiNHL rosters or the real NHL rosters.", cs: "Začni sezónu s ProfiNHL súpiskami alebo reálnymi NHL súpiskami." },
  "admin.teamLines.d": { en: "Open any club's line editor — players, tactics, ice-time.", cs: "Otvor editor zostáv ľubovoľného klubu — hráči, taktiky, ice-time." },
  "admin.contracts.d": { en: "Edit player cap hits and contract terms.", cs: "Uprav cap hity a podmienky kontraktov hráčov." },
  "admin.trades.d": { en: "Every completed trade — revoke one to return all assets.", cs: "Všetky dokončené výmeny — revoke vráti všetky aktíva." },
  "admin.signings.d": { en: "Every UFA signing & extension — click a player for his bid trail; revert a deal.", cs: "Všetky podpisy a predĺženia — klik na hráča ukáže priebeh ponúk; revert vráti zmluvu." },
  "admin.positions.d": { en: "Find a player and add/remove positions and shooting side.", cs: "Nájdi hráča a pridaj/odober pozície a stranu strely." },
  "admin.ratings.d": { en: "Find a player and tune his ratings (OV, SC, PA…) — the sim reflects them.", cs: "Nájdi hráča a nalaď jeho ratingy (OV, SC, PA…) — sim ich odzrkadlí." },
  "admin.conditions.d": { en: "Track conditional trades; trigger settlement once conditions are met.", cs: "Sleduj podmienené trejdy; spusti vyrovnanie po splnení podmienok." },
  "admin.finance.d": { en: "Set popularity — drives attendance and ticket revenue.", cs: "Nastav popularitu — poháňa návštevnosť a príjmy zo vstupného." },
  "admin.lottery.d": { en: "Draw the NHL-style lottery (16 non-playoff clubs, 2 weighted picks).", cs: "Vyžrebuj NHL-štýl lotériu (16 nepostupujúcich, 2 vážené picky)." },
  "admin.realDrafts.d": { en: "Load real NHL drafts (2019+) into real-roster Draft History.", cs: "Nahraj reálne NHL drafty (2019+) do real-roster Draft History." },
  "admin.siteEditor.d": { en: "Customize the site — branding, theme & colours, menu, homepage, custom pages.", cs: "Prispôsob stránku — branding, téma & farby, menu, domovská stránka, vlastné stránky." },
  "admin.announcements.d": { en: "Post a league-wide message — reaches every GM and the home page.", cs: "Zverejni správu pre celú ligu — dorazí každému GM aj na domovskú stránku." },
  "admin.awards.d": { en: "Open/close the award ballot, watch the tally, resolve winners.", cs: "Otvor/zatvor hlasovanie o cenách, sleduj priebeh, vyhlás víťazov." },
  "admin.logins.d": { en: "All sign-ins & visits — who, IP, and roughly where.", cs: "Kto sa prihlásil, z akej IP a približne odkiaľ." },
  // Team sub-nav
  "team.home": { en: "Home", cs: "Domov", de: "Start", ru: "Главная" },
  "team.roster": { en: "Roster", cs: "Soupiska", de: "Kader", ru: "Состав" },
  "team.lines": { en: "Lines", cs: "Sestavy", de: "Aufstellung", ru: "Составы" },
  "team.system": { en: "System", cs: "Systém", de: "System", ru: "Система" },
  "team.schedule": { en: "Schedule", cs: "Rozpis", de: "Spielplan", ru: "Расписание" },
  "team.scores": { en: "Scores", cs: "Výsledky", de: "Ergebnisse", ru: "Результаты" },
  "team.statistics": { en: "Statistics", cs: "Statistiky", de: "Statistiken", ru: "Статистика" },
  "team.nhlTeam": { en: "NHL Team", cs: "NHL tým", de: "NHL-Team", ru: "Клуб НХЛ" },
  "team.rosterMoves": { en: "Roster Moves", cs: "Změny soupisky", de: "Kaderänderungen", ru: "Изменения состава" },
  "team.contracts": { en: "Contracts", cs: "Kontrakty", de: "Verträge", ru: "Контракты" },
  "team.freeAgents": { en: "Free Agents", cs: "Volní hráči", de: "Free Agents", ru: "Свободные агенты" },
  "team.teamContracts": { en: "Team Contracts", cs: "Kontrakty týmu", de: "Team-Verträge", ru: "Контракты команды" },
  "team.salaryCap": { en: "Salary Cap", cs: "Platový strop", de: "Gehaltsobergrenze", ru: "Потолок зарплат" },
  "team.finance": { en: "Finance", cs: "Finance", de: "Finanzen", ru: "Финансы" },
  "team.overviewBank": { en: "Overview (bank)", cs: "Přehled (banka)", de: "Übersicht (Bank)", ru: "Обзор (банк)" },
  "team.dashboardControls": { en: "Dashboard & controls", cs: "Dashboard & ovládání", de: "Dashboard & Steuerung", ru: "Панель и управление" },
  "team.trades": { en: "Trades", cs: "Výměny", de: "Transfers", ru: "Обмены" },
  "team.tradeBlock": { en: "Trade Block", cs: "Na trhu", de: "Transferliste", ru: "На обмен" },
  "team.prospects": { en: "Prospects", cs: "Talenty", de: "Talente", ru: "Проспекты" },
  "team.draftPicks": { en: "Draft Picks", cs: "Draftové volby", de: "Draft-Picks", ru: "Драфт-пики" },
  "team.rivals": { en: "Rivals", cs: "Rivalové", de: "Rivalen", ru: "Соперники" },
  "team.farm": { en: "Farm", cs: "Farma", de: "Farmteam", ru: "Фарм" },
  "team.history": { en: "History", cs: "Historie", de: "Historie", ru: "История" },
  "team.dna": { en: "Team DNA", cs: "DNA týmu", de: "Team-DNA", ru: "ДНК команды" },
  "team.depthChart": { en: "Depth Chart", cs: "Hloubka kádru", de: "Kadertiefe", ru: "Глубина состава" },
  "team.injuries": { en: "Injuries", cs: "Zranění", de: "Verletzungen", ru: "Травмы" },
  // Team System / Tactics editor (en base; de/ru fall back to en)
  "sys.identity": { en: "Your team's identity.", cs: "Identita tvojho tímu." },
  "sys.intro1": { en: "Pick four dials (or a ready-made preset). Every dial has an upside and a real cost.", cs: "Vyber štyri nastavenia (alebo hotový preset). Každé má výhodu aj reálnu cenu." },
  "sys.fitName": { en: "System Fit", cs: "Súlad systému" },
  "sys.intro2": { en: "is the key: benefits scale with how well your roster suits the system, but the costs (fatigue, penalties, shots against) apply no matter what — so force a system your players can't run and you pay the price for little reward. A good coach (high EX) helps execute it.", cs: "je kľúč: výhody rastú s tým, ako sedí kádru systém, ale náklady (únava, tresty, strely proti) platia vždy — takže vynútiť systém, ktorý hráči nezvládajú, znamená platiť za málo úžitku. Dobrý tréner (vysoké EX) pomáha s realizáciou." },
  "sys.balancedNote": { en: "All-Balanced = no effect, play it straight.", cs: "Všetko na Vyvážené = žiadny efekt, hraj priamo." },
  "sys.presets": { en: "Presets", cs: "Presety" },
  "sys.presetsHint": { en: "— one-click ready systems", cs: "— hotové systémy na jeden klik" },
  "sys.hintTempo": { en: "How fast you play — pace of the game", cs: "Ako rýchlo hráš — tempo hry" },
  "sys.hintForecheck": { en: "How hard you pressure the puck in the offensive & neutral zones", cs: "Ako tvrdo napádaš puk v útočnom a strednom pásme" },
  "sys.hintPuck": { en: "How your offence generates chances", cs: "Ako útok vytvára šance" },
  "sys.hintDzone": { en: "How you defend your own end", cs: "Ako brániš vlastné pásmo" },
  "sys.dTempo": { en: "Tempo", cs: "Tempo" },
  "sys.dForecheck": { en: "Forecheck", cs: "Forček" },
  "sys.dPuck": { en: "Puck Style", cs: "Štýl s pukom" },
  "sys.dDzone": { en: "D-Zone", cs: "Obranné pásmo" },
  "sys.fitDesc": { en: "How well your roster suits the chosen dials (100 = neutral). Higher = your players fit; lower = they don't.", cs: "Ako sedí kádru zvolené nastavenie (100 = neutrál). Vyššie = hráči sedia; nižšie = nesedia." },
  "sys.projected": { en: "Projected effect", cs: "Očakávaný efekt" },
  "sys.projectedHint": { en: "— vs a balanced system", cs: "— voči vyváženému systému" },
  "sys.chipShotVol": { en: "Your shot volume", cs: "Tvoj objem striel" },
  "sys.chipShotsAgainst": { en: "Shots against", cs: "Strely proti" },
  "sys.chipChanceQ": { en: "Your chance quality", cs: "Kvalita tvojich šancí" },
  "sys.chipOppChanceQ": { en: "Opponent chance quality", cs: "Kvalita šancí súpera" },
  "sys.chipForecheck": { en: "Forechecking pressure", cs: "Forčekový tlak" },
  "sys.chipFatigue": { en: "Fatigue", cs: "Únava" },
  "sys.chipPenalties": { en: "Penalties taken", cs: "Vylúčenia" },
  "sys.effectLegend": { en: "Green = helps you, red = hurts you. Hover a row for what it means.", cs: "Zelená = pomáha, červená = škodí. Nájdi kurzorom na riadok pre vysvetlenie." },
  "sys.save": { en: "Save System", cs: "Uložiť systém" },
  "sys.saving": { en: "Saving…", cs: "Ukladám…" },
  "sys.savedTick": { en: "Saved ✓", cs: "Uložené ✓" },
  "sys.footer": { en: "Benefits scale with fit; costs (fatigue, penalties, shots against) apply in full. Balanced dials = no effect.", cs: "Výhody rastú so súladom; náklady (únava, tresty, strely proti) platia naplno. Vyvážené nastavenia = žiadny efekt." },
  "sys.fitExcellent": { en: "Excellent fit — your roster is built for this", cs: "Výborný súlad — kádr je na to stavaný" },
  "sys.fitGood": { en: "Good fit", cs: "Dobrý súlad" },
  "sys.fitNeutral": { en: "Neutral fit", cs: "Neutrálny súlad" },
  "sys.fitBelow": { en: "Below-average fit — you pay the cost for less reward", cs: "Podpriemerný súlad — platíš cenu za menší úžitok" },
  "sys.fitPoor": { en: "Poor fit — this system fights your roster", cs: "Slabý súlad — systém bojuje proti kádru" },
};

/** Translate "section.key" into `lang`, with English then key as fallbacks. */
export function t(lang: Lang, key: string): string {
  const e = DICT[key];
  if (!e) return key;
  return e[lang] || e.en || key;
}

export function normalizeLang(v: string | undefined | null): Lang {
  return (LANGS as string[]).includes(v ?? "") ? (v as Lang) : DEFAULT_LANG;
}
