import type { Metadata } from "next";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { chatEnabled } from "@/lib/im/server";
import ChatApp from "@/components/chat/ChatApp";
import ChatLogin from "@/components/chat/ChatLogin";
import SessionResume from "@/components/SessionResume";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "UNHL Chat",
  manifest: "/chat/manifest.webmanifest",
  appleWebApp: { capable: true, title: "UNHL Chat", statusBarStyle: "black-translucent" },
};

// Full-screen overlay: covers the site's menu/footer so the chat feels like its own app,
// without touching the root layout.
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[9999] bg-slate-950 text-slate-100">{children}</div>;
}

export default async function ChatPage() {
  const me = await getTeamSession();
  if (!me) {
    return (
      <Shell>
        <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="text-4xl">💬</div>
          <h1 className="text-xl font-semibold">UNHL Chat</h1>
          <p className="text-slate-400 text-sm max-w-xs">Prihlás sa ako GM. Prihlásenie zostane aj po pridaní appky na plochu.</p>
          <SessionResume><ChatLogin /></SessionResume>
          <a href="/chat/install" className="text-sm text-blue-400 underline">📲 Ako nainštalovať do mobilu</a>
        </div>
      </Shell>
    );
  }
  const admin = await isAdmin();
  if (!(await chatEnabled()) && !admin) {
    return (
      <Shell>
        <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-semibold">Chat zatiaľ nie je zapnutý</h1>
          <p className="text-slate-400 text-sm">Komisár ho čoskoro spustí.</p>
        </div>
      </Shell>
    );
  }
  return <Shell><ChatApp /></Shell>;
}
