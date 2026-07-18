import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center p-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto h-20 w-20 rounded-full bg-water-gradient shadow-xl flex items-center justify-center text-white text-3xl">
          💧
        </div>
        <h1 className="mt-6 text-3xl font-semibold text-deep">Nothing here</h1>
        <p className="mt-2 text-slate-600">
          This lake seems to have evaporated. Try searching from the home page.
        </p>
        <Link href="/" className="btn-water mt-6 inline-flex">
          Back to shore
        </Link>
      </div>
    </main>
  );
}
