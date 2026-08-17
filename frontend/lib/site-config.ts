// Web Editor — the merged site configuration every page reads. Loads the single
// SiteConfig row and fills in defaults, so callers always get a complete object even
// before an admin has saved anything. Branding is live here; menu / homepage blocks
// are added by later modules (fields already exist on the model).

import { prisma } from "./prisma";
import { type Theme, THEME_DEFAULTS } from "./site-theme";

export type SocialLink = { type: string; url: string };

export type Branding = {
  leagueName: string;
  tagline: string;
  logoUrl: string | null;
  nameImageUrl: string | null;
  logoHeight: number;
  nameHeight: number;
  bannerAlign: string; // left | center | right
  bannerLayout: string; // row | stack
  logoFirst: boolean;
  bannerHeight: number; // 0 = auto
  socialLinks: SocialLink[];
  accentColor: string;
  bgColor: string;
  footerText: string | null;
};

export const BRANDING_DEFAULTS: Branding = {
  leagueName: "ProfiNHL",
  tagline: "CZ & SK Online Hockey Manager",
  logoUrl: null,
  nameImageUrl: null,
  logoHeight: 56,
  nameHeight: 56,
  bannerAlign: "center",
  bannerLayout: "row",
  logoFirst: true,
  bannerHeight: 0,
  socialLinks: [],
  accentColor: "#60a5fa",
  bgColor: "#0a1628",
  footerText: null,
};

export type SiteConfig = {
  branding: Branding;
  theme: Theme;
  menu: unknown | null;
  homeBlocks: unknown | null;
};

function themeFrom(row: Record<string, unknown> | null): Theme {
  const g = <K extends keyof Theme>(k: K): Theme[K] => (row?.[k] as Theme[K]) ?? THEME_DEFAULTS[k];
  return {
    surfaceColor: g("surfaceColor"), surface2Color: g("surface2Color"), borderColor: g("borderColor"),
    text2Color: g("text2Color"), text3Color: g("text3Color"), radiusPx: g("radiusPx"), fontKey: g("fontKey"),
    accentColor: g("accentColor"), bgColor: g("bgColor"),
  };
}

/** Load the site config merged over defaults. Never throws on an empty DB. */
export async function loadSiteConfig(): Promise<SiteConfig> {
  const row = await prisma.siteConfig.findUnique({ where: { id: 1 } }).catch(() => null);
  return {
    theme: themeFrom(row as Record<string, unknown> | null),
    branding: {
      leagueName: row?.leagueName ?? BRANDING_DEFAULTS.leagueName,
      tagline: row?.tagline ?? BRANDING_DEFAULTS.tagline,
      logoUrl: row?.logoUrl ?? BRANDING_DEFAULTS.logoUrl,
      nameImageUrl: row?.nameImageUrl ?? BRANDING_DEFAULTS.nameImageUrl,
      logoHeight: row?.logoHeight ?? BRANDING_DEFAULTS.logoHeight,
      nameHeight: row?.nameHeight ?? BRANDING_DEFAULTS.nameHeight,
      bannerAlign: row?.bannerAlign ?? BRANDING_DEFAULTS.bannerAlign,
      bannerLayout: row?.bannerLayout ?? BRANDING_DEFAULTS.bannerLayout,
      logoFirst: row?.logoFirst ?? BRANDING_DEFAULTS.logoFirst,
      bannerHeight: row?.bannerHeight ?? BRANDING_DEFAULTS.bannerHeight,
      socialLinks: Array.isArray(row?.socialLinks) ? (row!.socialLinks as SocialLink[]) : BRANDING_DEFAULTS.socialLinks,
      accentColor: row?.accentColor ?? BRANDING_DEFAULTS.accentColor,
      bgColor: row?.bgColor ?? BRANDING_DEFAULTS.bgColor,
      footerText: row?.footerText ?? BRANDING_DEFAULTS.footerText,
    },
    menu: (row?.menu as unknown) ?? null,
    homeBlocks: (row?.homeBlocks as unknown) ?? null,
  };
}

/** Convenience: just the branding block. */
export async function loadBranding(): Promise<Branding> {
  return (await loadSiteConfig()).branding;
}

/** Convenience: just the theme tokens. */
export async function loadTheme(): Promise<Theme> {
  return (await loadSiteConfig()).theme;
}
