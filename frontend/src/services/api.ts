const API_BASE_URL = "http://localhost:8000/api";

export async function verifyClaimText(text: string, userId: number) {
  try {
    const response = await fetch(`${API_BASE_URL}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, user_id: userId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Sunucu ile iletişim kurulamadı.");
    }

    return await response.json();
  } catch (error) {
    console.error("API İstek Hatası:", error);
    throw error;
  }
}

export async function fetchHistory(userId: number = 1) {
  try {
    const response = await fetch(`${API_BASE_URL}/history?user_id=${userId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Geçmiş veriler sunucudan alınamadı.");
    }

    return await response.json();
  } catch (error) {
    console.error("Geçmiş Çekme Hatası:", error);
    throw error;
  }
}