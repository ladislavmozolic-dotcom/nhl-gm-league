import StatsTabs from "@/components/StatsTabs";
import ComingSoon from "@/components/ComingSoon";
import { PageHeader } from "@/components/ui";

export default function AdvancedStatsPage() {
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Statistics" subtitle="Advanced metrics" />
      <StatsTabs active="advanced" />
      <ComingSoon title="Advanced Stats" points={[
        "League summary of advanced metrics (Corsi/Fenwick-style shot share, PDO, points%, goal-share) with an overall leaderboard",
        "Filter by team to see that club's skaters/goalies",
        "Derived from existing per-game shots, goals and TOI — needs on-ice event tracking added to the sim engine for true possession metrics",
      ]} />
    </div>
  );
}
