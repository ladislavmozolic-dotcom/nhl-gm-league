import Link from "next/link";
import TeamCapView from "@/components/TeamCapView";

export const dynamic = "force-dynamic";

export default async function TeamFinancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className="space-y-5 py-2">
      <Link href="/finance" className="text-sm text-slate-400 hover:text-blue-400">← Finance</Link>
      <TeamCapView slug={slug} />
    </div>
  );
}
