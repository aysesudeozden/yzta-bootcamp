"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ChatLog {
  id: number;
  user_name: string;
  user_surname: string;
  user_email?: string;
  claim_text: string;
  ai_response: string;
  created_at: string;
}

export default function AdminLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      router.replace("/login");
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      if (user.role !== "admin") {
        router.replace("/");
        return;
      }
    } catch {
      localStorage.removeItem("user");
      router.replace("/login");
      return;
    }

    const fetchLogs = async () => {
      try {
        setLoading(true);
        const user = JSON.parse(storedUser);
        const adminId = user.id;

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8000/api" : "/api");
        const response = await fetch(`${baseUrl}/admin/logs?admin_id=${adminId}`);

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error("Erişim reddedildi. Bu işlemi sadece yöneticiler yapabilir.");
          }
          throw new Error("Veriler getirilirken bir hata oluştu.");
        }

        const data = await response.json();
        setLogs(data.logs);
      } catch (err: any) {
        setError(err.message || "Bir şeyler ters gitti.");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [router]);

  const filteredLogs = logs.filter(
    (log) =>
      log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.claim_text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen w-full bg-[#161616] text-gray-100 px-4 py-10 md:px-10 font-sans">
      <div className="max-w-6xl mx-auto">

        <div className="mb-8 border-b border-white/5 pb-6">
          <h1 className="text-2xl md:text-3xl font-semibold text-white">
            Yönetici Kontrol Paneli
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Doğrulama geçmişini izleyin ve logları yönetin
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Kullanıcı adı veya iddia ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition focus:border-blue-500"
            />
          </div>
          <button className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#1c1c1c] px-5 py-3 text-sm font-medium text-gray-300 hover:bg-white/5 transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtrele
          </button>
        </div>

        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 text-center mb-6">
            {error}
          </div>
        )}

        {!loading && !error && filteredLogs.length === 0 && (
          <div className="text-center py-12 border border-white/5 rounded-2xl bg-[#1c1c1c]">
            <p className="text-sm text-gray-500">Gösterilecek herhangi bir log kaydı bulunamadı.</p>
          </div>
        )}

        {!loading && !error && filteredLogs.length > 0 && (
          <div className="hidden md:block overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c1c] shadow-2xl">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-[#141414] border-b border-white/10 text-gray-300">
                <tr>
                  <th className="py-4 px-6 font-medium">ID</th>
                  <th className="py-4 px-6 font-medium">Kullanıcı</th>
                  <th className="py-4 px-6 font-medium">Sorgulanan İddia</th>
                  <th className="py-4 px-6 font-medium">Gemini Analizi</th>
                  <th className="py-4 px-6 font-medium text-right">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-white/5">
                    <td className="py-4 px-6">
                      <span className="rounded-lg bg-[#141414] px-2.5 py-1 text-xs font-mono text-gray-400 border border-white/5">
                        #{log.id}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-white">
                        {log.user_name} {log.user_surname}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {log.user_email || "kullanici@ornek.com"}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-300 max-w-xs truncate" title={log.claim_text}>
                      {log.claim_text}
                    </td>
                    <td className="py-4 px-6 text-gray-400 max-w-md truncate" title={log.ai_response}>
                      {log.ai_response}
                    </td>
                    <td className="py-4 px-6 text-gray-500 text-right text-xs font-mono">
                      {new Date(log.created_at).toLocaleString("tr-TR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && filteredLogs.length > 0 && (
          <div className="md:hidden space-y-4">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-white/10 bg-[#1c1c1c] p-5 shadow-lg flex flex-col gap-3"
              >
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <span className="rounded-lg bg-[#141414] px-2.5 py-1 text-xs font-mono text-gray-400 border border-white/5">
                    #{log.id}
                  </span>
                  <span className="text-xs text-gray-500 font-mono">
                    {new Date(log.created_at).toLocaleString("tr-TR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>

                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Kullanıcı</div>
                  <div className="text-sm font-medium text-white mt-1">
                    {log.user_name} {log.user_surname}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Sorgulanan İddia</div>
                  <div className="text-sm text-gray-300 mt-1 line-clamp-2" title={log.claim_text}>
                    {log.claim_text}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Gemini Analizi</div>
                  <div className="text-sm text-gray-400 mt-1 line-clamp-3" title={log.ai_response}>
                    {log.ai_response}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
