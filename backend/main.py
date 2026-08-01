import os
import asyncio
from pathlib import Path
import bcrypt
import psycopg2
from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from google.genai import types
import time
import urllib.request
import urllib.parse
import json
import requests

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env.local")
load_dotenv(BASE_DIR.parent / ".env")

api_key = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=api_key) if api_key else None

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "user": os.getenv("DB_USER", "admin"),
    "password": os.getenv("DB_PASSWORD", "secretpassword"),
    "dbname": os.getenv("DB_NAME", "bootcamp_db"),
}

FACT_CHECK_API_KEY = os.getenv("FACT_CHECK_API_KEY")
SERPER_API_KEY = os.getenv("SERPER_API_KEY")

print(f"DEBUG STARTUP: GEMINI_API_KEY is {'SET' if api_key else 'NOT SET'}", flush=True)
print(f"DEBUG STARTUP: FACT_CHECK_API_KEY is {'SET' if FACT_CHECK_API_KEY else 'NOT SET'}", flush=True)
print(f"DEBUG STARTUP: SERPER_API_KEY is {'SET' if SERPER_API_KEY else 'NOT SET'}", flush=True)

app = FastAPI(title="Fact-Check AI Orchestrator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ClaimRequest(BaseModel):
    text: str
    user_id: int

class ClaimBreakdownItem(BaseModel):
    claim: str
    verification: str

class SourceItem(BaseModel):
    title: str
    url: str

class VerificationResponse(BaseModel):
    status: str
    confidence_score: int
    summary: str
    claims_breakdown: list[ClaimBreakdownItem]
    sources: list[SourceItem]

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

# --- DÜZELTME: Admin panelinin (frontend) beklediği alan isimleriyle
# birebir eşleşecek şekilde güncellendi. Önceki hali (claim_text,
# ai_response, created_at, model/user_id/user_email alanları hiç yok)
# frontend'in "message, response, model, created_date, user_id, user_email"
# beklentisiyle uyuşmuyordu.
class ChatLogItem(BaseModel):
    id: int
    user_id: int
    message: str
    response: str
    model: str
    created_date: str
    user_name: str | None = "Kullanıcı"
    user_surname: str | None = ""
    user_email: str | None = ""

# --- DÜZELTME: Frontend `data.chats` okuyordu, backend `logs` dönüyordu —
# bu tek başına admin panelinin her zaman boş görünmesine yetiyordu.
class AdminLogsResponse(BaseModel):
    chats: list[ChatLogItem]

def query_google_fact_check(claim: str) -> list:
    if not FACT_CHECK_API_KEY:
        print("UYARI: FACT_CHECK_API_KEY bulunamadı!", flush=True)
        return []

    base_url = "https://factchecktools.googleapis.com/v1alpha1/claims:search"
    params = {
        "query": claim,
        "key": FACT_CHECK_API_KEY,
        "languageCode": "tr" 
    }
    url_parts = urllib.parse.urlencode(params)
    full_url = f"{base_url}?{url_parts}"

    try:
        with urllib.request.urlopen(full_url, timeout=5) as response:
            data = json.loads(response.read().decode())
            claims = data.get("claims", [])
            
            results = []
            for c in claims[:3]:
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

def query_serper_search(claim: str) -> list:
    if not SERPER_API_KEY:
        print("UYARI: SERPER_API_KEY bulunamadı!", flush=True)
        return []

    url = "https://google.serper.dev/search"
    headers = {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "q": claim,
        "gl": "tr",
        "hl": "tr"
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=5)
        if response.status_code == 200:
            res_data = response.json()
            organic = res_data.get("organic", [])
            results = []
            for item in organic[:3]:
                results.append({
                    "title": item.get("title", "Başlık Yok"),
                    "url": item.get("link", ""),
                    "snippet": item.get("snippet", "")
                })
            return results
        else:
            print(f"Serper API Hata Kodu: {response.status_code}", flush=True)
            return []
    except Exception as e:
        print(f"Serper API Hatası: {str(e)}", flush=True)
        return []
    
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
        raise HTTPException(status_code=503, detail="Veritabanına bağlanılamadı.")

    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, surname, email, password_hash, role FROM users WHERE email = %s",
                (request.email.strip().lower(),),
            )
            row = cur.fetchone()
    finally:
        conn.close()

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
        raise HTTPException(status_code=400, detail="Geçersiz şifre.")

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    try:
        conn = psycopg2.connect(**DB_CONFIG)
    except psycopg2.OperationalError:
        raise HTTPException(status_code=503, detail="Veritabanına bağlanılamadı.")

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
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY tanımlı değil.")

    if not request.text or len(request.text.strip()) < 10:
        raise HTTPException(status_code=400, detail="Geçersiz iddia girildi.")

    await asyncio.sleep(1.0)

    start_total = time.perf_counter()

    start_api = time.perf_counter()
    web_evidence = query_google_fact_check(request.text)
    end_api = time.perf_counter()
    api_duration = end_api - start_api

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
        print(f"Bilgi: Google Fact Check API sonucu boş. Serper API canlı araması başlatılıyor...", flush=True)
        start_serper = time.perf_counter()
        serper_evidence = query_serper_search(request.text)
        end_serper = time.perf_counter()
        api_duration += (end_serper - start_serper)

        if serper_evidence:
            evidence_text = "\nGoogle Fact Check üzerinde doğrudan teyit raporu bulunamadı. Ancak Canlı Web Arama Ajanı (Serper API) ile şu güncel internet bulguları ve haberler tespit edildi:\n"
            for idx, item in enumerate(serper_evidence, 1):
                evidence_text += (
                    f"[{idx}] Haber/Kaynak Başlığı: {item['title']}\n"
                    f"    İçerik Özeti (Snippet): {item['snippet']}\n"
                    f"    Kaynak URL: {item['url']}\n\n"
                )
        else:
            evidence_text = "\nHem Google Fact Check API hem de Serper canlı araması üzerinde bu iddiaya dair doğrudan bir bulguya ulaşılamadı. Genel bilgilerinle analiz et.\n"

    system_instruction = f"""
    Sen üst düzey bir Otonom Gerçek Zamanlı Doğrulama (Fact-Check) Orkestratörüsün.
    Aşağıda sana sunulan [Web Araştırma Bulguları] ve kullanıcının girdiği [İddia Metni]'ni karşılaştırarak profesyonel bir analiz yapacaksın.
    
    [Web Araştırma Bulguları]:
    {evidence_text}
    
    Sorumlulukların:
    1. Kullanıcının iddiasını kontrol edilebilir alt maddelere böl (`claims_breakdown`).
    2. Genel bir doğruluk skoru (0-100) ve objektif, akademik dille yazılmış bir özet (`summary`) üret.
    
    CRITICAL (ÇOK ÖNEMLİ - ZORUNLU KURAL):
    Eğer yukarıda sana [Web Araştırma Bulguları] sağlandıysa, o bulguların içindeki "Kaynak URL" ve "Kaynak/Rapor Başlığı" bilgilerini KESİNLİKLE ama KESİNLİKLE yanıtındaki `sources` listesine eklemelisin.
    
    `sources` listesinin formatı tam olarak şöyle olmalıdır:
    [
      {{ "title": "Kaynak/Yayıncı Adı - Başlık", "url": "İlgili Kaynak URL'si" }}
    ]
    
    Yanıtını kesinlikle verilen JSON şemasına (VerificationResponse) uygun şekilde üret.
    """

    try:
        start_gemini = time.perf_counter()
        response = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=request.text,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=VerificationResponse,
                temperature=0.1,
            ),
        )
        end_gemini = time.perf_counter()
        gemini_duration = end_gemini - start_gemini

        try:
            conn = psycopg2.connect(**DB_CONFIG)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO chats (user_id, message, response, model)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (request.user_id, request.text, response.text, 'gemini-3.6-flash')
                )
            conn.commit()
        except Exception as db_err:
            print(f"DB Error: {str(db_err)}")
        finally:
            if 'conn' in locals():
                conn.close()

        end_total = time.perf_counter()
        total_duration = end_total - start_total

        print("\n================ PERFORMANS ANALİZ RAPORU ================", flush=True)
        print(f"Aranan İddia       : '{request.text[:50]}...'", flush=True)
        print(f"Fact Check & Arama Süresi: {api_duration:.4f} saniye", flush=True)
        print(f"Gemini Analiz Süresi: {gemini_duration:.4f} saniye", flush=True)
        print(f"Toplam İşlem Süresi  : {total_duration:.4f} saniye", flush=True)
        print("==========================================================\n", flush=True)

        return VerificationResponse.model_validate_json(response.text)

    except Exception as e:
        print(f"Hata Oluştu: {str(e)}")
        raise HTTPException(status_code=500, detail="Yapay zeka analiz ajanları şu anda yanıt veremiyor.")

