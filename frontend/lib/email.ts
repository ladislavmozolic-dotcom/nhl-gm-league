// Transactional email (Resend). RESEND_API_KEY lives only in the server's .env /
// docker-compose environment — never committed. Sending is always best-effort: a
// failed email must never block or roll back the underlying action (e.g. GM approval).

import { Resend } from "resend";
import { prisma } from "./prisma";

const FROM = "Ultimate NHL <noreply@unhl.eu>";
const SITE_URL = "https://unhl.eu";

let client: Resend | null = null;
function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

/** Welcome email sent when an admin approves a GM's join request. Best-effort:
 *  logs and swallows any failure rather than throwing (the approval itself must
 *  never fail because a mail provider hiccupped). */
export async function sendWelcomeEmail(opts: { to: string; gmName: string; teamName: string; teamSlug: string }): Promise<void> {
  const r = resend();
  if (!r) { console.warn("[email] RESEND_API_KEY not set — skipping welcome email"); return; }

  const site = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { logoUrl: true, leagueName: true, accentColor: true } });
  const logoUrl = site?.logoUrl ? `${SITE_URL}${site.logoUrl}` : null;
  const leagueName = site?.leagueName ?? "Ultimate NHL";
  const accent = site?.accentColor ?? "#60a5fa";
  const loginUrl = `${SITE_URL}/teams/${opts.teamSlug}/login`;

  const html = welcomeHtml({ ...opts, leagueName, accent, logoUrl, loginUrl });
  const text = `Vitaj v ${leagueName}! 🏒

Ahoj ${opts.gmName},

Sme radi, že si sa pridal do našej ligy ako GM klubu ${opts.teamName}, a veríme, že sa ti u nás bude páčiť.

Aby ti nič dôležité neušlo, odporúčame sa aspoň raz denne prihlásiť na ${SITE_URL.replace("https://", "")}, kde nájdeš všetko podstatné ohľadom svojho tímu, zápasov, správ a diania v lige.

KOMUNIKÁCIA CEZ VIBER
Na bežnú komunikáciu medzi manažérmi používame Viber, kde máme spoločný ligový chat. Riešime tam aktuálne informácie, zápasy, dohody medzi manažérmi aj rôzne novinky z ligy. Preto ťa prosíme:
- stiahni si aplikáciu Viber, ak ju ešte nemáš,
- pošli nám svoje telefónne číslo, pod ktorým Viber používaš,
- následne ťa pridáme do spoločného ligového chatu.

POTREBUJEŠ POMOC?
Admin ligy pôsobí v hre ako manažér tímu Pittsburgh Penguins. Ak budeš mať akúkoľvek otázku, nebude ti niečo jasné alebo budeš potrebovať s niečím pomôcť, pokojne ho môžeš kedykoľvek kontaktovať prostredníctvom súkromnej správy priamo na webe ${SITE_URL.replace("https://", "")}. Neboj sa pýtať – hlavne zo začiatku ti radi pomôžeme zorientovať sa.

Prihlásiť sa môžeš tu: ${loginUrl}

Ešte raz vitaj v ${leagueName} a prajeme veľa zábavy, dobrých trejdov a úspechov s tvojím tímom! 🏆

${leagueName}
${SITE_URL.replace("https://", "")}`;

  try {
    await r.emails.send({ from: FROM, to: opts.to, subject: `Vitaj v ${leagueName}! 🏒`, html, text });
  } catch (err) {
    console.error("[email] sendWelcomeEmail failed", err);
  }
}

