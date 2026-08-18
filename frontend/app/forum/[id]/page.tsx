import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { getTeamSession } from "@/lib/auth";
import ForumReply from "@/components/ForumReply";
import ForumReactions from "@/components/ForumReactions";

export const dynamic = "force-dynamic";

const CAT_LABEL: Record<string, string> = { general: "General", trades: "Trade Talk", league: "League", offtopic: "Off-topic" };
const fmt = (d: Date) => d.toLocaleString("sk-SK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tid = Number(id);
  const me = await getTeamSession();
  const thread = await prisma.forumThread.findUnique({
    where: { id: tid },
    select: {
      id: true, title: true, category: true, pinned: true,
      posts: {
        orderBy: { id: "asc" },
        select: {
          id: true, body: true, createdAt: true,
          team: { select: { code: true, name: true, logoUrl: true, gmNickname: true, slug: true } },
          reactions: { select: { emoji: true, teamId: true } },
        },
      },
    },
  });
  if (!thread) notFound();

  return (
    <div className="space-y-4 py-2 max-w-3xl">
      <PageHeader
        title={thread.title}
        subtitle={`${CAT_LABEL[thread.category] ?? thread.category} · ${thread.posts.length} post${thread.posts.length === 1 ? "" : "s"}`}
        right={<Link href="/forum" className="text-sm text-slate-400 hover:text-blue-400">← Forum</Link>}
      />

      <div className="space-y-3">
        {thread.posts.map((p, i) => {
          const byEmoji = new Map<string, { count: number; mine: boolean }>();
          for (const r of p.reactions) {
            const cur = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
            byEmoji.set(r.emoji, { count: cur.count + 1, mine: cur.mine || r.teamId === me });
          }
          const reacts = [...byEmoji.entries()].map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine }));
          return (
            <Card key={p.id} bodyClassName="p-4">
              <div className="flex items-center gap-2.5 mb-2">
                {p.team.logoUrl && <img src={p.team.logoUrl} alt="" className="w-7 h-7 object-contain" />}
                <Link href={`/teams/${p.team.slug}`} className="text-sm font-semibold text-slate-200 hover:text-blue-400">{p.team.gmNickname || p.team.code || p.team.name}</Link>
                {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-300 font-semibold">OP</span>}
                <span className="text-[11px] text-slate-500 ml-auto">{fmt(p.createdAt)}</span>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{p.body}</p>
              <ForumReactions postId={p.id} initial={reacts} canReact={me != null} />
            </Card>
          );
        })}
      </div>

      {me ? (
        <Card title="Reply" accent="text-blue-400"><ForumReply threadId={thread.id} /></Card>
      ) : (
        <Card><p className="text-center text-slate-500 text-sm py-3">Sign in as a GM to reply. <Link href="/login" className="text-blue-400 hover:underline">Sign in →</Link></p></Card>
      )}
    </div>
  );
}
