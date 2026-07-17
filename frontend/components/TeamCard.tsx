type TeamCardProps = {
  name: string;
  gm: string;
  arena: string;
};

export default function TeamCard({
  name,
  gm,
  arena,
}: TeamCardProps) {
  return (
    <div
      style={{
        border: "1px solid #ccc",
        padding: "12px",
        marginBottom: "10px",
        borderRadius: "8px",
      }}
    >
      <h2>{name}</h2>

      <p>GM: {gm}</p>

      <p>Arena: {arena}</p>
    </div>
  );
}