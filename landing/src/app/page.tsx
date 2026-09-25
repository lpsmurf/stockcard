export default function Home() {
  return (
    <main className="min-h-screen bg-ground text-text">
      <div className="mx-auto max-w-3xl px-6 py-32 text-center">
        <p className="font-numbers text-xs tracking-widest text-accent-2 uppercase">
          Built on Solana · Devnet beta
        </p>
        <h1 className="font-display mt-6 text-5xl font-semibold md:text-7xl">
          Spend what you own. Never sell it.
        </h1>
        <p className="mt-6 text-lg text-text-2">
          A credit card backed by tokenized stocks, graded cards, watches and
          art notes. Lock, borrow, spend — without selling.
        </p>
        <p className="mt-10 text-xs text-text-2">
          In development · Devnet beta · Not available yet
        </p>
      </div>
    </main>
  );
}
