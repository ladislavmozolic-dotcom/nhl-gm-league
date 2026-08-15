import Link from "next/link";

// Site banner shown at the top of every page, between the score tracker and the menu.
export default function SiteBanner() {
  return (
    <Link href="/" className="block bg-gradient-to-r from-[#0a1628] via-[#1e3a5f] to-[#0a1628] border-b border-slate-700/40">
      <div className="max-w-[1400px] mx-auto px-4 py-4 text-center">
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight italic leading-none">ProfiNHL</h1>
        <p className="text-blue-400 text-[11px] md:text-xs font-bold tracking-[0.3em] uppercase mt-1">CZ &amp; SK Online Hockey Manager</p>
      </div>
    </Link>
  );
}
