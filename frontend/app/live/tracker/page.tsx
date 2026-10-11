import Link from "next/link";
import { BackPill, PageHeader } from "@/components/ui";
import LiveRinkTracker from "@/components/live/LiveRinkTracker";

export const metadata = {
  title: "V3 Sim Engine — 2D Live Klzisko Tracker",
  description: "2D Live vizuálny simulátor zápasu pre V3 sim engine (EHM štýl)",
};

export default function LiveTrackerDemoPage() {
  return (
    <div className="space-y-5 max-w-[1750px] mx-auto px-2 sm:px-4 py-4">
      <div className="flex items-center justify-between">
        <BackPill href="/live">Späť na Live Scoreboard</BackPill>
        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
          ● V3 2D Engine Demo
        </span>
      </div>

      <PageHeader
        title="2D Live Sledovanie Zápasu (V3 Sim Engine)"
        subtitle="Interaktívny 2D rink tracker inšpirovaný Eastside Hockey Manager (EHM) s 60 FPS fyzikou, taktikou a zvukmi."
      />

      <LiveRinkTracker
        homeTeamName="New Jersey Devils"
        awayTeamName="New York Rangers"
        homeLogoUrl="/NHLlogos/new_jersey_devils.png"
        awayLogoUrl="/NHLlogos/new_york_rangers.png"
        homeScore={1}
        awayScore={2}
        homeSog={16}
        awaySog={21}
        periodStr="2. Tretina"
        standaloneControls={true}
      />
    </div>
  );
}
