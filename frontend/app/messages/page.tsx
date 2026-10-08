import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getTeamSession } from "@/lib/auth";
import { getLang } from "@/lib/lang-server";
import { listConversations } from "./actions";
import Messenger from "@/components/Messenger";
import SessionResume from "@/components/SessionResume";

export const dynamic = "force-dynamic";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { to } = await searchParams;
  const me = await getTeamSession();
  const lang = await getLang();
  const isEn = lang === "en";

  if (!me) {
    return (
      <div className="space-y-6 py-2">
        <PageHeader
          title={isEn ? "Messages" : "Správy"}
          subtitle={isEn ? "Direct messages between GMs" : "Priame správy medzi generálnymi manažérmi"}
        />
        <SessionResume>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-10 text-center text-slate-400">
            {isEn ? "Sign in as a GM to use the message board." : "Pre prístup k správam a konverzáciám sa prihlás ako GM."}{" "}
            <Link href="/login" className="text-blue-400 hover:underline">
              {isEn ? "Sign in →" : "Prihlásiť sa →"}
            </Link>
          </div>
        </SessionResume>
      </div>
    );
  }

  const conv = await listConversations();
  const active = to ? Number(to) : null;
  return (
    <div className="space-y-4 py-2">
      <PageHeader
        title={isEn ? "Messages" : "Správy"}
        subtitle={
          isEn
            ? "Direct messages between GMs — propose trades, negotiate, talk shop. Delivered ✓ / read ✓✓."
            : "Priame správy medzi manažérmi — vyjednávaj výmeny, dohaduj trejdy a sleduj ligové hlásenia. Doručené ✓ / prečítané ✓✓."
        }
      />
      <Messenger
        initialTeams={conv.teams}
        initialActive={active && conv.teams.some((t) => t.id === active) ? active : null}
      />
    </div>
  );
}

