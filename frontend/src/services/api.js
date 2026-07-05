const API_BASE_URL = "http://localhost:8000/api";

export async function verifyClaimText(text) {
  try {
    const response = await fetch(`${API_BASE_URL}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
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