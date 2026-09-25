import { PageHeader, Card, BackPill } from "@/components/ui";
import NominationForm from "@/components/all-star/NominationForm";

export const dynamic = "force-dynamic";

export default function NominatePage() {
  return (
    <div className="space-y-6 py-2 max-w-3xl">
      <PageHeader title="⭐ All-Star nominations" subtitle="Nominate 3 forwards, 2 defensemen and 1 goalie from your roster" right={<BackPill href="/all-star">All-Star</BackPill>} />
      <Card>
        <p className="text-sm text-slate-400">Your division&apos;s All-Star coach picks his 11-man team (6 F / 3 D / 2 G) from every club&apos;s nominees — each club gets at least one All-Star. Clubs that don&apos;t nominate by the deadline are filled in automatically from season performance.</p>
        <NominationForm />
      </Card>
    </div>
  );
}
