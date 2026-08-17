"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";

/** Save the Branding block of the Web Editor. Admin only. */
export async function saveBranding(form: FormData) {
  if (!(await isAdmin())) throw new Error("Not authorized");
  const str = (k: string) => (form.get(k)?.toString() ?? "").trim();
  const leagueName = str("leagueName") || "ProfiNHL";
  const tagline = str("tagline");
  const logoUrl = str("logoUrl") || null;
  const nameImageUrl = str("nameImageUrl") || null;
  const accentColor = str("accentColor") || "#60a5fa";
  const bgColor = str("bgColor") || "#0a1628";
  const footerText = str("footerText") || null;
  const clampPx = (k: string, d: number) => Math.max(20, Math.min(240, Number(form.get(k)) || d));
  const logoHeight = clampPx("logoHeight", 56);
  const nameHeight = clampPx("nameHeight", 56);
  const bannerAlign = ["left", "center", "right"].includes(str("bannerAlign")) ? str("bannerAlign") : "center";
  const bannerLayout = str("bannerLayout") === "stack" ? "stack" : "row";
  const logoFirst = str("logoFirst") !== "false";
  const bh = Number(form.get("bannerHeight")) || 0;
  const bannerHeight = bh <= 0 ? 0 : Math.max(40, Math.min(300, bh)); // 0 = auto
  let socialLinks: { type: string; url: string }[] = [];
  try {
    const parsed = JSON.parse(str("socialLinks") || "[]");
    if (Array.isArray(parsed)) socialLinks = parsed.filter((s) => s && typeof s.url === "string" && /^https?:\/\//i.test(s.url)).slice(0, 12).map((s) => ({ type: String(s.type || "web"), url: String(s.url) }));
  } catch { /* ignore malformed */ }

  const data = { leagueName, tagline, logoUrl, nameImageUrl, logoHeight, nameHeight, bannerAlign, bannerLayout, logoFirst, bannerHeight, socialLinks, accentColor, bgColor, footerText };
  await prisma.siteConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  // branding is in the root layout → revalidate the whole site
  revalidatePath("/", "layout");
}

/** Save the Menu overrides (display order + hidden items). Admin only. */
export async function saveMenu(order: string[], hidden: string[]) {
  if (!(await isAdmin())) throw new Error("Not authorized");
  const menu = { order, hidden };
  await prisma.siteConfig.upsert({ where: { id: 1 }, update: { menu }, create: { id: 1, menu } });
  revalidatePath("/", "layout");
}

// ---- Theme (colours / fonts / radius) -------------------------------------
import type { Theme } from "@/lib/site-theme";

/** Save the site-wide theme tokens. Admin only. */
export async function saveTheme(t: Theme) {
  if (!(await isAdmin())) throw new Error("Not authorized");
  const hex = (v: string, d: string) => (/^#[0-9a-fA-F]{3,8}$/.test(v) ? v : d);
  const data = {
    surfaceColor: hex(t.surfaceColor, "#0f172a"), surface2Color: hex(t.surface2Color, "#1e293b"),
    borderColor: hex(t.borderColor, "#1e293b"), text2Color: hex(t.text2Color, "#94a3b8"),
    text3Color: hex(t.text3Color, "#64748b"), radiusPx: Math.max(0, Math.min(28, Number(t.radiusPx) || 12)),
    fontKey: String(t.fontKey || "inter"), accentColor: hex(t.accentColor, "#60a5fa"), bgColor: hex(t.bgColor, "#0a1628"),
  };
  await prisma.siteConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  revalidatePath("/", "layout");
}

// ---- Appearance templates -------------------------------------------------
import type { TemplateStyle } from "@/lib/site-templates";

/** Save the current look as a named template. Admin only. */
export async function saveTemplate(name: string, style: TemplateStyle) {
  if (!(await isAdmin())) throw new Error("Not authorized");
  const clamp = (n: number, d: number) => Math.max(20, Math.min(240, Number(n) || d));
  const clean = {
    accentColor: String(style.accentColor || "#60a5fa"),
    bgColor: String(style.bgColor || "#0a1628"),
    bannerAlign: ["left", "center", "right"].includes(style.bannerAlign) ? style.bannerAlign : "center",
    bannerLayout: style.bannerLayout === "stack" ? "stack" : "row",
    logoFirst: !!style.logoFirst,
    logoHeight: clamp(style.logoHeight, 64),
    nameHeight: clamp(style.nameHeight, 64),
  };
  await prisma.siteTemplate.create({ data: { name: name.trim() || "Šablóna", style: clean } });
}

/** Delete a saved template. Admin only. */
export async function deleteTemplate(id: number) {
  if (!(await isAdmin())) throw new Error("Not authorized");
  await prisma.siteTemplate.delete({ where: { id } });
}

// ---- Custom pages (Module 4) ----------------------------------------------
function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "page";
}

/** Create a blank custom page from a title; returns its id. Admin only. */
export async function createPage(title: string): Promise<number> {
  if (!(await isAdmin())) throw new Error("Not authorized");
  const base = slugify(title || "page");
  let slug = base, n = 1;
  while (await prisma.customPage.findUnique({ where: { slug } })) slug = `${base}-${++n}`;
  const p = await prisma.customPage.create({ data: { slug, title: title || "Nová stránka", body: "" } });
  revalidatePath("/", "layout");
  return p.id;
}

/** Update a custom page. Admin only. */
export async function updatePage(id: number, data: { title: string; body: string; published: boolean; inMenu: boolean; menuLabel: string; order: number }) {
  if (!(await isAdmin())) throw new Error("Not authorized");
  await prisma.customPage.update({ where: { id }, data: {
    title: data.title || "Stránka", body: data.body ?? "", published: !!data.published,
    inMenu: !!data.inMenu, menuLabel: data.menuLabel.trim() || null, order: Number.isFinite(data.order) ? data.order : 0,
  } });
  revalidatePath("/", "layout");
}

/** Delete a custom page. Admin only. */
export async function deletePage(id: number) {
  if (!(await isAdmin())) throw new Error("Not authorized");
  await prisma.customPage.delete({ where: { id } });
  revalidatePath("/", "layout");
}

// ---- Homepage custom blocks (Module 3) ------------------------------------
export type HomeBlock = { id: string; title: string; body: string; visible: boolean };

/** Save the admin-composed homepage blocks (rendered above the dashboard). */
export async function saveHomeBlocks(blocks: HomeBlock[]) {
  if (!(await isAdmin())) throw new Error("Not authorized");
  const clean = blocks.slice(0, 20).map((b) => ({ id: String(b.id), title: String(b.title ?? ""), body: String(b.body ?? ""), visible: !!b.visible }));
  await prisma.siteConfig.upsert({ where: { id: 1 }, update: { homeBlocks: clean }, create: { id: 1, homeBlocks: clean } });
  revalidatePath("/", "layout");
}
