import { getTeamSession, isAdmin } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import RfaCentralSection from "@/components/RfaCentralSection";

export const dynamic = "force-dynamic";

export default async function RfaPage() {
  const teamId = await getTeamSession();
  if (!teamId) return <main className="mx-auto max-w-4xl px-4 py-6"><PageHeader title="RFA Central" subtitle="Qualifying offers, arbitration and offer-sheet risk" /><Card><p className="text-sm text-slate-400">Sign in as a club GM to manage its restricted free agents.</p></Card></main>;
  const admin = await isAdmin();
  return <main className="mx-auto max-w-4xl px-4 py-6 space-y-5">
    <PageHeader title={admin ? "RFA Central — League view" : "RFA Central — Your organization"} subtitle={admin ? "Every club's qualifying offers, arbitration cases and offer-sheet exposure" : "Your NHL club (incl. its farm) qualifying offers, arbitration cases and offer-sheet exposure"} />
    <RfaCentralSection teamId={admin ? undefined : teamId} />
  </main>;
}