function welcomeHtml(opts: { gmName: string; teamName: string; leagueName: string; accent: string; logoUrl: string | null; loginUrl: string }): string {
  const { gmName, teamName, leagueName, accent, logoUrl, loginUrl } = opts;
  const domain = SITE_URL.replace("https://", "");
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0f172a;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">

        <tr><td style="background:linear-gradient(135deg,${accent}22,#0f172a);padding:36px 32px 28px;text-align:center;">
          ${logoUrl ? `<img src="${logoUrl}" alt="${leagueName}" height="60" style="height:60px;width:auto;margin-bottom:14px;" />` : ""}
          <div style="color:#f1f5f9;font-size:24px;font-weight:800;letter-spacing:-0.3px;">Vitaj v ${leagueName}! 🏒</div>
        </td></tr>

        <tr><td style="padding:32px;">
          <p style="color:#f1f5f9;font-size:16px;font-weight:700;margin:0 0 14px;">Ahoj ${gmName},</p>
          <p style="color:#cbd5e1;font-size:14px;line-height:1.65;margin:0 0 16px;">
            Sme radi, že si sa pridal do našej ligy ako GM klubu
            <strong style="color:${accent};">${teamName}</strong>, a veríme, že sa ti u nás bude páčiť.
          </p>
          <p style="color:#cbd5e1;font-size:14px;line-height:1.65;margin:0 0 28px;">
            Aby ti nič dôležité neušlo, odporúčame sa aspoň raz denne prihlásiť na
            <a href="${SITE_URL}" style="color:${accent};text-decoration:none;">${domain}</a>,
            kde nájdeš všetko podstatné ohľadom svojho tímu, zápasov, správ a diania v lige.
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
            <tr><td style="background:${accent};border-radius:10px;">
              <a href="${loginUrl}" style="display:inline-block;padding:13px 30px;color:#0a1628;font-size:14px;font-weight:700;text-decoration:none;">Prihlásiť sa →</a>
            </td></tr>
          </table>

          <div style="background:#131f35;border:1px solid #1e293b;border-radius:12px;padding:20px 22px;margin:0 0 16px;">
            <p style="color:${accent};font-size:13px;font-weight:800;letter-spacing:0.3px;margin:0 0 10px;">📱 KOMUNIKÁCIA CEZ VIBER</p>
            <p style="color:#cbd5e1;font-size:13.5px;line-height:1.6;margin:0 0 10px;">
              Na bežnú komunikáciu medzi manažérmi používame Viber, kde máme spoločný ligový chat.
              Riešime tam aktuálne informácie, zápasy, dohody medzi manažérmi aj rôzne novinky z ligy.
              Preto ťa prosíme:
            </p>
            <ul style="color:#cbd5e1;font-size:13.5px;line-height:1.7;margin:0;padding-left:18px;">
              <li>stiahni si aplikáciu Viber, ak ju ešte nemáš,</li>
              <li>pošli nám svoje telefónne číslo, pod ktorým Viber používaš,</li>
              <li>následne ťa pridáme do spoločného ligového chatu.</li>
            </ul>
          </div>

          <div style="background:#131f35;border:1px solid #1e293b;border-radius:12px;padding:20px 22px;margin:0 0 28px;">
            <p style="color:${accent};font-size:13px;font-weight:800;letter-spacing:0.3px;margin:0 0 10px;">🏒 POTREBUJEŠ POMOC?</p>
            <p style="color:#cbd5e1;font-size:13.5px;line-height:1.6;margin:0;">
              Admin ligy pôsobí v hre ako manažér tímu Pittsburgh Penguins. Ak budeš mať akúkoľvek otázku,
              nebude ti niečo jasné alebo budeš potrebovať s niečím pomôcť, pokojne ho môžeš kedykoľvek
              kontaktovať prostredníctvom súkromnej správy priamo na webe ${domain}.
              Neboj sa pýtať – hlavne zo začiatku ti radi pomôžeme zorientovať sa.
            </p>
          </div>

          <p style="color:#cbd5e1;font-size:14px;line-height:1.65;margin:0;">
            Ešte raz vitaj v ${leagueName} a prajeme veľa zábavy, dobrých trejdov a úspechov s tvojím tímom! 🏆
          </p>
        </td></tr>

        <tr><td style="padding:16px 32px 28px;border-top:1px solid #1e293b;">
          <p style="color:#64748b;font-size:11px;margin:0;text-align:center;">${leagueName} · ${domain}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
