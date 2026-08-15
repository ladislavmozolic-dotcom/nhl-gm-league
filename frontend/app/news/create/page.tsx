import { redirect } from "next/navigation";
import { getTeamSession } from "@/lib/auth";
import NewsEditor from "@/components/NewsEditor";

export const dynamic = "force-dynamic";

export default async function CreateNewsPage() {
  const session = await getTeamSession();
  if (!session) redirect("/login");
  return <div className="py-4"><NewsEditor /></div>;
}
