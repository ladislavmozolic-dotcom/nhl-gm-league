import { redirect } from "next/navigation";

// Retired: last-season stats now sync automatically with the Live Calculator (daily 08:00,
// or "Sync Live Data" on the Player Calculator page). Old links land there.
export default function PlayerDataPage() {
  redirect("/tools/player-calculator");
}
