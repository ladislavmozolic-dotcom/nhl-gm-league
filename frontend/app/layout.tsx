import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import ScoreTracker from "@/components/ScoreTracker";
import SiteBanner from "@/components/SiteBanner";
import MegaMenu from "@/components/MegaMenu";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ProfiNHL - NHL GM League",
  description: "CZ/SK Online Hockey League",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // signed-in GM (per-team session) → show nickname + logout in the menu
  const teamId = await getTeamSession();
  const t = teamId ? await prisma.team.findUnique({ where: { id: teamId }, select: { slug: true, gmNickname: true, gm: true, isAdmin: true } }) : null;
  const gm = t ? { nickname: t.gmNickname || t.gm || "GM", slug: t.slug, admin: t.isAdmin } : null;

  return (
    <html lang="en">
      <body
        className={`${inter.className} bg-[#0a1628] text-white min-h-screen`}
      >
        <ScoreTracker />
        <SiteBanner />
        <MegaMenu gm={gm} />
        <main className="pt-4 pb-16 max-w-[1400px] mx-auto px-4">{children}</main>
      </body>
    </html>
  );
}