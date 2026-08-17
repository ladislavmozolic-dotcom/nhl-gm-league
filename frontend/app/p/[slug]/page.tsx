import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";

async function getPage(slug: string) {
  return prisma.customPage.findUnique({ where: { slug } }).catch(() => null);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  return { title: page?.title ?? "Page" };
}

export default async function CustomPageView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();
  // unpublished pages are visible to admins only (for preview)
  if (!page.published && !(await isAdmin())) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {!page.published && (
        <div className="mb-4 text-xs text-amber-400 border border-amber-500/30 rounded-lg px-3 py-1.5 inline-block">Náhľad — stránka nie je publikovaná</div>
      )}
      <h1 className="text-3xl font-black mb-4">{page.title}</h1>
      <article className="text-slate-200" dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body) }} />
    </div>
  );
}
