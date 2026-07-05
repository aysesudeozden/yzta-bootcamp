import os
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from google import genai
from google.genai import types

# .env.local dosyasındaki değişkenleri güvenli bir şekilde yükle
load_dotenv(".env.local")

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY bulunamadı! Lütfen backend/.env.local dosyasını kontrol edin.")

# Yeni resmi Google GenAI istemcisini başlat
client = genai.Client(api_key=api_key)

app = FastAPI(title="Fact-Check AI Orchestrator API", version="1.0.0")

# Next.js Arayüzünün (localhost:3000) API ile konuşabilmesi için CORS İzni
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- VERİ VE YANIT ŞEMALARI (PYDANTIC) ---
class ClaimRequest(BaseModel):
    text: str

class ClaimBreakdownItem(BaseModel):
    claim: str = Field(description="İddia içerisinden ayrıştırılan tekil alt iddia maddesi.")
    verification: str = Field(description="Bu alt iddianın doğru, yanlış veya belirsiz olduğuna dair kanıtlı analiz.")

class SourceItem(BaseModel):
    title: str = Field(description="Kaynak kurumun, raporun veya haber platformunun adı.")
    url: str = Field(description="Kaynağın referans web bağlantısı.")

class VerificationResponse(BaseModel):
    status: str = Field(description="Sadece şu 3 değerden biri olmalı: 'DOĞRU', 'YANLIŞ' veya 'BELİRSİZ'")
    confidence_score: int = Field(description="0 ile 100 arasında bir güven skoru yüzdesi.")
    summary: str = Field(description="Yapılan çapraz doğrulamanın profesyonel ve objektif bir özeti.")
    claims_breakdown: list[ClaimBreakdownItem] = Field(description="İddianın alt parçalara ayrılarak incelendiği liste.")
    sources: list[SourceItem] = Field(description="İddiayı doğrulayan veya çürüten güvenilir kaynaklar listesi.")

# --- API ENDPOINT ---
@app.post("/api/verify", response_model=VerificationResponse)
async def verify_claim(request: ClaimRequest):
    if not request.text or len(request.text.strip()) < 10:
        raise HTTPException(status_code=400, detail="Lütfen analiz için geçerli ve en az 10 karakterlik bir iddia giriniz.")

    # Arayüzdeki "Ajan Akış simülasyonunun" izlenebilmesi için kısa bir esneklik payı
    await asyncio.sleep(1.0)

    # Gemini'yi Otonom Ajan Orkestratörü olarak kurgulayan sistem talimatı
    system_instruction = """
    Sen üst düzey bir Otonom Gerçek Zamanlı Doğrulama (Fact-Check) Orkestratörüsün.
    Arkada 3 farklı ajan akışını yönetiyorsun:
    1. [Ayrıştırma Ajanı]: Kullanıcının metnini kontrol edilebilir alt iddialara (claim) böl.
    2. [Arama ve Karşılaştırma Ajanı]: Bu iddiaları tarihsel gerçekler, güncel veriler ve bilimsel olgularla kıyasla.
    3. [Skorlama Ajanı]: Genel bir 'DOĞRU', 'YANLIŞ' veya 'BELİRSİZ' kararı ver, 0-100 arası güven skoru belirle.
    
    Yanıtını kesinlikle verilen JSON şemasına uygun şekilde üret. Objektif, tarafsız, net ve akademik bir dil kullan.
    """

    try:
        # Gemini 2.5 Flash modelini Yapılandırılmış Çıktı (Structured Outputs) konfigürasyonu ile çağırıyoruz
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=request.text,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=VerificationResponse,
                temperature=0.2, # Daha deterministik ve olgusal yanıtlar için düşük sıcaklık
            ),
        )
        
        # Dönen JSON string'ini Pydantic modelimizle doğrulayıp Next.js'e tertemiz gönderiyoruz
        return VerificationResponse.model_validate_json(response.text)

    except Exception as e:
        print(f"Gemini API Hatası: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail="Yapay zeka analiz ajanları şu anda yanıt veremiyor. Lütfen bağlantınızı kontrol edin."
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)