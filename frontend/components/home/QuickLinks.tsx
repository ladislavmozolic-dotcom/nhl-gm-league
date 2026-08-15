export default function QuickLinks() {
  const links = [
    {
      name: "Elite Prospects",
      url: "https://www.eliteprospects.com",
    },
    {
      name: "PuckPedia",
      url: "https://puckpedia.com",
    },
    {
      name: "Daily Faceoff",
      url: "https://www.dailyfaceoff.com",
    },
    {
      name: "NHL.com",
      url: "https://www.nhl.com",
    },
  ];

  return (
    <div className="card p-4">
      <h2 className="text-sm font-bold text-white mb-4">
        🔗 Quick Links
      </h2>

      <div className="space-y-2">
        {links.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="block text-sm text-blue-200 hover:text-white"
          >
            {link.name}
          </a>
        ))}
      </div>
    </div>
  );
}