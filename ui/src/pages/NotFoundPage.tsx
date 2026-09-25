import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div>
        <p className="text-sm text-black/60">404</p>
        <h1 className="mt-2 text-3xl font-semibold">Page not found</h1>
        <Link to="/" className="mt-6 inline-block text-sm underline">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
