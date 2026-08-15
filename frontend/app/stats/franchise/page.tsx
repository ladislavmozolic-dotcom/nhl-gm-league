import StatsTabs from "@/components/StatsTabs";
import ComingSoon from "@/components/ComingSoon";
import { PageHeader } from "@/components/ui";

export default function FranchiseLeadersPage() {
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Statistics" subtitle="Franchise record book" />
      <StatsTabs active="franchise" />
      <ComingSoon title="Franchise Leaders" points={[
        "Per-team all-time record book: most goals/assists/points/wins/shutouts in a single season",
        "New season records overwrite the previous best and log the year they were set",
        "Needs a FranchiseRecord table that is updated at each season roll-over (off-season processing)",
      ]} />
    </div>
  );
}
