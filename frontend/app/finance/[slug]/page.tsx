import TeamCapView from "@/components/TeamCapView";
import { BackPill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TeamFinancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className="space-y-5 py-2">
      <BackPill href="/finance">Finance</BackPill>
      <TeamCapView slug={slug} />
    </div>
  );
}
