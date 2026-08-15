import StatsTabs from "@/components/StatsTabs";
import ComingSoon from "@/components/ComingSoon";
import { PageHeader } from "@/components/ui";

export default function CareerStatsPage() {
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Statistics" subtitle="Player career totals" />
      <StatsTabs active="career" />
      <ComingSoon title="Player Career Stats" points={[
        "Per-player career totals accumulated across seasons, split into Regular Season and Playoffs",
        "One row per season plus a career total line, shown on the player profile",
        "Needs a PlayerSeasonStat table written at each season roll-over so history survives roster changes",
      ]} />
    </div>
  );
}
