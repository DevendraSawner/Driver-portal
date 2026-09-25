import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import { useAuth } from "../lib/auth";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2.5 2.5 0 0 0 3.5 3.5" />
      <path d="M9.9 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.5 17.5 0 0 1-4.2 5.1" />
      <path d="M6.1 6.1A17.7 17.7 0 0 0 2 12s3.5 7 10 7a10.6 10.6 0 0 0 4.2-.9" />
    </svg>
  );
}

export function LoginPage() {
  const { admin, ready, login } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (ready && admin) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(phone, password);
    } catch (caught) {
      setError(caught instanceof Error && caught.message === "This portal is for admin accounts"
        ? caught.message
        : errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={(event) => void onSubmit(event)} className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm">
        <p className="text-xs tracking-[0.2em] text-[#8a5a22]">ADMIN PORTAL</p>
        <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-black/60">Use the admin phone number and password.</p>
        <label className="mt-6 block text-sm font-medium" htmlFor="phone">
          Phone
        </label>
        <input
          id="phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="username"
          placeholder="+919876543210"
          className="mt-1 w-full rounded border border-black/15 px-3 py-2"
        />
        <label className="mt-4 block text-sm font-medium" htmlFor="password">
          Password
        </label>
        <div className="relative mt-1">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="w-full rounded border border-black/15 px-3 py-2 pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-black/55 hover:text-black"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded bg-[#1c1915] px-4 py-2 text-white disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
