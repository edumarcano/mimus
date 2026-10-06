import { getPublicConfig } from "@/lib/server/config";

export default function Home() {
  const config = getPublicConfig();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Parlance</h1>
      <p className="mt-2 text-neutral-600">
        Same thought. Different voice.
      </p>
      <p className="mt-6 text-sm text-neutral-500">
        Mode: {config.mode}. The full translator UI will appear here in a later
        milestone.
      </p>
    </main>
  );
}
