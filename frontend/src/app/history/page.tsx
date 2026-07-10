"use client";

import { useEffect, useState } from "react";
import { fetchHistory } from "../../services/api"; 
import Link from "next/link";

interface ChatRecord {
  id: number;
  message: string;
  response: string;
  created_date: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<ChatRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const getHistory = async () => {
      try {
        const response = await fetchHistory(1); // Geçici user_id = 1
        const data = response.data || [];
        setHistory(data);
        if (data.length > 0) {
          setExpandedId(data[0].id); // İlk kayıt otomatik açık gelsin
        }
      } catch (err: any) {
        setError(err.message || "Geçmiş yüklenemedi.");
      } finally {
        setLoading(false);
      }
    };
    getHistory();
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 selection:bg-blue-200">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Üst Başlık Alanı */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Sohbet ve Araştırma Geçmişi</h1>
            <p className="text-slate-500 text-sm">
              Geçmiş araştırmalarınızı ve otonom ajanların ürettiği analiz raporlarını buradan inceleyebilirsiniz.
            </p>
          </div>
          <Link href="/" className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 bg-blue-50/80 px-5 py-2.5 rounded-xl transition-colors">
            ← Yeni Sorgu Yap
          </Link>
        </header>

        {/* Yükleniyor ve Hata Durumları */}
        {loading && (
          <div className="flex items-center gap-3 text-slate-500 animate-pulse bg-white p-6 rounded-2xl border border-slate-200">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Veritabanından analiz geçmişiniz çekiliyor...
          </div>
        )}
        
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium">
            {error}
          </div>
        )}

        {!loading && !error && history.length === 0 && (
          <div className="text-slate-500 bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3 shadow-sm">
            <div className="text-4xl">🗂️</div>
            <p className="font-medium text-lg text-slate-700">Henüz bir iddia doğrulamadınız.</p>
            <p className="text-sm">Ana sayfaya dönerek ajanları hemen test edebilirsiniz.</p>
          </div>
        )}

        {/* Kartların Dizildiği Grid (Gerçek Veri) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {history.map((chat) => {
            const isExpanded = expandedId === chat.id;
            
            // Veritabanındaki JSON string'i objeye çeviriyoruz
            let aiResult: any = {};
            try {
              aiResult = JSON.parse(chat.response);
            } catch {
              aiResult = { status: "HATA", summary: "Yanıt çözümlenemedi." };
            }

            // Status'a göre dinamik renk sınıfları belirleme
            const priorityColor = 
              aiResult.status === "DOĞRU" ? "bg-emerald-100 text-emerald-700 ring-emerald-600/20" :
              aiResult.status === "YANLIŞ" ? "bg-rose-100 text-rose-700 ring-rose-600/20" :
              "bg-amber-100 text-amber-700 ring-amber-600/20";

            return (
              <div 
                key={chat.id}
                className={`flex flex-col rounded-2xl transition-all duration-300 ${
                  isExpanded 
                    ? "col-span-1 md:col-span-2 bg-white shadow-xl shadow-slate-200/50 border-slate-300 ring-1 ring-slate-200" 
                    : "bg-white shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 cursor-pointer"
                }`}
              >
                {/* Kartın Tıklanabilir Üst Kısmı */}
                <div 
                  onClick={() => toggleExpand(chat.id)}
                  className={`p-5 flex flex-col justify-center space-y-3 cursor-pointer ${isExpanded ? "border-b border-slate-100" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ring-1 inset-ring ${priorityColor}`}>
                        {aiResult.status || "BİLİNMİYOR"}
                      </span>
                      <span className="text-xs font-medium text-slate-400">
                        %{aiResult.confidence_score || 0} Güven Skoru
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                      {new Date(chat.created_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 line-clamp-2">{chat.message}</h3>
                    {!isExpanded && (
                      <p className="text-sm text-slate-500 mt-2 line-clamp-2">{aiResult.summary}</p>
                    )}
                  </div>
                </div>

                {/* Tıklanınca Açılan Detay (Accordion) Kısmı */}
                {isExpanded && (
                  <div className="p-6 bg-slate-50/50 rounded-b-2xl animate-fadeIn">
                    <h4 className="text-sm font-bold text-slate-900 mb-2">Yönetici Özeti</h4>
                    <p className="text-sm text-slate-600 leading-relaxed mb-6">{aiResult.summary}</p>
                    
                    <h4 className="text-sm font-bold text-slate-900 mb-4 border-t border-slate-200 pt-6">İddia Kırılımları ve Kanıt Analizi</h4>
                    <div className="space-y-4">
                      {aiResult.claims_breakdown?.map((sub: any, idx: number) => (
                        <div key={idx} className="space-y-1 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                          <h5 className="text-sm font-bold text-slate-800 flex gap-2">
                            <span className="text-blue-500 shrink-0">#{idx + 1}</span> {sub.claim}
                          </h5>
                          <p className="text-sm text-slate-600 leading-relaxed pl-6 border-l-2 border-slate-100 ml-1 mt-2">
                            {sub.verification}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-200 space-y-3">
                      <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Doğrulama Kaynakları</h5>
                      <div className="flex flex-wrap gap-2">
                        {aiResult.sources?.map((source: any, idx: number) => (
                          <a 
                            key={idx} 
                            href={source.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg shadow-sm transition-colors"
                          >
                            {source.title} ↗
                          </a>
                        ))}
                      </div>
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