import StatsTabs from "@/components/StatsTabs";
import ComingSoon from "@/components/ComingSoon";
import { PageHeader } from "@/components/ui";
import { getLang } from "@/lib/lang-server";
import { t } from "@/lib/i18n";

export default async function FranchiseLeadersPage() {
  const lang = await getLang();
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Statistics" subtitle={t(lang, "stats.franchise.subtitle")} />
      <StatsTabs active="franchise" />
      <ComingSoon title="Franchise Leaders" points={[
        "Per-team all-time record book: most goals/assists/points/wins/shutouts in a single season",
        "New season records overwrite the previous best and log the year they were set",
        "Needs a FranchiseRecord table that is updated at each season roll-over (off-season processing)",
      ]} />
    </div>
  );
}
