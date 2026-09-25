# ProfiNHL — spustenie ligy naživo (VPS + Docker + vlastná doména)

Kompletný návod od nuly. Výsledok: liga beží na `https://liga.tvojadomena.sk`, GMs sa
prihlasujú, a vylepšenia pushuješ jedným príkazom bez straty dát.

Celý deploy stojí na 3 volumoch, ktoré **prežijú každý redeploy**:
- `pgdata` — databáza (hráči, tímy, GM účty, všetko)
- `uploads` — nahrané logá/wordmarky z Web Editora
- `caddy_data` — HTTPS certifikáty

---

## 0. Čo budeš potrebovať
- **Doména** (napr. z Websupport, Namecheap, Cloudflare) — ~5-15 €/rok
- **VPS** s Ubuntu 22.04/24.04 (Hetzner ~4 €/mes, DigitalOcean, Contabo…) — stačí 2 GB RAM
- Prístup k VPS cez SSH

---

## 1. Kód na GitHub
Remote už je nastavený na `https://github.com/ladislavmozolic-dotcom/nhl-gm-league.git`.
Na svojom Macu (v `frontend/`) len pushni najnovší stav:
```bash
git add -A && git commit -m "deploy setup" && git push
```
> `.env` sa NEnahráva (je v `.gitignore`). Na server ho vytvoríš ručne (krok 5).
>
> **Ak je repo privátny**, server sa pri `git clone`/`git pull` bude pýtať prihlásenie.
> Vytvor si na GitHube **Personal Access Token** (Settings → Developer settings →
> Personal access tokens → *Fine-grained*, prístup len k tomuto repu, práva *Contents: Read*)
> a použi ho namiesto hesla. Alebo daj repo na *Public* ak ti to neprekáža.

---

## 2. VPS — základ
Prihlás sa na server a nainštaluj Docker:
```bash
ssh root@IP_SERVERA
curl -fsSL https://get.docker.com | sh          # Docker + compose plugin
apt-get install -y git ufw
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

---

## 3. Doména → server (DNS)
V správe domény pridaj **A záznam**:

| Typ | Názov | Hodnota |
|---|---|---|
| A | `liga` (alebo `@` pre koreň) | `IP_SERVERA` |

Over (chvíľu trvá kým sa rozšíri):
```bash
dig +short liga.tvojadomena.sk      # má vrátiť IP servera
```
> HTTPS certifikát vybaví Caddy automaticky — nič neriešiš, len musí DNS smerovať na server.

---

## 4. Stiahni projekt na server
```bash
cd /opt
git clone https://github.com/ladislavmozolic-dotcom/nhl-gm-league.git
cd nhl-gm-league/frontend
chmod +x deploy.sh
```
> Appka je v podpriečinku `frontend/` — všetky `docker compose` príkazy sa spúšťajú odtiaľ.

---

## 5. Nastav `.env`
```bash
cp .env.example .env
nano .env
```
Vyplň: `DOMAIN`, silné `POSTGRES_PASSWORD` a rovnaké heslo v `DATABASE_URL`.
```
DOMAIN=liga.tvojadomena.sk
POSTGRES_USER=profinhl
POSTGRES_PASSWORD=nejake-dlhe-nahodne-heslo
POSTGRES_DB=profinhl
DATABASE_URL=postgresql://profinhl:nejake-dlhe-nahodne-heslo@db:5432/profinhl?schema=public
```

---

## 6. Prvý štart
```bash
docker compose up -d --build         # postaví appku + spustí Postgres + Caddy
docker compose logs -f app           # sleduj kým nabehne (Ctrl+C na ukončenie logu)
```
Vytvor schému v prázdnej databáze:
```bash
docker compose run --rm app npx prisma db push
```
Otvor `https://liga.tvojadomena.sk` — appka beží (zatiaľ prázdna liga).

---

