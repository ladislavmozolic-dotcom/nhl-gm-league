import { prisma } from "@/lib/prisma";

export default async function TransactionsPage() {
  const transactions = await (prisma as any).transaction.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "24px",
      }}
    >
      <h1>
        Transactions ({transactions.length})
      </h1>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>Message</th>
          </tr>
        </thead>

        <tbody>
          {transactions.map((t: any) => (
            <tr key={t.id}>
              <td style={{ padding: "8px" }}>
                {new Date(
                  t.createdAt
                ).toLocaleString()}
              </td>

              <td style={{ padding: "8px" }}>
                {t.type}
              </td>

              <td style={{ padding: "8px" }}>
                {t.message}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
