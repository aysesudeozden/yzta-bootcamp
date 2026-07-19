import os
import asyncio
from pathlib import Path
import bcrypt
import psycopg2
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from google import genai
from google.genai import types
import time
import urllib.request
import urllib.parse
import json
import requests

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
# Fact Check API bilgilerinin alındığı kısım 
FACT_CHECK_API_KEY = os.getenv("FACT_CHECK_API_KEY")

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
    
class ChatLogItem(BaseModel):
    id: int
    user_name: str
    user_surname: str
    claim_text: str
    ai_response: str
    created_at: str # Tarih verisi string olarak gidecek

class AdminLogsResponse(BaseModel):
    logs: list[ChatLogItem]

def query_google_fact_check(claim: str) -> list:
    """
    Kullanıcının iddiasını Google Fact Check Tools API'sinde arar
    ve teyit edilmiş analiz sonuçlarını döner.
    """
    if not FACT_CHECK_API_KEY:
        print("UYARI: FACT_CHECK_API_KEY bulunamadı!")
        return []

    # API URL'ini ve parametreleri hazırlıyoruz (Türkçe teyit sitelerine odaklanması için languageCode='tr')
    base_url = "https://factchecktools.googleapis.com/v1alpha1/claims:search"
    params = {
        "query": claim,
        "key": FACT_CHECK_API_KEY,
        "languageCode": "tr" 
    }
    url_parts = urllib.parse.urlencode(params)
    full_url = f"{base_url}?{url_parts}"

    try:
        # API'ye istek atıyoruz
        with urllib.request.urlopen(full_url, timeout=5) as response:
            data = json.loads(response.read().decode())
            claims = data.get("claims", [])
            
            print("\n--- FACT CHECK API HAM YANITI ---")
            print(data)
            print("---------------------------------\n")

            # Gelen karmaşık veriyi Gemini'ın kolayca anlayacağı sade bir listeye çeviriyoruz
            results = []
            for c in claims[:3]: # En alakalı ilk 3 teyit sonucunu alıyoruz
                reviews = c.get("claimReview", [])
                if reviews:
                    review = reviews[0]
                    results.append({
                        "claim_text": c.get("text"),
                        "claimant": c.get("claimant", "Bilinmiyor"),
                        "publisher": review.get("publisher", {}).get("name", "Bilinmeyen Kaynak"),
                        "url": review.get("url"),
                        "verdict": review.get("textualRating", "Belirtilmemiş"),
                        "title": review.get("title", "Başlık Yok")
                    })
            return results
    except Exception as e:
        print(f"Google Fact Check API Hatası: {str(e)}")
        return []
    