## 7. Prenos tvojej hotovej ligy (dáta z lokálu)
Na **Macu** vyexportuj lokálnu databázu:
```bash
# uprav connection string podľa svojho lokálneho .env
pg_dump "postgresql://localhost:5432/profinhl_engine" --no-owner --no-privileges > league.sql
```
Nahraj na server a naimportuj:
```bash
scp league.sql root@IP_SERVERA:/opt/profinhl/frontend/
# na serveri:
cd /opt/profinhl/frontend
cat league.sql | docker compose exec -T db psql -U profinhl -d profinhl
```
> Ak si už spustil `prisma db push` (krok 6) a import hlási konflikty tabuliek,
> namiesto toho spusti čistý import do prázdnej DB: `docker compose down -v` (POZOR:
> zmaže volumy) → `docker compose up -d` → import → `prisma db push` až potom pre
> prípadné doplnenie stĺpcov.

Hotovo — liga je online s tvojimi dátami.

---

## 8. Pushovanie vylepšení počas sezóny ⭐
Keď spravím zmeny v kóde (a ty ich máš na GitHube), na serveri stačí:
```bash
cd /opt/profinhl/frontend
./deploy.sh
```
Skript: stiahne kód → prebuilduje appku → `prisma db push` (aplikuje zmeny schémy) →
reštartuje. **Databáza a uploady sa nedotknú** — liga beží ďalej.

Workflow: ja upravím kód → ty `git push` (alebo ja ti dám commit) → na serveri `./deploy.sh`.

---

## 9. Zálohy a monitoring (`scripts/ops/`)
Inštalácia raz na serveri: do `.env` pridaj `ALERT_EMAIL=tvoj@email`, potom
`./scripts/ops/install.sh` (idempotentné). Nainštaluje:
- **03:30 UTC denne** `backup-db.sh` → `/opt/unhl-backups/unhl-*.dump` (pg_dump -Fc, 14 posledných, `latest.dump` symlink).
  `deploy.sh` navyše pred každým deployom spraví `*-predeploy.dump` (5 posledných) a ak zlyhá, deploy sa preruší.
- **každých 10 min** `watchdog.sh` → `/api/health` (DB, zmeškaná 20:30 simulácia, zaseknutý kalendár),
  vek poslednej zálohy (>26 h), disk ≥ 90 %. E-mail cez Resend (max 1× za 6 h na problém + „Recovered“).
- Pred každou nočnou simuláciou sa spustí Commissioner Intelligence scan; kritické nálezy idú e-mailom (sim sa nezastaví).

Mac (off-server kópia): `scripts/ops/mac/pull-backup.sh` → `~/UNHL-Backups/` + launchd `eu.unhl.backup-pull.plist` (denne 10:00, 30 posledných).

Obnova: `cat unhl-XXXX.dump | docker compose exec -T db pg_restore -U profinhl -d profinhl --clean --if-exists`

Uploady sú vo volume `uploads` — `docker run --rm -v frontend_uploads:/u -v $PWD:/b alpine tar czf /b/uploads.tgz -C /u .`

---

## 10b. Automatický denný beh ("Auto (calendar)")

Keď je na `/admin/season` fáza nastavená na **Auto (calendar)** (t.j. `phaseOverride`
je `null`), liga sa od 2026-08-30 posúva **sama** — každý deň o **20:30 (Europe/
Bratislava, s DST)** odohrá naplánované zápasy toho dňa presne tak, ako by admin
klikol "Simulate Day". Manuálne pripnutá fáza (Off-season/Pre-season/Regular
season/Playoffs tlačidlo) toto pozastaví — admin má vtedy plnú ručnú kontrolu.

**Jednorazové nastavenie na serveri:**
1. Vygeneruj náhodný secret a pridaj ho do `.env`:
   ```bash
   openssl rand -hex 32
   nano .env    # pridaj riadok: CRON_SECRET=vygenerovany-secret
   ```
2. `./deploy.sh` (načíta nový `.env`).
3. Pridaj crontab (beží každých 5 minút, ale reálne niečo urobí len raz denne
   v 20:30-20:39 bratislavského času — časové pásmo si server-side kód rieši sám
   cez `Intl`/DST, cron nemusí poznať časové pásmo):
   ```bash
   crontab -e
   ```
   pridaj riadok (nahraď `TVOJ_SECRET` hodnotou z kroku 1):
   ```
   */5 * * * * curl -fsS -X POST https://TVOJA_DOMENA/api/cron/advance-day -H "Authorization: Bearer TVOJ_SECRET" >> /var/log/unhl-cron.log 2>&1
   ```

