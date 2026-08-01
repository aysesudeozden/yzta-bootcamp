const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://localhost:8000/api";
  }
  return "/api";
};

/** HTTP status kodunu taşıyan hata sınıfı — çağıran taraf 401/403 gibi durumları ayırt edebilsin diye. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface VerifyOptions {
  signal?: AbortSignal;
}

export async function verifyClaimText(
  text: string,
  userId: number,
  options: VerifyOptions = {}
) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, user_id: userId }),
      signal: options.signal,
    });

    if (!response.ok) {
      let detail = "Sunucu ile iletişim kurulamadı.";
      try {
        const errorData = await response.json();
        detail = errorData.detail || detail;
      } catch {
        // Gövde JSON değilse varsayılan mesajı kullan
      }
      throw new ApiError(detail, response.status);
    }

    return await response.json();
  } catch (error) {
    // AbortError'ı olduğu gibi yukarı fırlat — çağıran taraf bunu sessizce ele alıyor
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    console.error("API İstek Hatası:", error);
    throw error;
  }
}

export async function fetchHistory(userId: number = 1, options: VerifyOptions = {}) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/history?user_id=${userId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: options.signal,
    });

    if (!response.ok) {
      throw new ApiError("Geçmiş veriler sunucudan alınamadı.", response.status);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    console.error("Geçmiş Çekme Hatası:", error);
    throw error;
  }
}