import type { Metadata } from "next";
import QRCode from "qrcode";
import { loadBranding } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "UNHL Chat — inštalácia", manifest: "/chat/manifest.webmanifest" };

export default async function InstallPage() {
  const b = await loadBranding();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://unhl.eu";
  const qr = await QRCode.toString(`${base}/chat`, { type: "svg", margin: 1, width: 220, color: { dark: "#0f172a", light: "#ffffff" } });
  const step = "flex gap-3 items-start";
  const num = "w-7 h-7 shrink-0 rounded-full bg-blue-600 text-sm font-bold flex items-center justify-center";
  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950 text-slate-100">
      <div className="max-w-md mx-auto px-5 py-8 space-y-6" style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}>
        <div className="text-center space-y-2">
          <div className="text-5xl">💬</div>
          <h1 className="text-2xl font-bold">{b.leagueName} Chat</h1>
          <p className="text-slate-400 text-sm">Appka do mobilu. Nič sa neťahá z obchodu, nič neplatíte, funguje ako Viber.</p>
        </div>

        <div className="rounded-2xl bg-white p-3 w-fit mx-auto" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="text-center text-xs text-slate-500">Naskenuj telefónom, alebo otvor <b className="text-slate-300">{base.replace("https://", "")}/chat</b></p>

        <section className="rounded-2xl bg-slate-900 p-5 space-y-3">
          <h2 className="font-semibold">📱 iPhone (Safari)</h2>
          <div className={step}><span className={num}>1</span><p className="text-sm">Otvor odkaz v <b>Safari</b> (nie v Chrome ani v appke Facebook/Viber).</p></div>
          <div className={step}><span className={num}>2</span><p className="text-sm">Ťukni na <b>Zdieľať</b> (štvorec so šípkou dole).</p></div>
          <div className={step}><span className={num}>3</span><p className="text-sm">Vyber <b>Pridať na plochu</b> a potvrď.</p></div>
          <div className={step}><span className={num}>4</span><p className="text-sm">Otvor chat z <b>novej ikony na ploche</b>, prihlás sa a v ⚙︎ zapni notifikácie. Na iPhone fungujú až takto, vyžaduje iOS 16.4+.</p></div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-5 space-y-3">
          <h2 className="font-semibold">🤖 Android (Chrome)</h2>
          <div className={step}><span className={num}>1</span><p className="text-sm">Otvor odkaz v <b>Chrome</b>.</p></div>
          <div className={step}><span className={num}>2</span><p className="text-sm">Ťukni na <b>⋮</b> hore vpravo a vyber <b>Inštalovať aplikáciu</b> (alebo <b>Pridať na plochu</b>). Alebo použi tlačidlo „Pridať na plochu“ priamo v chate.</p></div>
          <div className={step}><span className={num}>3</span><p className="text-sm">Prihlás sa a v ⚙︎ zapni notifikácie.</p></div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-5 space-y-2">
          <h2 className="font-semibold">💻 Počítač</h2>
          <p className="text-sm text-slate-300">V Chrome alebo Edge klikni na ikonu inštalácie v adresnom riadku a chat sa otvorí vo vlastnom okne.</p>
        </section>

        <a href="/chat" className="block text-center rounded-xl bg-blue-600 hover:bg-blue-500 py-3 font-medium">Otvoriť chat</a>
      </div>
    </div>
  );
}