Over: `tail -f /var/log/unhl-cron.log` okolo 20:30 — mal by sa objaviť JSON
`{"ran":true,...}` presne raz za deň (ostatné behy vrátia `{"ran":false,"reason":"..."}`).

---

## 10. Druhá liga neskôr (cesta A)
1. Skopíruj priečinok: `cp -r /opt/nhl-gm-league /opt/liga2`
2. Uprav `.env`: iný `DOMAIN` (`liga2.tvojadomena.sk`), iné DB heslo/názov
3. Pridaj A záznam pre `liga2` v DNS
4. `cd /opt/liga2/frontend && docker compose -p liga2 up -d --build`

Každá liga = vlastná izolovaná DB + uploady + doména. Žiadne zmeny kódu.

---

## Rýchle príkazy
| Akcia | Príkaz |
|---|---|
| Stav | `docker compose ps` |
| Logy appky | `docker compose logs -f app` |
| Reštart | `docker compose restart app` |
| Update na najnovší kód | `./deploy.sh` |
| Vypnúť | `docker compose down` (volumy ostanú) |
| DB konzola | `docker compose exec db psql -U profinhl profinhl` |

## Časté problémy
- **HTTPS nefunguje** → over `dig +short DOMENA` = IP servera, a že porty 80/443 sú otvorené (ufw). Caddy potrebuje port 80 na overenie certifikátu.
- **App padá pri štarte** → `docker compose logs app`; často chýbajúci/zlý `DATABASE_URL` v `.env`.
- **Uploady zmizli po redeployi** → over že volume `uploads` je namapovaný (`docker compose config`), nesmieš robiť `down -v`.

## Bezpečnostná aktualizácia relácií (sessionVersion)

Pred nasadením tejto verzie:

1. V serverovom `.env` nastav `AUTH_SECRET` na novú náhodnú hodnotu
   vytvorenú cez `openssl rand -hex 32`. Tajomstvo neposielaj do Gitu ani chatu.
2. Explicitne nastav `AUTH_SALT` na **doterajšiu hodnotu**. Ak premenná predtým
   nebola nastavená, pôvodný kód používal `profinhl-salt`; zachovaj ju.
   Náhodná nová soľ patrí iba k novej databáze. Zmena soli existujúcej ligy by
   znemožnila overenie uložených hesiel. Táto aktualizácia ich neprepočítava.
3. Zálohuj databázu. Schéma pridáva `Team.sessionVersion Int @default(0)`.
   Existujúci `deploy.sh` aplikuje pole cez `prisma db push` pred reštartom.
   Pri ručnom nasadení aplikuj schému pred spustením novej aplikácie.
4. Nová aplikácia odmietne staré tokeny; všetci GM sa prihlásia znova svojím
   existujúcim heslom. Vyskúšaj bežné prihlásenie a prihlásenie administrátora.

Produkčný proces bez platného `AUTH_SECRET` a explicitného `AUTH_SALT` odmietne
štart. Pri lokálnom vývoji bez `AUTH_SECRET` sa používa náhodné tajomstvo procesu,
takže reštart môže vyžadovať nové prihlásenie.

Nová cookie aj mobilný remember-token majú rovnakú pevnú platnosť 30 dní.
Obnovenie cookie neposúva dátum expirácie. Zmena hesla, odobratie GM, schválenie
nového GM a presun/výmena GM inkrementujú verziu príslušného tímu; staré relácie
sa odmietnu od nasledujúcej požiadavky. Zmena hesla odhlási aj aktuálne zariadenie.

Táto zmena ešte nemigruje SHA-256 heslá na Argon2/scrypt, nepridáva obmedzenie
pokusov o prihlásenie a neodstraňuje localStorage fallback. Tieto opravy nasledujú
samostatne. HTML článkov sa už sanitizuje pri zápise aj čítaní.
