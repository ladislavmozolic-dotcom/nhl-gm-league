type PlayerCardProps = {
  name: string;
};

export default function PlayerCard({
  name,
}: PlayerCardProps) {
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
    </div>
  );
}