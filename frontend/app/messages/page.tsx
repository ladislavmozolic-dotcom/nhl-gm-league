import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getTeamSession } from "@/lib/auth";
import { listConversations } from "./actions";
import Messenger from "@/components/Messenger";

export const dynamic = "force-dynamic";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { to } = await searchParams;
  const me = await getTeamSession();
  if (!me) {
    return (
      <div className="space-y-6 py-2">
        <PageHeader title="Messages" subtitle="Direct messages between GMs" />
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-10 text-center text-slate-400">
          Sign in as a GM to use the message board. <Link href="/login" className="text-blue-400 hover:underline">Sign in →</Link>
        </div>
      </div>
    );
  }
  const conv = await listConversations();
  const active = to ? Number(to) : null;
  return (
    <div className="space-y-4 py-2">
      <PageHeader title="Messages" subtitle="Direct messages between GMs — propose trades, talk shop. Delivered ✓ / read ✓✓." />
      <Messenger initialTeams={conv.teams} initialActive={active && conv.teams.some((t) => t.id === active) ? active : null} />
    </div>
  );
}
