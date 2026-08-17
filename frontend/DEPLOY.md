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

## 9. Zálohy (odporúčam)
Databáza:
```bash
docker compose exec -T db pg_dump -U profinhl profinhl > backup-$(date +%F).sql
```
Daj si to do cronu (denne). Uploady sú vo volume `uploads` — zálohuj podobne alebo
`docker run --rm -v frontend_uploads:/u -v $PWD:/b alpine tar czf /b/uploads.tgz -C /u .`

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
