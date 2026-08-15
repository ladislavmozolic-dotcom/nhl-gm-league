import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// "Farm" now jumps straight to the AHL affiliate's own team hub.
// This route just redirects to the first affiliate (kept for old links).
export default async function TeamFarmRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({
    where: { slug },
    include: { affiliateTeams: { select: { slug: true }, take: 1 } },
  });
  if (!team) notFound();
  const aff = team.affiliateTeams[0];
  redirect(aff ? `/teams/${aff.slug}` : `/teams/${slug}`);
}
