import Link from "next/link";
import { cleanName } from "@/lib/playerName";

/**
 * A player's name, linked to his profile. Prefers the slug, falls back to the id;
 * renders a plain span only when neither is available. Use everywhere a player name
 * appears in a table/list so names are consistently clickable.
 */
export default function PlayerLink({
  name, slug, id, className = "", clean = true,
}: {
  name: string | null | undefined;
  slug?: string | null;
  id?: number | null;
  className?: string;
  clean?: boolean;
}) {
  const label = clean ? cleanName(name ?? "") : (name ?? "");
  const href = slug ? `/players/${slug}` : id != null ? `/players/${id}` : null;
  if (!href) return <span className={className}>{label}</span>;
  return (
    <Link href={href} className={`hover:text-blue-400 transition-colors ${className}`}>
      {label}
    </Link>
  );
}
