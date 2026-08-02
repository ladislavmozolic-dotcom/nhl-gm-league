import "./globals.css";
import Link from "next/link";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <nav
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #334155",
            marginBottom: "24px",
            display: "flex",
            gap: "20px",
          }}
        >
          <Link href="/teams">Teams</Link>
          <Link href="/trade-block">Trade Block</Link>
          <Link href="/waivers">Waivers</Link>
          <Link href="/transactions">Transactions</Link>
          <Link href="/trades">Trades</Link>
        </nav>

        {children}
      </body>
    </html>
  );
}