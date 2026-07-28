"use client";

import { useState, FormEvent, SVGProps } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

// Şifre gücü: 8+ karakter, sayı, büyük harf, 12+ karakter veya özel karakter → 0-4 arası skor
function passwordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (/\d/.test(password)) score++;
  if (/[A-ZÇĞİÖŞÜ]/.test(password)) score++;
  if (password.length >= 12 || /[^a-zA-Z0-9]/.test(password)) score++;
  return score;
}

const STRENGTH_COLORS = ["bg-red-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"];

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [name, setName] = useState<string>("");
  const [surname, setSurname] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const strength = passwordStrength(password);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8 || !/\d/.test(password) || !/[A-ZÇĞİÖŞÜ]/.test(password)) {
      setError("Şifre en az 8 karakter olmalı, 1 sayı ve 1 büyük harf içermeli.");
      return;
    }

    setLoading(true);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8000/api" : "/api");
      const res = await fetch(`${baseUrl}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, surname, email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? "Hesap oluşturulamadı. Lütfen tekrar deneyin.");
      }

      const user = await res.json();
      localStorage.setItem("user", JSON.stringify(user));
      router.push("/");
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Sunucuya ulaşılamadı. Backend'in çalıştığından emin olun."
          : err instanceof Error
            ? err.message
            : "Hesap oluşturulamadı. Lütfen tekrar deneyin."
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#161616] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1c1c1c] p-8 shadow-2xl">
        <h1 className="text-2xl font-bold text-white">Hesap oluştur</h1>
        <p className="mt-1.5 text-sm text-gray-400">
          Zaten hesabın var mı?{" "}
          <Link href="/login" className="font-medium text-blue-500 hover:text-blue-400">
            Giriş yap
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-gray-200"
              >
                Ad
              </label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ahmet"
                  className="w-full rounded-lg border border-white/10 bg-[#141414] py-2.5 pl-9 pr-3.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="surname"
                className="mb-1.5 block text-sm font-medium text-gray-200"
              >
                Soyad
              </label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="surname"
                  type="text"
                  required
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  placeholder="Yılmaz"
                  className="w-full rounded-lg border border-white/10 bg-[#141414] py-2.5 pl-9 pr-3.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-gray-200"
            >
              E-posta
            </label>
            <div className="relative">
              <MailIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ahmet@sirket.com"
                className="w-full rounded-lg border border-white/10 bg-[#141414] py-2.5 pl-9 pr-3.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-gray-200"
            >
              Şifre
            </label>
            <div className="relative">
              <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="En az 8 karakter"
                className="w-full rounded-lg border border-white/10 bg-[#141414] py-2.5 pl-9 pr-10 text-sm text-white placeholder-gray-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-200"
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                {showPassword ? (
                  <EyeOffIcon className="h-4.5 w-4.5" />
                ) : (
                  <EyeIcon className="h-4.5 w-4.5" />
                )}
              </button>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition ${i < strength ? STRENGTH_COLORS[strength - 1] : "bg-white/10"
                    }`}
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              En az 8 karakter, 1 sayı ve 1 büyük harf.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={() => setTermsAccepted((v) => !v)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#141414] accent-blue-600"
            />
            <span>
              <a href="#" className="text-blue-500 hover:text-blue-400">
                Kullanım koşullarını
              </a>{" "}
              ve{" "}
              <a href="#" className="text-blue-500 hover:text-blue-400">
                gizlilik politikasını
              </a>{" "}
              kabul ediyorum.
            </span>
          </label>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!termsAccepted || loading}
            className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-[#2a2a2a] disabled:text-gray-500"
          >
            {loading ? "Hesap oluşturuluyor..." : "Hesabı oluştur"}
          </button>
        </form>
      </div>
    </div>
  );
}
