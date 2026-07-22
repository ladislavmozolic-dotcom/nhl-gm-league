import Link from "next/link";

type TeamCardProps = {
  slug: string;
  name: string;
  gm: string;
  arena: string;
};

export default function TeamCard({
  slug,
  name,
  gm,
  arena,
}: TeamCardProps) {
  return (
    <Link href={`/teams/${slug}`}>
      <div
        style={{
          border: "1px solid #334155",
          padding: "12px",
          marginBottom: "10px",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        <h2>{name}</h2>

        <p>GM: {gm}</p>

        <p>Arena: {arena}</p>
      </div>
    </Link>
  );
}