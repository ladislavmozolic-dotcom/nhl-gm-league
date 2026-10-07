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
  const text = `Welcome to ${leagueName}! 🏒

Hi ${opts.gmName},

We are glad you joined our league as the GM of ${opts.teamName}, and we hope you will enjoy it here.

So you do not miss anything important, we recommend signing in at least once a day at ${SITE_URL.replace("https://", "")}, where you will find everything relevant about your team, games, news and what is happening in the league.

COMMUNICATION VIA VIBER
For everyday communication between managers we use Viber, where we have a shared league chat. We discuss current information, games, deals between managers and various league news there. So please:
- download the Viber app if you do not have it yet,
- send us the phone number you use Viber with,
- we will then add you to the shared league chat.

NEED HELP?
The league admin plays in the game as the manager of the Pittsburgh Penguins. If you have any question, something is unclear or you need help with anything, feel free to contact them at any time via a private message directly on the site ${SITE_URL.replace("https://", "")}. Do not be afraid to ask – especially at the beginning we are happy to help you find your way around.

You can sign in here: ${loginUrl}

Once again, welcome to ${leagueName} — we wish you lots of fun, great trades and success with your team! 🏆

${leagueName}
${SITE_URL.replace("https://", "")}`;

  try {
    await r.emails.send({ from: FROM, to: opts.to, subject: `Welcome to ${leagueName}! 🏒`, html, text });
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

        <tr><td style="background-color:#0a1628;border-bottom:3px solid ${accent};padding:36px 32px 28px;text-align:center;">
          ${logoUrl ? `<img src="${logoUrl}" alt="${leagueName}" height="60" style="height:60px;width:auto;margin-bottom:16px;" />` : ""}
          <div style="color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;letter-spacing:0.2px;">Welcome to ${leagueName}! 🏒</div>
        </td></tr>

        <tr><td style="padding:32px;">
          <p style="color:#f1f5f9;font-size:16px;font-weight:700;margin:0 0 14px;">Hi ${gmName},</p>
          <p style="color:#cbd5e1;font-size:14px;line-height:1.65;margin:0 0 16px;">
            We are glad you joined our league as the GM of
            <strong style="color:${accent};">${teamName}</strong>, and we hope you will enjoy it here.
          </p>
          <p style="color:#cbd5e1;font-size:14px;line-height:1.65;margin:0 0 28px;">
            So you do not miss anything important, we recommend signing in at least once a day at
            <a href="${SITE_URL}" style="color:${accent};text-decoration:none;">${domain}</a>,
            where you will find everything relevant about your team, games, news and what is happening in the league.
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
            <tr><td style="background:${accent};border-radius:10px;">
              <a href="${loginUrl}" style="display:inline-block;padding:13px 30px;color:#0a1628;font-size:14px;font-weight:700;text-decoration:none;">Sign in →</a>
            </td></tr>
          </table>

          <div style="background:#131f35;border:1px solid #1e293b;border-radius:12px;padding:20px 22px;margin:0 0 16px;">
            <p style="color:${accent};font-size:13px;font-weight:800;letter-spacing:0.3px;margin:0 0 10px;">📱 COMMUNICATION VIA VIBER</p>
            <p style="color:#cbd5e1;font-size:13.5px;line-height:1.6;margin:0 0 10px;">
              For everyday communication between managers we use Viber, where we have a shared league chat.
              We discuss current information, games, deals between managers and various league news there.
              So please:
            </p>
            <ul style="color:#cbd5e1;font-size:13.5px;line-height:1.7;margin:0;padding-left:18px;">
              <li>download the Viber app if you do not have it yet,</li>
              <li>send us the phone number you use Viber with,</li>
              <li>we will then add you to the shared league chat.</li>
            </ul>
          </div>

          <div style="background:#131f35;border:1px solid #1e293b;border-radius:12px;padding:20px 22px;margin:0 0 28px;">
            <p style="color:${accent};font-size:13px;font-weight:800;letter-spacing:0.3px;margin:0 0 10px;">🏒 NEED HELP?</p>
            <p style="color:#cbd5e1;font-size:13.5px;line-height:1.6;margin:0;">
              The league admin plays in the game as the manager of the Pittsburgh Penguins. If you have any question,
              something is unclear or you need help with anything, feel free to contact them at any time
              via a private message directly on the site ${domain}.
              Do not be afraid to ask – especially at the beginning we are happy to help you find your way around.
            </p>
          </div>

          <p style="color:#cbd5e1;font-size:14px;line-height:1.65;margin:0;">
            Once again, welcome to ${leagueName} — we wish you lots of fun, great trades and success with your team! 🏆
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

/** Ops alert to the league admin (ALERT_EMAIL in the server's .env). Same
 *  best-effort rule as every other mail here: never throws. */
export async function sendAdminAlert(subject: string, text: string): Promise<void> {
  const r = resend();
  const to = process.env.ALERT_EMAIL;
  if (!r || !to) { console.warn("[email] RESEND_API_KEY / ALERT_EMAIL not set — skipping alert:", subject); return; }
  try {
    await r.emails.send({ from: FROM, to, subject: `[UNHL] ${subject}`, text });
  } catch (err) {
    console.error("[email] sendAdminAlert failed", err);
  }
}