@app.get("/api/history")
def get_history(user_id: int = Query(...)):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, message, response, created_date 
                FROM chats 
                WHERE user_id = %s 
                ORDER BY created_date DESC
                """,
                (user_id,)
            )
            rows = cur.fetchall()
            
            history_data = []
            for row in rows:
                history_data.append({
                    "id": row[0],
                    "message": row[1],
                    "response": row[2],
                    "created_date": row[3].isoformat() if hasattr(row[3], 'isoformat') else str(row[3])
                })
            
            return {"data": history_data}
            
    except psycopg2.Error as e:
        print(f"Fetch History DB Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Geçmiş veriler veritabanından çekilemedi.")
    finally:
        if 'conn' in locals():
            conn.close()

# --- DÜZELTME: SELECT'e c.user_id, c.model, u.email eklendi (önceden hiç
# çekilmiyordu); ChatLogItem artık frontend'in beklediği alan adlarıyla
# dolduruluyor; en sonda "logs=" değil "chats=" ile dönülüyor.
@app.get("/api/admin/logs", response_model=AdminLogsResponse)
def get_admin_logs(admin_id: int = Depends(verify_admin_role)):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
    except psycopg2.OperationalError:
        raise HTTPException(status_code=503, detail="Veritabanına bağlanılamadı.")

    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT c.id, c.user_id, c.message, c.response, c.model, c.created_date,
                       u.name, u.surname, u.email
                FROM chats c
                JOIN users u ON c.user_id = u.id
                ORDER BY c.created_date DESC
            """)
            rows = cur.fetchall()
            
            chats_list = []
            for row in rows:
                chats_list.append(
                    ChatLogItem(
                        id=row[0],
                        user_id=row[1],
                        message=row[2],
                        response=row[3],
                        model=row[4] or "gemini-3.6-flash",
                        created_date=str(row[5]),
                        user_name=row[6] or "Kullanıcı",
                        user_surname=row[7] or "",
                        user_email=row[8] or "",
                    )
                )
    finally:
        conn.close()

    return AdminLogsResponse(chats=chats_list)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)