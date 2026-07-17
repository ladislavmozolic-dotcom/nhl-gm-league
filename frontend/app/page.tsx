import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold mb-6">
        NHL GM League
      </h1>

      <Link
        href="/teams"
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Teams
      </Link>
    </main>
  );
}