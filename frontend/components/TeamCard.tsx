type TeamCardProps = {
  name: string;
};

export default function TeamCard({
  name,
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

      <p>GM: Ladislav Mozolic</p>
    </div>
  );
}