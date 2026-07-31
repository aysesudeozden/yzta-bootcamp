"use client";

import { useState, useEffect, useRef, FormEvent, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { verifyClaimText } from "../services/api";
import ThemeToggle from "./components/ThemeToggle";

interface ClaimBreakdown {
  claim: string;
  verification: string;
  verdict?: "DOĞRU" | "YANLIŞ" | "BELİRSİZ";
  source?: { title: string; url: string };
}

interface Source {
  title: string;
  url: string;
}

interface VerificationResult {
  status: "DOĞRU" | "YANLIŞ" | "BELİRSİZ";
  confidence_score: number;
  summary: string;
  claims_breakdown: ClaimBreakdown[];
  sources: Source[];
}

interface AuthUser {
  id: number;
  name: string;
  surname: string;
  email: string;
  role: string;
}

const MAX_CLAIM_LENGTH = 4000;
const STEP_DURATION_MS = 850;
const TOTAL_STEPS = 4;

const steps = [
  { id: "01", title: "Sentaktik Ayrıştırma", desc: "Metin test edilebilir argümanlara bölünüyor" },
  { id: "02", title: "Arama Orkestrasyonu", desc: "Global haber ve akademik ağlar taranıyor" },
  { id: "03", title: "Çapraz Doğrulama", desc: "Kanıtlar, iddia kırılımlarıyla eşleştiriliyor" },
  { id: "04", title: "Sentez ve Skorlama", desc: "Nihai güvenlik endeksi hesaplanıyor" },
];

const sampleClaims = [
  "Merkez Bankası döviz rezervlerinin son 10 yılın en düşük seviyesine gerilediği açıklandı.",
  "Büyük Dil Modelleri (LLM) enerji tüketiminde küresel karbon emisyonunun %5'ini oluşturuyor.",
  "Yeni yasal düzenleme ile birlikte e-ticaret platformlarında iade kargo ücretleri tamamen müşteriye yansıtılacak.",
];

function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.min(100, Math.max(0, score));
}

