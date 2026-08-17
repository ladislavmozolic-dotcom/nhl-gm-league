import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { loadBranding, loadSiteConfig } from "@/lib/site-config";
import { themeCss } from "@/lib/site-theme";
import { effectiveMenu, type MenuOverrides } from "@/lib/menu-config";
import { getLang } from "@/lib/lang-server";
import { t as translate } from "@/lib/i18n";
import ScoreTracker from "@/components/ScoreTracker";
import SiteBanner from "@/components/SiteBanner";
import MegaMenu from "@/components/MegaMenu";
import SiteFooter from "@/components/SiteFooter";
import { LangProvider } from "@/components/LangProvider";

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const b = await loadBranding();
  return { title: `${b.leagueName} — ${b.tagline}`, description: b.tagline };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // signed-in GM (per-team session) → show nickname + logout in the menu
  const teamId = await getTeamSession();
  const t = teamId ? await prisma.team.findUnique({ where: { id: teamId }, select: { slug: true, gmNickname: true, gm: true, isAdmin: true } }) : null;
  const gm = t ? { nickname: t.gmNickname || t.gm || "GM", slug: t.slug, admin: t.isAdmin } : null;
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
  // translate the built-in top-nav labels (custom pages keep their own label)
  const menu = effectiveMenu(site.menu as MenuOverrides | null, extra).map((m) => {
    const item = m.key.startsWith("page:") ? m : { ...m, label: translate(lang, `menu.${m.key}`) };
    if (item.key === "tools" && item.children) {
      return { ...item, children: item.children.filter((c) => c.href !== hiddenCalc) };
    }
    return item;
  });

  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss(site.theme) }} />
      </head>
      <body
        className={`${inter.className} text-white min-h-screen flex flex-col`}
        style={{ background: branding.bgColor, ["--accent" as string]: branding.accentColor } as React.CSSProperties}
      >
        <LangProvider lang={lang}>
          <ScoreTracker />
          <SiteBanner branding={branding} />
          <MegaMenu gm={gm} items={menu} lang={lang} />
          <main className="pt-4 pb-16 max-w-[1400px] mx-auto px-4 w-full flex-1">{children}</main>
          <SiteFooter branding={branding} />
        </LangProvider>
      </body>
    </html>
  );
}
