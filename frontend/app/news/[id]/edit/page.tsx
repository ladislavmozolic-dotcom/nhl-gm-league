import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import NewsEditor from "@/components/NewsEditor";

export const dynamic = "force-dynamic";

export default async function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const article = await prisma.newsArticle.findUnique({ where: { id }, select: { id: true, title: true, bodyHtml: true, authorTeamId: true } });
  if (!article) notFound();
  if (!(await canManageTeam(article.authorTeamId))) redirect(`/news/${id}`);
  return <div className="py-4"><NewsEditor initial={article} /></div>;
}
