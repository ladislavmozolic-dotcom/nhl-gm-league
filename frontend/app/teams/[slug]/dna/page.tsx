import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { teamDna } from "@/lib/team-dna-server";
import TeamDnaCard from "@/components/TeamDnaCard";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TeamDnaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true } });
  if (!team) notFound();
  const dna = await teamDna(team.id);
  return (
    <div className="space-y-5">
      {dna ? <TeamDnaCard dna={dna} /> : <Card><p className="text-sm text-slate-500">Not enough roster data to profile this club yet.</p></Card>}
    </div>
  );
}
