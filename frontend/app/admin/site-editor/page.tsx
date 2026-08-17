import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { loadSiteConfig } from "@/lib/site-config";
import { menuForEditor, type MenuOverrides } from "@/lib/menu-config";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import SiteBrandingForm from "@/components/SiteBrandingForm";
import SiteMenuForm from "@/components/SiteMenuForm";
import SitePagesForm from "@/components/SitePagesForm";
import SiteHomeForm from "@/components/SiteHomeForm";
import SiteThemeForm from "@/components/SiteThemeForm";
import type { HomeBlock } from "@/app/admin/site-editor/actions";
import type { TemplateStyle } from "@/lib/site-templates";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "branding", label: "Branding & vzhľad", ready: true },
  { key: "theme", label: "Téma & farby", ready: true },
  { key: "menu", label: "Menu & sekcie", ready: true },
  { key: "home", label: "Domovská stránka", ready: true },
  { key: "pages", label: "Vlastné stránky", ready: true },
];

export default async function SiteEditorPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (!(await isAdmin())) redirect("/");
  const { tab } = await searchParams;
  const active = TABS.find((t) => t.key === tab && t.ready)?.key ?? "branding";
  const site = await loadSiteConfig();
  const branding = site.branding;
  const menuRows = menuForEditor(site.menu as MenuOverrides | null);
  const pages = active === "pages" ? await prisma.customPage.findMany({ orderBy: { order: "asc" } }) : [];
  const templates = active === "branding" ? await prisma.siteTemplate.findMany({ orderBy: { createdAt: "desc" } }) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
      <PageHeader title="Web Editor" subtitle="Prispôsob si stránku podľa seba — branding, menu, domovská stránka, vlastné stránky" />
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map((t) => (
          <a key={t.key} href={t.ready ? `/admin/site-editor?tab=${t.key}` : undefined}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${active === t.key ? "bg-blue-600 text-white" : t.ready ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-800/40 text-slate-600 cursor-default"}`}>
            {t.label}{!t.ready && " · čoskoro"}
          </a>
        ))}
      </div>

      {active === "branding" && (
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">Branding & vzhľad</div>
          <SiteBrandingForm branding={branding} savedTemplates={templates.map((t) => ({ id: t.id, name: t.name, style: t.style as TemplateStyle }))} />
        </Card>
      )}
      {active === "theme" && (
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">Téma & farby</div>
          <SiteThemeForm theme={site.theme} />
        </Card>
      )}
      {active === "menu" && (
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">Menu & sekcie</div>
          <SiteMenuForm initial={menuRows} />
        </Card>
      )}
      {active === "home" && (
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">Domovská stránka — vlastné bloky</div>
          <SiteHomeForm initial={(site.homeBlocks as HomeBlock[] | null) ?? []} />
        </Card>
      )}
      {active === "pages" && (
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">Vlastné stránky</div>
          <SitePagesForm pages={pages.map((p) => ({ id: p.id, slug: p.slug, title: p.title, body: p.body, published: p.published, inMenu: p.inMenu, menuLabel: p.menuLabel, order: p.order }))} />
        </Card>
      )}
    </div>
  );
}
