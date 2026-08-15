import { redirect } from "next/navigation";

// Per-team cap detail now lives on the team's Finance page (everything together).
export default async function Redirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/finance/${slug}`);
}