# --- API ENDPOINT ---
def verify_admin_role(admin_id: int):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
    except psycopg2.OperationalError:
        raise HTTPException(status_code=503, detail="Veritabanı bağlantı hatası.")

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT role FROM users WHERE id = %s", (admin_id,))
            row = cur.fetchone()
            
            if not row or row[0] != 'admin':
                raise HTTPException(status_code=403, detail="Erişim reddedildi. Bu işlemi sadece yöneticiler yapabilir.")
    finally:
        conn.close()
        
    return admin_id

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

    # --- PERFORMANS ANALİZİ BAŞLANGICI ---
    start_total = time.perf_counter()

    # 1. Adım: Google Fact Check Tools API'den teyit verilerini çek
    start_api = time.perf_counter()
    web_evidence = query_google_fact_check(request.text)
    end_api = time.perf_counter()
    api_duration = end_api - start_api

    # 2. Adım: Gemini için Statik Prompt ve Web Verisi Hazırlığı
    # Eğer web'de daha önce teyit edilmiş bir veri bulunduysa bunu prompt'a ekliyoruz
    evidence_text = ""
    if web_evidence:
        evidence_text = "\nGoogle Fact Check API'den bulunan doğrulanmış kaynaklar ve teyit raporları:\n"
        for idx, item in enumerate(web_evidence, 1):
            evidence_text += (
                f"[{idx}] İddia: {item['claim_text']}\n"
                f"    Ortaya Atan: {item['claimant']}\n"
                f"    Teyit Eden Kurum: {item['publisher']} - Karar: {item['verdict']}\n"
                f"    Kaynak Rapor Başlığı: {item['title']}\n"
                f"    Kaynak URL: {item['url']}\n\n"
            )
    else:
        evidence_text = "\nGoogle Fact Check API üzerinde bu iddiaya dair doğrudan bir teyit raporu bulunamadı. Genel bilgilerinle analiz et.\n"

    # Gemini'yi yönlendireceğimiz statik prompt yapısı
    # Gemini'yi yönlendireceğimiz statik prompt yapısı
    system_instruction = f"""
    Sen üst düzey bir Otonom Gerçek Zamanlı Doğrulama (Fact-Check) Orkestratörüsün.
    Aşağıda sana sunulan [Web Araştırma Bulguları] ve kullanıcının girdiği [İddia Metni]'ni karşılaştırarak profesyonel bir analiz yapacaksın.
    
    [Web Araştırma Bulguları]:
    {evidence_text}
    
    Sorumlulukların:
    1. Kullanıcının iddiasını kontrol edilebilir alt maddelere böl (`claims_breakdown`).
    2. Genel bir doğruluk skoru (0-100) ve objektif, akademik dille yazılmış bir özet (`summary`) üret.
    
    CRITICAL (ÇOK ÖNEMLİ - ZORUNLU KURAL):
    Eğer yukarıda sana [Web Araştırma Bulguları] sağlandıysa, o bulguların içindeki "Kaynak URL" ve "Teyit Eden Kurum/Başlık" bilgilerini KESİNLİKLE ama KESİNLİKLE yanıtındaki `sources` listesine eklemelisin.
    
    `sources` listesinin formatı tam olarak şöyle olmalıdır:
    [
      {{ "title": "Teyit Eden Kurum Adı - Kaynak Rapor Başlığı", "url": "İlgili Kaynak URL'si" }}
    ]
    
    Yanıtını kesinlikle verilen JSON şemasına (VerificationResponse) uygun şekilde üret.
    """

    try:
        # 3. Adım: Gemini Analiz Süreci
        start_gemini = time.perf_counter()
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=request.text,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=VerificationResponse,
                temperature=0.1, # En gerçekçi ve olgusal analiz için sıcaklığı daha da düşürdük
            ),
        )
        end_gemini = time.perf_counter()
        gemini_duration = end_gemini - start_gemini

        # --- PERFORMANS METRİKLERİNİN HESAPLANMASI ---
        end_total = time.perf_counter()
        total_duration = end_total - start_total

        print("\n================ PERFORMANS ANALİZ RAPORU ================")
        print(f"Aranan İddia       : '{request.text[:50]}...'")
        print(f"Fact Check API Süresi: {api_duration:.4f} saniye")
        print(f"Gemini Analiz Süresi: {gemini_duration:.4f} saniye")
        print(f"Toplam İşlem Süresi  : {total_duration:.4f} saniye")
        print("==========================================================\n")

        # Dönen JSON string'ini doğrula ve Next.js'e fırlat
        return VerificationResponse.model_validate_json(response.text)

    except Exception as e:
        print(f"Hata Oluştu: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail="Analiz sürecinde bir hata oluştu. Lütfen bağlantılarınızı kontrol edin."
        )

@app.get("/api/admin/logs", response_model=AdminLogsResponse)
def get_admin_logs(admin_id: int = Depends(verify_admin_role)):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
    except psycopg2.OperationalError:
        raise HTTPException(status_code=503, detail="Veritabanına bağlanılamadı.")

    try:
        with conn.cursor() as cur:
            # Kolon isimleri init.sql ile uyumlu hale getirildi (message, response, created_date)
            cur.execute("""
                SELECT c.id, u.name, u.surname, c.message, c.response, c.created_date
                FROM chats c
                JOIN users u ON c.user_id = u.id
                ORDER BY c.created_date DESC
            """)
            rows = cur.fetchall()
            
            # Veritabanından gelen satırları Pydantic listesine çeviriyoruz
            logs_list = []
            for row in rows:
                logs_list.append(
                    ChatLogItem(
                        id=row[0],
                        user_name=row[1],
                        user_surname=row[2],
                        claim_text=row[3],     # Veritabanındaki c.message buraya eşleşti
                        ai_response=row[4],    # Veritabanındaki c.response buraya eşleşti
                        created_at=str(row[5]) # Veritabanındaki c.created_date buraya eşleşti
                    )
                )
    finally:
        conn.close()

    return AdminLogsResponse(logs=logs_list)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)