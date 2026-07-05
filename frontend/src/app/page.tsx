"use client";

import { useState, FormEvent } from "react";
import { verifyClaimText } from "../services/api";

// 1. ADIM: Tip Tanımlamaları (Interface)
interface ClaimBreakdown {
  claim: string;
  verification: string;
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

// 2. ADIM: Ana Bileşen
export default function Home() {
  const [claimText, setClaimText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0);

  // UX Şovu: Jürinin tek tıkla test edebileceği hazır iddia çiplerini (chips) tanımlıyoruz
  const sampleClaims = [
    "NASA geçen hafta Ay'da su okyanusu bulduğunu resmi olarak açıkladı.",
    "Günde 3 bardak kahve içmek insan ömrünü ortalama 5 yıl uzatıyor.",
    "Büyük Gize Piramidi, milattan önce 10.000 yılında uzaylılar tarafından inşa edilmiştir."
  ];

  const steps = [
    { title: "Ayrıştırma Ajanı", desc: "Metin kontrol edilebilir alt iddialara bölünüyor" },
    { title: "Arama Ajanı", desc: "Canlı web ve bilimsel veritabanları taranıyor" },
    { title: "Karşılaştırma Ajanı", desc: "Bulgular ile iddialar çapraz analize tabi tutuluyor" },
    { title: "Skorlama Ajanı", desc: "Nihai güven skoru ve kanıt raporu sentezleniyor" }
  ];

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!claimText.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setActiveStep(0);

    const stepInterval = setInterval(() => {
      setActiveStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 850);

    try {
      const data: VerificationResult = await verifyClaimText(claimText);
      clearInterval(stepInterval);
      setResult(data);
    } catch (err: unknown) {
      clearInterval(stepInterval);
      if (err instanceof Error) {
        setError(err.message || "Bir hata oluştu. Lütfen tekrar deneyin.");
      } else {
        setError("Beklenmeyen bir hata oluştu.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSampleClick = (text: string) => {
    setClaimText(text);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-800 py-12 px-4 sm:px-6 lg:px-8 selection:bg-blue-600 selection:text-white">
      
      {/* Arka Plan Dekoratif Aydınlatma (SaaS Glow Effect) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-50/80 via-indigo-50/30 to-transparent pointer-events-none -z-10" />

      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Üst Başlık (Hero Section) */}
        <header className="text-center space-y-4 pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-600">
              Multi-Agent AI Architecture
            </span>
          </div>
          
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            Gerçek Zamanlı <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Doğrulama</span> Asistanı
          </h1>
          
          <p className="max-w-xl mx-auto text-base sm:text-lg text-slate-600 leading-relaxed">
            Şüpheli haberleri, sosyal medya paylaşımlarını ve iddiaları otonom yapay zeka ajanlarıyla saniyeler içinde kanıtlayın.
          </p>
        </header>

        {/* Giriş Kartı (Input Section) */}
        <section className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-200/80 backdrop-blur-sm transition-all">
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="flex justify-between items-center">
              <label htmlFor="claim" className="block text-sm font-semibold text-slate-700">
                Analiz Edilecek İddia
              </label>
              <span className="text-xs font-medium text-slate-400">
                {claimText.length} karakter
              </span>
            </div>

            <div className="relative">
              <textarea
                id="claim"
                rows={4}
                className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all duration-200 text-slate-800 placeholder-slate-400 text-sm sm:text-base resize-none leading-relaxed"
                placeholder="Doğrulamasını yapmak istediğiniz metni veya haberi buraya yapıştırın..."
                value={claimText}
                onChange={(e) => setClaimText(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Hızlı Örnek Çipleri (Jüri için UX kolaylığı) */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-medium text-slate-400 block">⚡ Hızlı Deneme Örnekleri:</span>
              <div className="flex flex-wrap gap-2">
                {sampleClaims.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSampleClick(sample)}
                    disabled={loading}
                    className="text-left text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200/60 border border-transparent text-slate-600 py-1.5 px-3 rounded-lg transition-all duration-150 truncate max-w-[280px] sm:max-w-xs"
                  >
                    "{sample}"
                  </button>
                ))}
              </div>
            </div>

            {/* Buton Alanı */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={loading || !claimText.trim()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-slate-900 hover:bg-blue-600 disabled:bg-slate-300 text-white font-semibold text-sm sm:text-base rounded-xl shadow-lg shadow-slate-900/10 hover:shadow-blue-600/20 active:scale-[0.99] transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Ajanlar Çalışıyor...</span>
                  </>
                ) : (
                  <>
                    <span>Doğrula ve Analiz Et</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Ajan Orkestrasyon Akışı (Senior Stepper Component) */}
        {loading && (
          <section className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-200/80 animate-fadeIn">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600" />
                </span>
                <h3 className="font-bold text-sm text-slate-800 tracking-wide uppercase">
                  Ajan Orkestrasyonu Aktif
                </h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md">
                Adım {activeStep + 1} / 4
              </span>
            </div>

            <div className="space-y-6 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-100">
              {steps.map((step, index) => {
                const isDone = index < activeStep;
                const isCurrent = index === activeStep;
                return (
                  <div key={index} className="flex items-start gap-4 relative z-10 transition-all duration-300">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 shrink-0 ${
                      isDone ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" :
                      isCurrent ? "bg-blue-600 text-white ring-4 ring-blue-100 shadow-md shadow-blue-600/20 scale-110" :
                      "bg-slate-100 text-slate-400 border border-slate-200"
                    }`}>
                      {isDone ? "✓" : index + 1}
                    </div>
                    <div className="space-y-0.5 pt-0.5">
                      <div className={`text-sm font-bold transition-colors ${isCurrent ? "text-blue-900" : isDone ? "text-slate-700" : "text-slate-400"}`}>
                        {step.title}
                      </div>
                      <div className={`text-xs ${isCurrent ? "text-slate-600 font-medium animate-pulse" : "text-slate-400"}`}>
                        {step.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Hata Bildirimi */}
        {error && (
          <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-xl text-rose-800 text-sm font-medium flex items-center gap-3 shadow-sm animate-shake">
            <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Sonuç Kartı (Senior SaaS Dashboard Style) */}
        {result && !loading && (
          <article className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/80 overflow-hidden transition-all animate-fadeIn">
            
            {/* Üst Bar: Güven Skoru Progress Bar */}
            <div className="w-full bg-slate-100 h-2">
              <div 
                className={`h-full transition-all duration-1000 ${
                  result.status === "DOĞRU" ? "bg-emerald-500" :
                  result.status === "YANLIŞ" ? "bg-rose-500" : "bg-amber-500"
                }`}
                style={{ width: `${result.confidence_score}%` }}
              />
            </div>

            <div className="p-6 sm:p-8 space-y-8">
              
              {/* Rozet ve Güven Skoru Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className={`px-4 py-1.5 rounded-full text-xs font-extrabold tracking-wider uppercase border shadow-sm ${
                    result.status === "DOĞRU" ? "bg-emerald-50 text-emerald-700 border-emerald-200/80" :
                    result.status === "YANLIŞ" ? "bg-rose-50 text-rose-700 border-rose-200/80" :
                    "bg-amber-50 text-amber-700 border-amber-200/80"
                  }`}>
                    ● {result.status}
                  </span>
                  <span className="text-slate-400 text-sm">|</span>
                  <span className="text-slate-600 text-sm font-medium">Yapay Zeka Karar Raporu</span>
                </div>
                
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black tracking-tight text-slate-900">
                    %{result.confidence_score}
                  </span>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Güven Skoru
                  </span>
                </div>
              </div>

              {/* Orkestrasyon Özeti (Callout Box) */}
              <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-200/60 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Yönetici Özeti (Executive Summary)</span>
                </div>
                <p className="text-slate-700 leading-relaxed text-sm sm:text-base font-normal">
                  {result.summary}
                </p>
              </div>

              {/* Alt İddia Kırılımları */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  İddia Kırılımları ve Kanıt Analizi
                </h3>
                <div className="grid gap-3">
                  {result.claims_breakdown.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-slate-200/80 hover:border-slate-300 transition-colors bg-white shadow-sm space-y-1.5">
                      <div className="font-semibold text-slate-800 text-sm flex items-start gap-2">
                        <span className="text-blue-600 font-bold shrink-0">#0{idx + 1}</span>
                        <span>{item.claim}</span>
                      </div>
                      <div className="text-slate-600 text-sm leading-normal pl-6 border-l-2 border-slate-200">
                        {item.verification}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Kaynakça (Grounding Section - Projenin Can Damarı) */}
              <div className="pt-6 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Doğrulama Kaynakları (Grounding Links)</span>
                  </h3>
                  <span className="text-xs text-slate-400">{result.sources.length} Kaynak Taranıp Eşleştirildi</span>
                </div>
                
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {result.sources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between p-3 rounded-lg border border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/30 transition-all duration-150 text-sm"
                    >
                      <span className="font-medium text-slate-700 group-hover:text-blue-700 truncate pr-2">
                        {src.title}
                      </span>
                      <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>

            </div>
          </article>
        )}

      </div>
    </main>
  );
}