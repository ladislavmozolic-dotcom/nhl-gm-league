import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { loadBranding, loadSiteConfig } from "@/lib/site-config";
import { themeCss } from "@/lib/site-theme";
import { effectiveMenu, type MenuOverrides } from "@/lib/menu-config";
import { loadSettings } from "@/lib/sim/settings";
import { getLang } from "@/lib/lang-server";
import { t as translate } from "@/lib/i18n";
import ScoreTracker from "@/components/ScoreTracker";
import MessageNotifier from "@/components/MessageNotifier";
import TradeSuccessOverlay from "@/components/TradeSuccessOverlay";
import VisitBeacon from "@/components/VisitBeacon";
import SiteBanner from "@/components/SiteBanner";
import MegaMenu from "@/components/MegaMenu";
import SiteFooter from "@/components/SiteFooter";
import { LangProvider } from "@/components/LangProvider";

const inter = Inter({ subsets: ["latin"] });

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const b = await loadBranding();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://unhl.eu";
  const title = `${b.leagueName} — ${b.tagline}`;
  // the uploaded site logo (Admin → Web Editor → Branding) drives the browser-tab
  // favicon AND the link-preview image, so a shared link shows OUR logo — not the
  // team logos a scraper would otherwise scrape off the page.
  const logo = b.logoUrl || b.nameImageUrl || null;
  return {
    metadataBase: new URL(siteUrl),
    title,
    description: b.tagline,
    applicationName: b.leagueName,
    ...(logo ? { icons: { icon: logo, shortcut: logo, apple: logo } } : {}),
    openGraph: {
      type: "website", url: siteUrl, siteName: b.leagueName, title, description: b.tagline,
      ...(logo ? { images: [{ url: logo }] } : {}),
    },
    twitter: { card: logo ? "summary_large_image" : "summary", title, description: b.tagline, ...(logo ? { images: [logo] } : {}) },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // signed-in GM (per-team session) → show nickname + logout in the menu
  const teamId = await getTeamSession();
  const t = teamId ? await prisma.team.findUnique({ where: { id: teamId }, select: { slug: true, gmNickname: true, gm: true, isAdmin: true, forumSeenAt: true } }) : null;
  // pending GM join requests → red badge in the menu (admins only)
  const pendingJoins = t?.isAdmin ? await prisma.joinRequest.count({ where: { status: "pending" } }).catch(() => 0) : 0;
  // unread direct messages → badge for any signed-in GM
  const unreadDm = teamId ? await prisma.dmMessage.count({ where: { toTeamId: teamId, readAt: null } }).catch(() => 0) : 0;
  // new forum posts since this GM last viewed the forum (excluding their own)
  const forumNew = teamId ? await prisma.forumPost.count({ where: { teamId: { not: teamId }, createdAt: { gt: t?.forumSeenAt ?? new Date(0) } } }).catch(() => 0) : 0;
  const gm = t ? { nickname: t.gmNickname || t.gm || "GM", slug: t.slug, admin: t.isAdmin, pendingJoins, unreadDm, forumNew } : null;
  const site = await loadSiteConfig();
  const branding = site.branding;
  // published, in-menu custom pages become extra top-nav items (key "page:<slug>")
  const customPages = await prisma.customPage.findMany({ where: { published: true, inMenu: true }, orderBy: { order: "asc" }, select: { slug: true, title: true, menuLabel: true } }).catch(() => []);
  const extra = customPages.map((p) => ({ key: `page:${p.slug}`, label: p.menuLabel || p.title, href: `/p/${p.slug}` }));
  const lang = await getLang();
  // which player-parameter calculator is active — only its Tools link shows
  const lc = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { paramMode: true } }).catch(() => null);
  const paramMode = lc?.paramMode === "edge" ? "edge" : "sths";
  const hiddenCalc = paramMode === "edge" ? "/tools/player-calculator" : "/tools/edge-calculator";
  // base finance → hide the Detailed-Finance league pages from the League ▸ Finance submenu
  const settings = await loadSettings().catch(() => null);
  const detailedFinance = settings?.financeMode === "detailed";
  const DETAILED_FINANCE_HREFS = new Set(["/finance/fan-interest", "/finance/season-tickets", "/finance/attendance", "/finance/merchandise", "/finance/sponsorship"]);
  // Finance moved from a top-level item into League ▸ Finance — honour a legacy
  // "hide finance" override so admins who hid it before the move keep it hidden.
  const financeHidden = new Set(((site.menu as MenuOverrides | null)?.hidden) ?? []).has("finance");
  // translate the built-in top-nav labels (custom pages keep their own label)
  const menu = effectiveMenu(site.menu as MenuOverrides | null, extra).map((m) => {
    const item = m.key.startsWith("page:") ? m : { ...m, label: translate(lang, `menu.${m.key}`) };
    if (item.key === "tools" && item.children) {
      return { ...item, children: item.children.filter((c) => c.href !== hiddenCalc) };
    }
    if (item.key === "league" && item.children) {
      return {
        ...item,
        children: item.children
          .filter((c) => !(financeHidden && c.href === "/finance")) // legacy hide-finance → drop the whole Finance submenu
          .map((c) =>
            c.children ? { ...c, children: detailedFinance ? c.children : c.children.filter((sub) => !DETAILED_FINANCE_HREFS.has(sub.href)) } : c
          ),
      };
    }
    return item;
  });

  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <head>
        {/* Tell the browser the site is ALREADY dark, so Chrome's "Auto Dark Mode / Force
            Dark" (a built-in flag, not an extension) doesn't re-darken it — that re-processing
            is what turned panels transparent and light text near-black for some GMs. */}
        <meta name="color-scheme" content="dark" />
        <style dangerouslySetInnerHTML={{ __html: themeCss(site.theme) }} />
      </head>
      <body
        className={`${inter.className} text-white min-h-screen flex flex-col`}
        style={{ background: branding.bgColor, ["--accent" as string]: branding.accentColor } as React.CSSProperties}
      >
        <LangProvider lang={lang}>
          <ScoreTracker />
          <VisitBeacon />
          {gm && <MessageNotifier initialUnread={gm.unreadDm} />}
          {gm && <TradeSuccessOverlay />}
          <SiteBanner branding={branding} />
          <MegaMenu gm={gm} items={menu} lang={lang} />
          <main className="pt-4 pb-16 max-w-[1400px] mx-auto px-4 w-full flex-1">{children}</main>
          <SiteFooter branding={branding} />
        </LangProvider>
      </body>
    </html>
  );
}
