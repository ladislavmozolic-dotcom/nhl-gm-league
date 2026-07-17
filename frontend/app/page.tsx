import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold mb-6">
        NHL GM League
      </h1>

      <div className="flex gap-4">
        <Link
          href="/teams"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          NHL Teams
        </Link>

        <Link
          href="/ahl"
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          AHL Teams
        </Link>

        <Link
          href="/players"
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
          Players
        </Link>

        <Link
          href="/contracts"
          className="bg-indigo-600 text-white px-4 py-2 rounded"
        >
          Contracts
        </Link>
      </div>
    </main>
  );
}