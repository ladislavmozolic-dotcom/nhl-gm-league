import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { pushToTeams } from "@/lib/im/server";

export const dynamic = "force-dynamic";

// "Send me a test notification" — to MY registered devices only. force:true shows it even if the chat is in front.
export async function POST() {
  const me = await getTeamSession();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  const sent = await prisma.imPushSub.count({ where: { teamId: me } });
  if (sent) await pushToTeams([me], { title: "UNHL Chat", body: "Skúšobná notifikácia ✅ Notifikácie fungujú.", url: "/chat", tag: "test", force: true });
  return NextResponse.json({ ok: true, sent });
}
