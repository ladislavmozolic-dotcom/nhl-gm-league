import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTeamSession, canManageTeam } from "@/lib/auth";
import { ReactionBar, CommentBox } from "@/components/NewsReactions";
import { BackPill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [article, session] = await Promise.all([
    prisma.newsArticle.findUnique({ where: { id }, include: { reactions: true, comments: { orderBy: { createdAt: "asc" } } } }),
    getTeamSession(),
  ]);
  if (!article) notFound();
  const canEdit = await canManageTeam(article.authorTeamId);

  const teamIds = [article.authorTeamId, ...article.comments.map((c) => c.teamId), ...article.reactions.map((r) => r.teamId)];
  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    select: { id: true, name: true, logoUrl: true, gm: true, gmNickname: true, gmFirstName: true, gmLastName: true },
  });
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const author = teamById.get(article.authorTeamId);
  // the CURRENT GM's name, not the stale placeholder `gm` field imported at team
  // creation (which can read like "Vacancy" or a GM who's since left the league) —
  // gmNickname/gmFirstName/gmLastName track the actually-registered human, same
  // precedence TeamCapView uses.
  const gmName = (t?: { name: string; gm: string; gmNickname: string | null; gmFirstName: string | null; gmLastName: string | null }) =>
    t?.gmNickname || [t?.gmFirstName, t?.gmLastName].filter(Boolean).join(" ").trim() || t?.gm || t?.name || "GM";

  const counts: Record<string, number> = {};
  const reactorNames: Record<string, string[]> = {};
  for (const r of article.reactions) {
    counts[r.kind] = (counts[r.kind] ?? 0) + 1;
    (reactorNames[r.kind] ??= []).push(gmName(teamById.get(r.teamId)));
  }
  const mine = session ? article.reactions.find((r) => r.teamId === session)?.kind ?? null : null;

  return (
    <div className="py-2 max-w-3xl mx-auto">
      <BackPill href="/">Home</BackPill>
      <article className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 p-6 mt-3">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {author?.logoUrl ? <img src={author.logoUrl} alt="" className="w-10 h-10 object-contain" />
              : <div className="w-10 h-10 rounded-full bg-slate-700 grid place-items-center font-bold">{author?.name?.[0] ?? "?"}</div>}
            <div>
              <p className="text-sm font-bold">{gmName(author)}</p>
              <p className="text-xs text-slate-500">{author?.name} · {article.createdAt.toLocaleString("sk-SK")}</p>
            </div>
          </div>
          {canEdit && <Link href={`/news/${article.id}/edit`} className="text-xs text-blue-400 hover:text-blue-300 shrink-0">Edit →</Link>}
        </div>
        <h1 className="text-2xl font-bold mb-4">{article.title}</h1>
        {/* the perex cut line is a homepage-preview marker, not something a reader
            should see once they're already on the full article */}
        <div className="news-body text-slate-200 leading-relaxed [&_.article-cut]:hidden" dangerouslySetInnerHTML={{ __html: article.bodyHtml }} />
        <div className="mt-6 pt-4 border-t border-slate-800">
          <ReactionBar articleId={article.id} counts={counts} mine={mine} canReact={!!session} reactorNames={reactorNames} />
        </div>
      </article>

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-3">Comments ({article.comments.length})</h2>
        {session ? <CommentBox articleId={article.id} /> : <p className="text-sm text-slate-500 mb-3">Sign in as a GM to comment.</p>}
        <div className="space-y-3 mt-4">
          {article.comments.map((c) => {
            const t = teamById.get(c.teamId);
            return (
              <div key={c.id} className="bg-slate-900/70 border border-slate-800 rounded-xl shadow-lg shadow-black/20 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  {t?.logoUrl && <img src={t.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                  <span className="text-xs font-semibold">{gmName(t)}</span>
                  <span className="text-[10px] text-slate-500">{c.createdAt.toLocaleDateString("sk-SK")}</span>
                </div>
                <p className="text-sm text-slate-300">{c.body}</p>
              </div>
            );
          })}
          {article.comments.length === 0 && <p className="text-sm text-slate-600">No comments yet.</p>}
        </div>
      </section>
    </div>
  );
}
