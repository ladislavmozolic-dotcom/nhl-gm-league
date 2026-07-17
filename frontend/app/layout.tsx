import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <header
          style={{
            backgroundColor: "#1e293b",
            color: "white",
            padding: "16px",
          }}
        >
          <h1>NHL GM League</h1>

          <nav>
            <a href="/">Home</a>
            {" | "}
            <a href="/league">League</a>
            {" | "}
            <a href="/teams">Teams</a>
            {" | "}
            <a href="/players">Players</a>
          </nav>
        </header>

        <main
          style={{
            padding: "20px",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}