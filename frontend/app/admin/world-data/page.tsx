import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import WorldLeagueSetup from "@/components/WorldLeagueSetup";

export const dynamic = "force-dynamic";

export default async function AdminWorldDataPage() {
  if (!(await isAdmin())) redirect("/");
  const leagueCount = await prisma.worldLeague.count();
  return <div className="space-y-6 py-2"><PageHeader title="Around the World Data" subtitle="Configure the real-world prospect tracker and its supported competitions." /><WorldLeagueSetup leagueCount={leagueCount} /></div>;
}
