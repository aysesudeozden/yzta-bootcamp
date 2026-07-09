import os
import asyncio
from pathlib import Path
import bcrypt
import psycopg2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from google import genai
from google.genai import types

# .env.local (Gemini anahtarı) ve proje kökündeki .env (veritabanı bilgileri) dosyalarını yükle
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env.local")
load_dotenv(BASE_DIR.parent / ".env")

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("UYARI: GEMINI_API_KEY bulunamadı! /api/verify çalışmayacak. backend/.env.local dosyasını kontrol edin.")

# Yeni resmi Google GenAI istemcisini başlat (anahtar yoksa doğrulama endpoint'i devre dışı kalır)
client = genai.Client(api_key=api_key) if api_key else None

# Docker Compose ile ayağa kalkan PostgreSQL'e bağlantı bilgileri (.env yoksa compose varsayılanları)
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "user": os.getenv("DB_USER", "admin"),
    "password": os.getenv("DB_PASSWORD", "secretpassword"),
    "dbname": os.getenv("DB_NAME", "bootcamp_db"),
}

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

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    surname: str
    email: str
    password: str

class LoginResponse(BaseModel):
    id: int
    name: str
    surname: str
    email: str
    role: str

# --- API ENDPOINT ---
@app.post("/api/login", response_model=LoginResponse)
def login(request: LoginRequest):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
    except psycopg2.OperationalError:
        raise HTTPException(status_code=503, detail="Veritabanına bağlanılamadı. Docker container'ının çalıştığından emin olun.")

    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, surname, email, password_hash, role FROM users WHERE email = %s",
                (request.email.strip().lower(),),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    # E-posta mı şifre mi yanlış belli etmemek için ikisine de aynı hata mesajını dönüyoruz
    if not row or not bcrypt.checkpw(request.password.encode(), row[4].encode()):
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı.")

    return LoginResponse(id=row[0], name=row[1], surname=row[2], email=row[3], role=row[5])

@app.post("/api/register", response_model=LoginResponse, status_code=201)
def register(request: RegisterRequest):
    name = request.name.strip()
    surname = request.surname.strip()
    email = request.email.strip().lower()

    if not name or not surname or not email:
        raise HTTPException(status_code=400, detail="Ad, soyad ve e-posta boş olamaz.")

    password = request.password
    if len(password) < 8 or not any(c.isdigit() for c in password) or not any(c.isupper() for c in password):
        raise HTTPException(status_code=400, detail="Şifre en az 8 karakter olmalı, 1 sayı ve 1 büyük harf içermeli.")

    # Şifreyi login ile aynı yöntemle (bcrypt) hashleyip öyle saklıyoruz
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    try:
        conn = psycopg2.connect(**DB_CONFIG)
    except psycopg2.OperationalError:
        raise HTTPException(status_code=503, detail="Veritabanına bağlanılamadı. Docker container'ının çalıştığından emin olun.")

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (name, surname, email, password_hash)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (email) DO NOTHING
                RETURNING id, name, surname, email, role
                """,
                (name, surname, email, password_hash),
            )
            row = cur.fetchone()
        conn.commit()
    finally:
        conn.close()

    if not row:
        raise HTTPException(status_code=409, detail="Bu e-posta adresiyle zaten bir hesap var.")

    return LoginResponse(id=row[0], name=row[1], surname=row[2], email=row[3], role=row[4])

@app.post("/api/verify", response_model=VerificationResponse)
async def verify_claim(request: ClaimRequest):
    if client is None:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY tanımlı değil. backend/.env.local dosyasını kontrol edin.")

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