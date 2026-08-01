"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "../components/ThemeToggle";

interface ChatLogItem {
  id: number;
  user_id: number;
  message: string;
  response: string;
  model: string;
  created_date: string;
  user_name?: string;
  user_surname?: string;
  user_email?: string;
}

interface AuthUser {
  id: number;
  name: string;
  surname: string;
  email: string;
  role: string;
}

interface UserSummary {
  user_id: number;
  user_name: string;
  user_surname: string;
  user_email: string;
  messageCount: number;
  lastActivity: string;
}

export default function AdminLogsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [unauthorized, setUnauthorized] = useState<boolean>(false);

  const [activeNavTab, setActiveNavTab] = useState<"messages" | "users" | "usage" | "settings">("messages");
  const [chatLogs, setChatLogs] = useState<ChatLogItem[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<ChatLogItem | null>(null);

  const redirectToLogin = useCallback(() => {
    localStorage.removeItem("user");
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      redirectToLogin();
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser) as AuthUser;
      if (parsedUser.role !== "admin") {
        setUnauthorized(true);
        setLoading(false);
        return;
      }
      setUser(parsedUser);

      const fetchAllLogs = async () => {
        try {
          const user = JSON.parse(storedUser);
          const adminId = user.id;

          const baseUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8000/api" : "/api");
          const response = await fetch(`${baseUrl}/admin/logs?admin_id=${adminId}`);

          if (!response.ok) {
            if (response.status === 403) {
              throw new Error("Erişim reddedildi. Bu alanı sadece yöneticiler görebilir.");
            }
            throw new Error("Veriler getirilirken sunucu hatası oluştu.");
          }

          const data = await response.json();
          setChatLogs(data.chats || []);
        } catch (err: any) {
          setError(err.message || "Bir şeyler ters gitti.");
        } finally {
          setLoading(false);
        }
      };

      fetchAllLogs();
    } catch {
      redirectToLogin();
    }
  }, [router, redirectToLogin]);

  const filteredChatLogs = chatLogs.filter(
    (log) =>
      (log.user_name && log.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.message && log.message.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const userSummaries: UserSummary[] = Object.values(
    chatLogs.reduce((acc: Record<number, UserSummary>, log) => {
      const key = log.user_id;
      if (!acc[key]) {
        acc[key] = {
          user_id: log.user_id,
          user_name: log.user_name || "Bilinmeyen",
          user_surname: log.user_surname || "",
          user_email: log.user_email || "",
          messageCount: 0,
          lastActivity: log.created_date,
        };
      }
      acc[key].messageCount += 1;
      if (new Date(log.created_date) > new Date(acc[key].lastActivity)) {
        acc[key].lastActivity = log.created_date;
      }
      return acc;
    }, {})
  ).sort((a, b) => b.messageCount - a.messageCount);

  const filteredUserSummaries = userSummaries.filter(
    (u) =>
      `${u.user_name} ${u.user_surname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.user_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const modelUsage: { model: string; count: number }[] = Object.entries(
    chatLogs.reduce((acc: Record<string, number>, log) => {
      const key = log.model || "bilinmiyor";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count);

  const dailyUsage: { day: string; count: number }[] = Object.entries(
    chatLogs.reduce((acc: Record<string, number>, log) => {
      const day = log.created_date ? log.created_date.slice(0, 10) : "bilinmiyor";
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, 14);

  const maxDailyCount = Math.max(1, ...dailyUsage.map((d) => d.count));

  const activeUserCount = userSummaries.length;
  const avgResponseLength =
    chatLogs.length > 0
      ? Math.round(chatLogs.reduce((sum, log) => sum + (log.response?.length || 0), 0) / chatLogs.length)
      : 0;
  const topModel = modelUsage[0]?.model || "—";

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).replace(",", " ·");
    } catch {
      return dateString;
    }
  };

  const formatDay = (dayString: string) => {
    if (!dayString || dayString === "bilinmiyor") return "Bilinmiyor";
    try {
      return new Date(dayString).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
    } catch {
      return dayString;
    }
  };

  if (unauthorized) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-10 transition-colors">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xl text-center transition-colors">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20">
            <svg className="h-7 w-7 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v2" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">
            Yetkisiz Giriş
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-gray-400">
            Bu sayfayı görüntülemek için yönetici (admin) yetkisine sahip olmanız gerekiyor. Hesabınız bu izne sahip değil.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              href="/"
              className="w-full rounded-lg bg-slate-900 dark:bg-white py-2.5 text-sm font-semibold text-white dark:text-black transition hover:bg-slate-800 dark:hover:bg-gray-200"
            >
              Ana sayfaya dön
            </Link>
            <button
              type="button"
              onClick={redirectToLogin}
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 py-2.5 text-sm font-semibold text-slate-600 dark:text-gray-300 transition hover:bg-slate-50 dark:hover:bg-white/5"
            >
              Farklı bir hesapla giriş yap
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-100 pb-16 antialiased">

      {/* ÜST NAVİGASYON */}
      <nav className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-2xs">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 select-none group cursor-pointer min-w-0">
              <div className="grid grid-cols-2 gap-[2px] w-5 h-5 shrink-0 transition-transform duration-500 ease-in-out group-hover:rotate-180">
                <div className="bg-blue-600 rounded-tl-[2px] shadow-2xs"></div>
                <div className="bg-slate-800 rounded-tr-[2px] shadow-2xs"></div>
                <div className="bg-slate-600 rounded-bl-[2px] shadow-2xs"></div>
                <div className="bg-slate-300 rounded-br-[2px] shadow-2xs"></div>
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
                <span className="font-light text-xl sm:text-2xl tracking-tighter text-blue-600 ml-[1px]">ADMIN</span>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
              <button
                onClick={() => setActiveNavTab("messages")}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${activeNavTab === "messages" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
              >
                Mesajlar
              </button>
              <button
                onClick={() => setActiveNavTab("users")}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${activeNavTab === "users" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
              >
                Kullanıcılar
              </button>
              <button
                onClick={() => setActiveNavTab("usage")}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${activeNavTab === "usage" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
              >
                Kullanım
              </button>
              <button
                onClick={() => setActiveNavTab("settings")}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${activeNavTab === "settings" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
              >
                Ayarlar
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <ThemeToggle />
            </div>

            <button
              onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(chatLogs, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", `chat_logs_export.json`);
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-2xs cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export</span>
            </button>

            <Link
              href="/"
              className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-600 transition shadow-2xs"
            >
              Ana Sayfa
            </Link>
          </div>

        </div>

        {/* Mobil sekme seçici */}
        <div className="md:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto">
          {([
            ["messages", "Mesajlar"],
            ["users", "Kullanıcılar"],
            ["usage", "Kullanım"],
            ["settings", "Ayarlar"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveNavTab(key)}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${activeNavTab === key ? "bg-slate-900 dark:bg-slate-700 text-white shadow-2xs" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
            >
              {label}
            </button>
          ))}
          <div className="shrink-0 ml-1">
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* İÇERİK BÖLGESİ */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-8 space-y-6">

        {/* ÜST İSTATİSTİK KARTLARI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide">Toplam mesaj</div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-slate-100">{chatLogs.length}</span>
            </div>
            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-2">Aktif sistem logu</div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide">Aktif kullanıcı</div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-slate-100">{activeUserCount}</span>
            </div>
            <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-2">kayıtlı loglara göre</div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide">Ort. yanıt uzunluğu</div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-slate-100">{avgResponseLength}</span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-500">karakter</span>
            </div>
            <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-2">tüm zamanlar</div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide">En çok kullanılan model</div>
            <div className="mt-3">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100 truncate block">{topModel}</span>
            </div>
            <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-2">tüm zamanlar</div>
          </div>
        </div>

        {/* ARAMA ÇUBUĞU */}
        {(activeNavTab === "messages" || activeNavTab === "users") && (
          <div className="w-full md:w-96">
            <input
              type="text"
              placeholder={activeNavTab === "messages" ? "Sohbetlerde veya mesajlarda ara..." : "Kullanıcı adı veya e-posta ara..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition focus:border-blue-500 shadow-2xs"
            />
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-3"></div>
            <span className="text-xs font-mono uppercase tracking-wider">Veriler yükleniyor...</span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-400 text-center shadow-2xs">
            {error}
          </div>
        )}

        {/* ================= MESAJLAR SEKMESİ ================= */}
        {!loading && !error && activeNavTab === "messages" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/60">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Sohbet Geçmişi Listesi
              </span>
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                {filteredChatLogs.length} sonuç
              </span>
            </div>

            {filteredChatLogs.length === 0 ? (
              <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">Gösterilecek sohbet kaydı bulunamadı.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold">
                    <tr>
                      <th className="py-3.5 px-6">User ID</th>
                      <th className="py-3.5 px-6">Kullanıcı Mesajı</th>
                      <th className="py-3.5 px-6">Tarih</th>
                      <th className="py-3.5 px-6">Model</th>
                      <th className="py-3.5 px-6 text-right">Detay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredChatLogs.map((log) => {
                      const userIdTag = `usr_${log.user_id || 1}xK`;
                      return (
                        <tr
                          key={log.id}
                          onClick={() => setSelectedItem(log)}
                          className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/60 cursor-pointer group"
                        >
                          <td className="py-4 px-6 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                            <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                              {userIdTag}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-slate-800 dark:text-slate-200 font-medium max-w-sm truncate" title={log.message}>
                            {log.message}
                          </td>
                          <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-500 font-mono">
                            {formatDate(log.created_date)}
                          </td>
                          <td className="py-4 px-6">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                              {log.model || "gemini-2.5"}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 group-hover:border-slate-300 dark:group-hover:border-slate-600 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition shadow-2xs">
                              →
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= KULLANICILAR SEKMESİ ================= */}
        {!loading && !error && activeNavTab === "users" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/60">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Sistemi Kullanan Kullanıcılar
              </span>
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                {filteredUserSummaries.length} kullanıcı
              </span>
            </div>

            {filteredUserSummaries.length === 0 ? (
              <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">Gösterilecek kullanıcı bulunamadı.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold">
                    <tr>
                      <th className="py-3.5 px-6">Kullanıcı</th>
                      <th className="py-3.5 px-6">E-posta</th>
                      <th className="py-3.5 px-6">Mesaj Sayısı</th>
                      <th className="py-3.5 px-6">Son Aktivite</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredUserSummaries.map((u) => (
                      <tr key={u.user_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0">
                              {(u.user_name[0] ?? "?").toLocaleUpperCase("tr-TR")}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {u.user_name} {u.user_surname}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-600 dark:text-slate-400 truncate">{u.user_email || "—"}</td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                            {u.messageCount}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-500 font-mono">{formatDate(u.lastActivity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= KULLANIM SEKMESİ ================= */}
        {!loading && !error && activeNavTab === "usage" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/60">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Model Dağılımı</span>
              </div>
              <div className="p-6 space-y-4">
                {modelUsage.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">Henüz veri yok.</div>
                ) : (
                  modelUsage.map((m) => {
                    const pct = chatLogs.length > 0 ? Math.round((m.count / chatLogs.length) * 100) : 0;
                    return (
                      <div key={m.model} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-200 font-mono">{m.model}</span>
                          <span className="font-mono text-slate-500 dark:text-slate-500">{m.count} istek · %{pct}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/60">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Son Aktivite (Günlük)</span>
              </div>
              <div className="p-6 space-y-2.5">
                {dailyUsage.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">Henüz veri yok.</div>
                ) : (
                  dailyUsage.map((d) => (
                    <div key={d.day} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-500 w-14 shrink-0">{formatDay(d.day)}</span>
                      <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${(d.count / maxDailyCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 w-6 text-right shrink-0">{d.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= AYARLAR SEKMESİ ================= */}
        {!loading && !error && activeNavTab === "settings" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center flex flex-col items-center justify-center shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">Ayarlar yakında</h3>
            <p className="text-sm text-slate-500 dark:text-slate-500 max-w-sm"></p>
          </div>
        )}

      </div>

      {/* YÖNETİCİ MODALI */}
      {selectedItem && (() => {
        const data = selectedItem;

        const userIdText = `usr_${data.user_id || 1}xK`;
        const userNameText = `${data.user_name || "Kullanıcı"} ${data.user_surname || ""}`.trim();
        const modelName = data.model || "gemini-2.0-flash";
        const dateText = formatDate(data.created_date);

        const claimText = data.message;

        let responseText = data.response;
        if (typeof data.response === "string" && data.response.trim().startsWith("{")) {
          try {
            const parsed = JSON.parse(data.response);
            responseText = parsed.summary || parsed.message || data.response;
          } catch {
            responseText = data.response;
          }
        }

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
            <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto text-slate-900 dark:text-slate-100">

              <div className="flex items-center justify-between pb-1">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">Mesaj detayı</h2>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition cursor-pointer"
                  aria-label="Kapat"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                  <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">User ID / İsim</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
                    {userNameText} <span className="text-xs font-mono text-slate-500 dark:text-slate-500">({userIdText})</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200/80 dark:border-slate-700 shadow-2xs flex flex-col justify-center">
                  <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Model</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="h-2 w-2 rounded-full bg-blue-600 inline-block"></span>
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 font-mono">
                      {modelName}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Tarih</div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 font-mono">
                  {dateText}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Kullanıcı Mesajı</div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 text-sm text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 leading-relaxed font-medium shadow-2xs">
                  {claimText}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Model Yanıtı</div>
                <div className="rounded-2xl bg-[#0c2340] p-4 text-sm text-blue-50 border border-blue-900/20 leading-relaxed shadow-2xs font-normal">
                  {responseText}
                </div>
              </div>

              <div className="flex items-center justify-center pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 transition shadow-2xs cursor-pointer"
                  title="Kapat"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}