export default function Home() {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [claimText, setClaimText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [revealedClaims, setRevealedClaims] = useState<number>(0);
  const revealIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const clearStepInterval = useCallback(() => {
    if (stepIntervalRef.current) {
      clearInterval(stepIntervalRef.current);
      stepIntervalRef.current = null;
    }
  }, []);

  const redirectToLogin = useCallback(() => {
    localStorage.removeItem("user");
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      router.replace("/login");
      return;
    }
    try {
      setUser(JSON.parse(stored) as AuthUser);
    } catch {
      redirectToLogin();
    }
  }, [router, redirectToLogin]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== "user") return;
      if (!e.newValue) {
        redirectToLogin();
        return;
      }
      try {
        setUser(JSON.parse(e.newValue) as AuthUser);
      } catch {
        redirectToLogin();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [redirectToLogin]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearStepInterval();
      abortControllerRef.current?.abort();
    };
  }, [clearStepInterval]);

  useEffect(() => {
    if (revealIntervalRef.current) {
      clearInterval(revealIntervalRef.current);
      revealIntervalRef.current = null;
    }

    if (!result || result.claims_breakdown.length === 0) {
      setRevealedClaims(0);
      return;
    }

    const prefersReducedMotion =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setRevealedClaims(result.claims_breakdown.length);
      return;
    }

    setRevealedClaims(0);
    let count = 0;
    const total = result.claims_breakdown.length;
    revealIntervalRef.current = setInterval(() => {
      count += 1;
      if (!isMountedRef.current) return;
      setRevealedClaims(count);
      if (count >= total && revealIntervalRef.current) {
        clearInterval(revealIntervalRef.current);
        revealIntervalRef.current = null;
      }
    }, 400);

    return () => {
      if (revealIntervalRef.current) {
        clearInterval(revealIntervalRef.current);
        revealIntervalRef.current = null;
      }
    };
  }, [result]);

  const handleLogout = () => {
    abortControllerRef.current?.abort();
    redirectToLogin();
  };

  const handleSelectSample = (sample: string) => {
    setClaimText(sample);
    setError(null);
    setResult(null);
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = claimText.trim();
    if (!trimmed || !user) return;

    abortControllerRef.current?.abort();
    clearStepInterval();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentRequestId = ++requestIdRef.current;

    setLoading(true);
    setResult(null);
    setError(null);
    setActiveStep(0);

    stepIntervalRef.current = setInterval(() => {
      setActiveStep((prev) => (prev < TOTAL_STEPS - 1 ? prev + 1 : prev));
    }, STEP_DURATION_MS);

    try {
      const data: VerificationResult = await verifyClaimText(trimmed, user.id, {
        signal: controller.signal,
      });

      if (currentRequestId !== requestIdRef.current || !isMountedRef.current) return;

      clearStepInterval();
      setActiveStep(TOTAL_STEPS - 1);
      setResult({ ...data, confidence_score: clampScore(data.confidence_score) });
    } catch (err: unknown) {
      if (currentRequestId !== requestIdRef.current || !isMountedRef.current) return;
      clearStepInterval();

      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        setError("Oturumunuzun süresi doldu. Giriş sayfasına yönlendiriliyorsunuz.");
        setTimeout(redirectToLogin, 1500);
        return;
      }

      if (err instanceof Error) {
        setError(err.message || "Sistem analizi sırasında bir anomali tespit edildi.");
      } else {
        setError("Sunucu ile iletişim kurulamadı. Beklenmeyen hata.");
      }
    } finally {
      if (currentRequestId === requestIdRef.current && isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  if (!user) return null;

  const charCount = claimText.length;
  const overLimit = charCount > MAX_CLAIM_LENGTH;
  const hasStarted = loading || result !== null;

  return (
    <main className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-100 selection:text-blue-900 flex flex-col antialiased transition-colors">
      <nav className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-2xs">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 select-none group cursor-pointer min-w-0">
            <div className="grid grid-cols-2 gap-[2px] shrink-0 transition-transform duration-500 ease-in-out group-hover:rotate-180">
              <div className="w-3.5 h-3.5 bg-blue-500 rounded-tl-[3px] shadow-sm"></div>
              <div className="w-3.5 h-3.5 bg-slate-800 dark:bg-slate-300 rounded-tr-[3px] shadow-sm"></div>
              <div className="w-3.5 h-3.5 bg-slate-700 dark:bg-slate-400 rounded-bl-[3px] shadow-sm"></div>
              <div className="w-3.5 h-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-br-[3px] shadow-sm"></div>
            </div>
            <div className="flex items-center relative min-w-0">
              <span className="font-black text-xl sm:text-2xl tracking-tighter text-slate-900 dark:text-slate-100 relative z-10 truncate">
                FACT
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-[1.5px] -z-10 text-rose-500/80 mix-blend-multiply opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                >
                  FACT
                </span>
                <span
                  aria-hidden="true"
                  className="absolute top-0 -left-[1.5px] -z-10 text-cyan-500/80 mix-blend-multiply opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                >
                  FACT
                </span>
              </span>
              <span className="font-light text-xl sm:text-2xl tracking-tighter text-blue-600 ml-[1px]">CHECK</span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            <Link
              href="/history"
              className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3.5 py-1.5 rounded-xl shadow-2xs"
            >
              Analiz Geçmişi
            </Link>
            {user.role === "admin" && (
              <Link
                href="/admin"
                className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors bg-blue-50 dark:bg-blue-500/10 px-3.5 py-1.5 rounded-xl shadow-2xs"
              >
                Admin Panel
              </Link>
            )}
            <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-800"></div>
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs shrink-0">
                {(user.name[0] ?? "").toLocaleUpperCase("tr-TR")}
              </span>
              <div className="hidden md:flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {user.name} {user.surname}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide truncate">
                  {user.role}
                </span>
              </div>
            </div>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-500 transition-colors p-1 shrink-0 cursor-pointer"
              aria-label="Çıkış yap"
              title="Çıkış Yap"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <div
        className={`flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 grid gap-8 xl:gap-10 items-start ${
          hasStarted ? "grid-cols-1 xl:grid-cols-12" : "grid-cols-1"
        }`}
      >
        <section
          className={
            hasStarted
              ? "xl:col-span-5 space-y-8 min-w-0 xl:sticky xl:top-24"
              : "w-full max-w-2xl mx-auto space-y-8"
          }
        >
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-semibold tracking-wide shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Otonom Ağ Aktif
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-[1.15]">
              Gerçek Zamanlı <br />
              <span className="text-slate-400 dark:text-slate-500 font-medium">Doğrulama Asistanı</span>
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
              Şüpheli metni yapıştırın. Yapay zeka ajanları saniyeler içinde kaynak taraması yaparak kanıta dayalı bir rapor sunacaktır.
            </p>
          </div>

          <form
            onSubmit={handleVerify}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xs border border-slate-200 dark:border-slate-800 overflow-hidden transition-all focus-within:ring-2 focus-within:ring-slate-900/5 dark:focus-within:ring-slate-100/10 focus-within:border-slate-300 dark:focus-within:border-slate-700"
          >
            <div className="bg-slate-50/50 dark:bg-slate-800/60 px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center gap-3">
              <label htmlFor="claim-input" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Analiz Girdisi
              </label>
              <span className={`text-[10px] font-semibold font-mono shrink-0 ${overLimit ? "text-rose-600 dark:text-rose-400" : "text-slate-400 dark:text-slate-500"}`}>
                {charCount}/{MAX_CLAIM_LENGTH}
              </span>
            </div>

            <textarea
              id="claim-input"
              rows={6}
              className="w-full bg-transparent p-5 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-base font-medium focus:outline-none resize-none"
              placeholder="Araştırılacak haberi, finansal iddiayı veya içeriği buraya yapıştırın..."
              value={claimText}
              onChange={(e) => setClaimText(e.target.value)}
              disabled={loading}
              aria-describedby="claim-length-hint"
            />
            {overLimit && (
              <p id="claim-length-hint" className="px-5 pb-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                Metin {MAX_CLAIM_LENGTH} karakter sınırını aşıyor. Lütfen kısaltın.
              </p>
            )}

            <div className="p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-5">
              <div className="space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Örnek Parametreler</span>
                <div className="flex flex-col gap-2">
                  {sampleClaims.map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => handleSelectSample(sample)}
                      disabled={loading}
                      className="text-left text-xs font-medium bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 py-2.5 px-3.5 rounded-xl transition-colors truncate w-full border border-slate-200/60 dark:border-slate-700/60 shadow-2xs cursor-pointer"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !claimText.trim() || overLimit}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white dark:text-slate-900 transition-colors text-sm font-semibold rounded-xl shadow-2xs cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Analiz Ediliyor...</span>
                  </>
                ) : (
                  <span>Doğrulamayı Başlat</span>
                )}
              </button>
            </div>
          </form>

          {error && (
            <div
              role="alert"
              className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl text-rose-700 dark:text-rose-400 text-sm font-medium flex items-center gap-3 shadow-2xs"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </section>

        {hasStarted && (
        <section className="xl:col-span-7 w-full min-w-0">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-sm flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex gap-1.5 shrink-0" aria-hidden="true">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                </div>
                <div className="h-3 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
                  İşlem Kayıtları
                </span>
              </div>
              <span
                className={`text-[10px] font-bold font-mono uppercase tracking-widest shrink-0 ${
                  loading ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" aria-hidden="true"></span>
                    VERİ İŞLENİYOR
                  </span>
                ) : (
                  "ANALİZ TAMAMLANDI"
                )}
              </span>
            </div>

            <div className="flex-1 relative bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] p-4 sm:p-6">
          {loading && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xs border border-slate-200 dark:border-slate-800 p-6 sm:p-8 min-h-[460px] flex flex-col justify-center relative overflow-hidden animate-in fade-in duration-500">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-10 border-b border-slate-100 dark:border-slate-800 pb-4">
                Ayrıştırma Adımları
              </h3>

              <div className="space-y-8 relative before:absolute before:inset-0 before:left-[17px] before:w-px before:bg-slate-100 dark:before:bg-slate-800">
                {steps.map((step, index) => {
                  const isPast = index < activeStep;
                  const isCurrent = index === activeStep;
                  return (
                    <div
                      key={step.id}
                      className={`flex items-start gap-5 relative z-10 transition-opacity duration-300 ${
                        isPast || isCurrent ? "opacity-100" : "opacity-40"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 bg-white dark:bg-slate-900 transition-colors duration-300 ${
                          isCurrent
                            ? "border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 shadow-[0_0_0_4px_rgba(37,99,235,0.1)]"
                            : isPast
                            ? "border-slate-800 dark:border-slate-300 text-slate-800 dark:text-slate-300"
                            : "border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        {isPast ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-xs font-bold">{step.id}</span>
                        )}
                      </div>
                      <div className="pt-2 flex-1 min-w-0">
                        <div className={`text-sm font-bold ${isCurrent ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}>
                          {step.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{step.desc}</div>
                        {isCurrent && (
                          <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-3 overflow-hidden">
                            <div className="h-full bg-blue-600 dark:bg-blue-400 w-full animate-progress origin-left"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {result && !loading && (
            <article className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="space-y-2 text-center md:text-left">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nihai Karar</span>
                  <div className="flex items-center gap-3 justify-center md:justify-start">
                    <div
                      className={`w-3 h-3 rounded-full shrink-0 ${
                        result.status === "DOĞRU"
                          ? "bg-emerald-500"
                          : result.status === "YANLIŞ"
                          ? "bg-rose-500"
                          : "bg-amber-500"
                      }`}
                    />
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 uppercase">
                      {result.status}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <div className="text-3xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tighter">
                      %{result.confidence_score}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Güven Endeksi</div>
                  </div>
                  <div className="w-14 h-14 rounded-full relative flex items-center justify-center bg-white dark:bg-slate-900 shadow-2xs border border-slate-100 dark:border-slate-800 shrink-0">
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90" aria-hidden="true">
                      <circle cx="28" cy="28" r="24" fill="none" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="4" />
                      <circle
                        cx="28"
                        cy="28"
                        r="24"
                        fill="none"
                        strokeWidth="4"
                        strokeLinecap="round"
                        className={
                          result.status === "DOĞRU"
                            ? "stroke-emerald-500"
                            : result.status === "YANLIŞ"
                            ? "stroke-rose-500"
                            : "stroke-amber-500"
                        }
                        style={{
                          strokeDasharray: 151,
                          strokeDashoffset: 151 - (151 * result.confidence_score) / 100,
                        }}
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-10">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-slate-900 dark:bg-slate-100 rounded-sm"></div>
                    Doğrulama Özeti
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base leading-relaxed pl-3.5 border-l-2 border-slate-200 dark:border-slate-800 font-medium">
                    {result.summary}
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-slate-900 dark:bg-slate-100 rounded-sm"></div>
                    İddia ve Kanıt Analizi
                  </h3>

                  <div className="rounded-2xl bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] border border-slate-200/70 dark:border-slate-800/70 p-3 sm:p-5">
                    <div className="space-y-4">
                      {result.claims_breakdown.map((item, idx) => {
                        const isRevealed = idx < revealedClaims;
                        const linkedSource =
                          item.source ?? (result.sources.length > 0 ? result.sources[idx % result.sources.length] : null);
                        const tilt = idx % 2 === 0 ? "-rotate-1" : "rotate-1";
                        const verdictStyle =
                          item.verdict === "DOĞRU"
                            ? "text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10"
                            : item.verdict === "YANLIŞ"
                            ? "text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10"
                            : "text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10";

                        return (
                          <div
                            key={`${item.claim}-${idx}`}
                            className={`flex flex-col md:flex-row md:items-stretch gap-2 md:gap-0 transition-all duration-500 ${
                              isRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
                            }`}
                          >
                            <div
                              className={`relative bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs flex-1 min-w-0 transition-transform duration-300 hover:rotate-0 ${tilt}`}
                            >
                              <span
                                aria-hidden="true"
                                className="absolute -top-1.5 left-5 w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-slate-900 shadow-2xs"
                              />
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <span className="font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded-md shrink-0 border border-slate-200/60 dark:border-slate-700/60">
                                  {String(idx + 1).padStart(2, "0")}
                                </span>
                                {item.verdict && (
                                  <span
                                    className={`text-[10px] font-black tracking-widest uppercase border px-2 py-0.5 rounded-md shrink-0 ${verdictStyle}`}
                                  >
                                    {item.verdict}
                                  </span>
                                )}
                              </div>
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm break-words">&quot;{item.claim}&quot;</div>
                              <div className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed break-words mt-1.5">
                                {item.verification}
                              </div>
                            </div>

                            {linkedSource && (
                              <div
                                className="flex md:flex-col items-center justify-center shrink-0 md:w-10"
                                aria-hidden="true"
                              >
                                <svg
                                  className="w-5 h-5 text-slate-300 dark:text-slate-700 rotate-90 md:rotate-0"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4-4m4-4H3" />
                                </svg>
                              </div>
                            )}

                            {linkedSource && (
                              <a
                                href={linkedSource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 md:w-56 shrink-0 flex flex-col justify-center transition-colors min-w-0 shadow-2xs"
                              >
                                <div className="flex items-center gap-1.5 mb-1 min-w-0">
                                  <svg
                                    className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                                    />
                                  </svg>
                                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">{linkedSource.title}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{linkedSource.url}</span>
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-slate-900 dark:bg-slate-100 rounded-sm"></div>
                      Doğrulama Kaynakları
                    </h3>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl shrink-0 border border-slate-200/60 dark:border-slate-700/60">
                      {result.sources.length} Bağlantı
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    {result.sources.map((src, idx) => (
                      <a
                        key={`${src.url}-${idx}`}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors min-w-0 shadow-2xs"
                      >
                        <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                          <svg
                            className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                            />
                          </svg>
                        </div>
                        <span className="font-semibold text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 truncate">
                          {src.title}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          )}
            </div>
          </div>
        </section>
        )}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes progress {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
        .animate-progress {
          animation: progress ${STEP_DURATION_MS}ms linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-progress { animation: none; transform: scaleX(1); }
        }
      `,
        }}
      />
    </main>
  );
}