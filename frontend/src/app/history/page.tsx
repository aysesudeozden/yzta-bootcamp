"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchHistory } from "../../services/api";
import ThemeToggle from "../components/ThemeToggle";

interface ChatRecord {
  id: number;
  message: string;
  response: string;
  created_date: string;
}

interface AuthUser {
  id: number;
  name: string;
  surname: string;
  email: string;
  role: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [history, setHistory] = useState<ChatRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const redirectToLogin = useCallback(() => {
    localStorage.removeItem("user");
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      redirectToLogin();
      return;
    }
    try {
      setUser(JSON.parse(stored) as AuthUser);
    } catch {
      redirectToLogin();
    }
  }, [redirectToLogin]);

  useEffect(() => {
    if (!user) return;
    const getHistory = async () => {
      try {
        const response = await fetchHistory(user.id);
        const data = response.data || [];
        setHistory(data);
        if (data.length > 0) {
          setExpandedId(data[0].id);
        }
      } catch (err: any) {
        setError(err.message || "Geçmiş yüklenemedi.");
      } finally {
        setLoading(false);
      }
    };
    getHistory();
  }, [user]);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleLogout = () => {
    redirectToLogin();
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-100 selection:text-blue-900 flex flex-col antialiased">
      {/* ÜST NAVİGASYON */}
      <nav className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-2xs">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 select-none group cursor-pointer min-w-0">
            <div className="grid grid-cols-2 gap-[2px] shrink-0 transition-transform duration-500 ease-in-out group-hover:rotate-180">
              <div className="w-3.5 h-3.5 bg-blue-500 rounded-tl-[3px] shadow-2xs"></div>
              <div className="w-3.5 h-3.5 bg-slate-800 rounded-tr-[3px] shadow-2xs"></div>
              <div className="w-3.5 h-3.5 bg-slate-700 rounded-bl-[3px] shadow-2xs"></div>
              <div className="w-3.5 h-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-br-[3px] shadow-2xs"></div>
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
          </Link>

          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            <Link
              href="/"
              className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-3.5 py-1.5 rounded-xl shadow-2xs"
            >
              ← Yeni Analiz
            </Link>
            <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-800"></div>
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs shrink-0">
                {(user.name[0] ?? "").toLocaleUpperCase("tr-TR")}
              </span>
              <div className="hidden md:flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {user.name} {user.surname}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide truncate">
                  {user.role}
                </span>
              </div>
            </div>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-600 transition-colors p-1 shrink-0 cursor-pointer"
              aria-label="Çıkış yap"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* İÇERİK ALANI */}
      <div className="flex-1 max-w-[1000px] w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Analiz Geçmişi
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Ajanlar tarafından gerçekleştirilen önceki doğrulama süreçleri ve adli veri raporları.
          </p>
        </header>

        {loading && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xs border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 animate-pulse">
            <svg className="animate-spin h-8 w-8 text-blue-600 mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm font-bold uppercase tracking-widest">Kayıtlar Şifreleniyor...</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-rose-700 dark:text-rose-400 text-sm font-medium flex items-center gap-3 shadow-2xs">
             <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
            {error}
          </div>
        )}

        {!loading && !error && history.length === 0 && (
          <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center flex flex-col items-center justify-center shadow-2xs">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/40 rounded-2xl flex items-center justify-center mb-4 border border-slate-200/60 dark:border-slate-700">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-1">Veritabanı Boş</h3>
            <p className="text-sm text-slate-500 dark:text-slate-500 max-w-sm mb-6">Sistemde henüz kaydedilmiş bir analiz raporu bulunmuyor.</p>
            <Link href="/" className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-2xs">
              İlk Analizi Başlat
            </Link>
          </div>
        )}

        {/* KUTUCUKLU (GRID) GEÇMİŞ KARTLARI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {history.map((chat) => {
            const isExpanded = expandedId === chat.id;
            let aiResult: any = {};
            try {
              aiResult = JSON.parse(chat.response);
            } catch {
              aiResult = { status: "BELİRSİZ", summary: "Veri okunamadı." };
            }

            const isTrue = aiResult.status === "DOĞRU";
            const isFalse = aiResult.status === "YANLIŞ";
            
            const dotBgClass = isTrue ? "bg-emerald-500" : isFalse ? "bg-rose-500" : "bg-amber-500";
            const badgeClass = isTrue
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
              : isFalse
              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";

            return (
              <div
                key={chat.id}
                className={`flex flex-col bg-white dark:bg-slate-900 transition-all duration-300 border rounded-2xl ${
                  isExpanded ? "md:col-span-2 border-slate-300 dark:border-slate-700 shadow-md ring-4 ring-slate-50 dark:ring-slate-800/50" : "border-slate-200 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm"
                }`}
              >
                {/* Kart Başlığı (Tıklanabilir) */}
                <div
                  onClick={() => toggleExpand(chat.id)}
                  className={`p-5 sm:p-6 flex flex-col gap-4 cursor-pointer select-none transition-colors ${
                    isExpanded ? "bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 rounded-t-2xl" : "h-full justify-between rounded-2xl hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 w-full">
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase border ${badgeClass}`}>
                          {aiResult.status || "BİLİNMİYOR"}
                        </span>
                        <span className="text-xs font-bold font-mono text-slate-500 dark:text-slate-400 shrink-0">
                          %{aiResult.confidence_score || 0} GÜVEN
                        </span>
                        <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0"></span>
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 shrink-0">
                          {new Date(chat.created_date).toLocaleString('tr-TR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <h3 className={`font-bold text-slate-900 dark:text-slate-100 break-words ${isExpanded ? "text-lg md:text-xl" : "text-base line-clamp-2"}`}>
                        &quot;{chat.message}&quot;
                      </h3>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2 mt-1">
                      <div className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all duration-300 ${
                        isExpanded ? "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 rotate-180" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                      }`}>
                         <svg className={`w-4 h-4 ${isExpanded ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                         </svg>
                      </div>
                    </div>
                  </div>

                  {!isExpanded && (
                    <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-2 text-right w-full">
                      Analiz Detaylarını İncele
                    </div>
                  )}
                </div>

                {/* Açılır Detay Paneli */}
                {isExpanded && (
                  <div className="p-4 sm:p-6 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] rounded-b-2xl overflow-hidden animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className="space-y-8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-5 sm:p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">

                      {/* Yönetici Özeti */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-sm ${dotBgClass}`}></div>
                          Yönetici Özeti
                        </h4>
                        <p className="text-sm sm:text-base font-medium text-slate-600 dark:text-slate-400 leading-relaxed pl-3.5 border-l-2 border-slate-200 dark:border-slate-800 break-words">
                          {aiResult.summary}
                        </p>
                      </div>

                      {/* İddia Kırılımları */}
                      {aiResult.claims_breakdown && aiResult.claims_breakdown.length > 0 && (
                        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-sm bg-slate-900 dark:bg-slate-100"></div>
                            İddia ve Kanıt Analizi
                          </h4>
                          <div className="grid gap-4">
                            {aiResult.claims_breakdown.map((sub: any, idx: number) => (
                              <div key={idx} className="bg-slate-50/50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3 sm:gap-4 shadow-2xs">
                                <span className="font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl h-fit shrink-0 self-start">
                                  {String(idx + 1).padStart(2, "0")}
                                </span>
                                <div className="space-y-2 min-w-0">
                                  <div className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 break-words">{sub.claim}</div>
                                  <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed break-words">{sub.verification}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Kaynaklar */}
                      {aiResult.sources && aiResult.sources.length > 0 && (
                        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-sm bg-slate-900 dark:bg-slate-100"></div>
                            Referans Kaynaklar
                          </h4>
                          <div className="flex flex-wrap gap-2.5">
                            {aiResult.sources.map((source: any, idx: number) => (
                              <a
                                key={idx}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center gap-2.5 px-3.5 py-2 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-500/10 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500/40 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 text-xs font-semibold rounded-xl shadow-2xs transition-all min-w-0 max-w-full"
                              >
                                <span className="truncate">{source.title}</span>
                                <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}