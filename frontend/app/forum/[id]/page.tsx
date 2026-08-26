import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { getTeamSession, isAdmin } from "@/lib/auth";
import ForumReply from "@/components/ForumReply";
import ForumPostCard, { type ForumPostView } from "@/components/ForumPostCard";
import { markForumSeen } from "../actions";
import { catOk, CAT_META } from "../categories";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("sk-SK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tid = Number(id);
  const [me, admin] = await Promise.all([getTeamSession(), isAdmin()]);
  await markForumSeen(); // opening a thread counts as seeing the forum → clears the badge

  const thread = await prisma.forumThread.findUnique({
    where: { id: tid },
    select: {
      id: true, title: true, category: true, pinned: true,
      posts: {
        orderBy: { id: "asc" },
        select: {
          id: true, body: true, createdAt: true, editedAt: true, teamId: true,
          team: { select: { code: true, name: true, logoUrl: true, gmNickname: true, slug: true } },
          reactions: { select: { emoji: true, teamId: true } },
        },
      },
    },
  });
  if (!thread) notFound();
  const cat = catOk(thread.category);

  const posts: ForumPostView[] = thread.posts.map((p, i) => {
    const byEmoji = new Map<string, { count: number; mine: boolean }>();
    for (const r of p.reactions) {
      const cur = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
      byEmoji.set(r.emoji, { count: cur.count + 1, mine: cur.mine || r.teamId === me });
    }
    return {
      id: p.id, body: p.body, when: fmt(p.createdAt), edited: p.editedAt != null, isOP: i === 0,
      authorName: p.team.gmNickname || p.team.code || p.team.name, authorSlug: p.team.slug, authorLogo: p.team.logoUrl,
      canModify: me != null && (p.teamId === me || admin),
      reacts: [...byEmoji.entries()].map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine })),
    };
  });

  return (
    <div className="space-y-4 py-2 max-w-5xl">
      <PageHeader
        title={thread.title}
        subtitle={`${CAT_META[cat].label} · ${posts.length} príspevk${posts.length === 1 ? "" : "ov"}`}
        right={<Link href={`/forum/c/${cat}`} className="text-sm text-slate-400 hover:text-blue-400">← {CAT_META[cat].label}</Link>}
      />

      <div className="space-y-3">
        {posts.map((p) => <ForumPostCard key={p.id} post={p} canReact={me != null} />)}
      </div>

      {me ? (
        <Card title="Odpovedať" accent="text-blue-400"><ForumReply threadId={thread.id} /></Card>
      ) : (
        <Card><p className="text-center text-slate-500 text-sm py-3">Prihlás sa ako GM, aby si mohol odpovedať. <Link href="/login" className="text-blue-400 hover:underline">Prihlásiť sa →</Link></p></Card>
      )}
    </div>
  );
}
