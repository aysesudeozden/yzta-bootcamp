import os
import asyncio
from pathlib import Path
import bcrypt
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from google import genai
from google.genai import types
import time
import urllib.request
import urllib.parse
import json
import concurrent.futures

# --- ORTAM DEĞİŞKENLERİ ---
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

app = FastAPI(title="Fact-Check AI Orchestrator API", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- PYDANTIC VERİ MODELLERİ (API SÖZLEŞMELERİ) ---
class ClaimRequest(BaseModel):
    text: str
    user_id: int

class ClaimBreakdownItem(BaseModel):
    claim: str
    verification: str
    verdict: str | None = "BELİRSİZ"

class SourceItem(BaseModel):
    title: str
    url: str

# Modelden SADECE metinsel/analitik alanları istiyoruz — sources burada YOK.
# Kaynaklar modele hiç sorulmuyor, sunucu tarafında gerçek arama sonuçlarından ekleniyor.
class StructuredAnalysis(BaseModel):
    status: str
    confidence_score: int
    summary: str
    claims_breakdown: list[ClaimBreakdownItem]

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

# Yönetici ve Geçmiş Paneli İçin Temizlenmiş Veri Modelleri
class FactCheckLogItem(BaseModel):
    id: int
    claim: str
    status: str
    confidence_score: int
    summary: str | None = None
    claims_breakdown: list[dict] | None = []
    sources: list[dict] | None = []
    created_at: str
    checked_by: int | None = None
    user_name: str | None = "Sistem"
    user_surname: str | None = ""
    user_email: str | None = ""

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

class AdminLogsResponse(BaseModel):
    fact_checks: list[FactCheckLogItem]
    chats: list[ChatLogItem]

# --- YARDIMCI FONKSİYONLAR ---
def parse_jsonb_field(data):
    """Veritabanından gelen JSONB alanını güvenli şekilde listeye çevirir."""
    if data is None:
        return []
    if isinstance(data, str):
        try:
            return json.loads(data)
        except Exception:
            return []
    return data

def _call_with_retry(fn, *, retries: int = 2, base_delay: float = 1.5):
    """
    Gemini geçici olarak meşgulse (503 / UNAVAILABLE / overloaded) üstel bekleme
    ile birkaç kez yeniden dener. Kalıcı hatalarda (400, 401, şema hatası vb.)
    hemen fırlatır — sadece kapasite kaynaklı geçici hatalarda bekler.
    """
    last_err: Exception | None = None
    for attempt in range(retries + 1):
        try:
            return fn()
        except Exception as e:
            last_err = e
            msg = str(e)
            is_retryable = "503" in msg or "UNAVAILABLE" in msg or "overloaded" in msg.lower()
            if not is_retryable or attempt == retries:
                raise
            wait = base_delay * (2 ** attempt)
            print(f"Gemini geçici olarak meşgul (deneme {attempt + 1}/{retries + 1}), {wait:.1f}s sonra tekrar denenecek...")
            time.sleep(wait)
    raise last_err  # pragma: no cover


def query_google_fact_check(claim: str) -> list:
    """Google Fact Check Tools API — gerçek, yayımlanmış fact-check raporlarını arar."""
    if not FACT_CHECK_API_KEY:
        print("UYARI: FACT_CHECK_API_KEY bulunamadı!")
        return []

    base_url = "https://factchecktools.googleapis.com/v1alpha1/claims:search"
    params = {"query": claim, "key": FACT_CHECK_API_KEY, "languageCode": "tr"}
    full_url = f"{base_url}?{urllib.parse.urlencode(params)}"

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


def get_grounded_evidence(claim_text: str) -> tuple[str, list[dict]]:
    """
    Gemini'ye google_search grounding aracıyla GERÇEK bir arama yaptırır.

    ÖNEMLİ: gemini-2.5-flash'ta google_search tool'u ile response_schema
    (yapılandırılmış JSON çıktı) AYNI ÇAĞRIDA birlikte kullanılamıyor
    (bu kombinasyon şu an sadece Gemini 3 ailesinde destekleniyor).
    Bu yüzden aramayı ayrı, şemasız bir çağrıda yapıp, modelin ürettiği
    metni değil, API'nin döndürdüğü grounding_metadata içindeki GERÇEK
    URL'leri kullanıyoruz. Model buradaki URL'yi kendisi yazmıyor.
    """
    if client is None:
        return "", []

    try:
        grounding_response = _call_with_retry(lambda: client.models.generate_content(
            model='gemini-2.5-flash',
            contents=(
                f"Şu iddiayı araştır ve güncel, doğrulanabilir kanıtlarla "
                f"kısa bir özet çıkar: {claim_text}"
            ),
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.1,
            ),
        ))
    except Exception as e:
        print(f"Grounding Arama Hatası: {str(e)}")
        return "", []

    grounded_summary = getattr(grounding_response, "text", "") or ""

    real_sources: list[dict] = []
    try:
        candidate = grounding_response.candidates[0]
        chunks = candidate.grounding_metadata.grounding_chunks or []
        for chunk in chunks:
            web = getattr(chunk, "web", None)
            if web and getattr(web, "uri", None):
                real_sources.append({
                    "title": web.title or web.uri,
                    "url": web.uri,
                })
    except (AttributeError, IndexError, TypeError):
        pass

    return grounded_summary, real_sources


def verify_urls_are_alive(sources: list[dict], timeout: float = 4.0) -> list[dict]:
    """
    Ek güvenlik ağı: her kaynağa gerçekten kısa bir HEAD isteği atarak
    404/bozuk linkleri ayıklar. Grounding URL'leri normalde gerçektir,
    ancak (Google'ın grounding-redirect linkleri dahil) bazen zaman
    içinde kaldırılmış/taşınmış olabilir — bu yüzden gönderim öncesi
    son bir canlılık kontrolü yapıyoruz.
    """
    def _is_alive(source: dict) -> bool:
        url = source.get("url", "")
        if not url or not url.startswith("http"):
            return False
        try:
            req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status < 400
        except Exception:
            # Bazı siteler HEAD'i reddedip GET ister; ikinci bir şans tanı.
            try:
                req = urllib.request.Request(url, method="GET", headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    return resp.status < 400
            except Exception:
                return False

    if not sources:
        return []

    alive_sources = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(6, len(sources))) as executor:
        future_to_source = {executor.submit(_is_alive, s): s for s in sources}
        for future in concurrent.futures.as_completed(future_to_source):
            source = future_to_source[future]
            try:
                if future.result():
                    alive_sources.append(source)
                else:
                    print(f"Ölü/erişilemeyen kaynak elendi: {source.get('url')}")
            except Exception:
                pass

    return alive_sources


def verify_admin_role(admin_id: int):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        with conn.cursor() as cur:
            cur.execute("SELECT role FROM users WHERE id = %s", (admin_id,))
            row = cur.fetchone()
            if not row or row[0] != 'admin':
                raise HTTPException(status_code=403, detail="Erişim reddedildi. Bu işlemi sadece yöneticiler yapabilir.")
    except psycopg2.OperationalError:
        raise HTTPException(status_code=503, detail="Veritabanı bağlantı hatası.")
    finally:
        if 'conn' in locals():
            conn.close()
    return admin_id

# --- KULLANICI GİRİŞ & KAYIT ENDPOINTLERİ ---
@app.post("/api/login", response_model=LoginResponse)
def login(request: LoginRequest):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, surname, email, password_hash, role FROM users WHERE email = %s",
                (request.email.strip().lower(),),
            )
            row = cur.fetchone()
    except psycopg2.OperationalError:
        raise HTTPException(status_code=503, detail="Veritabanına bağlanılamadı.")
    finally:
        if 'conn' in locals():
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
    except psycopg2.OperationalError:
        raise HTTPException(status_code=503, detail="Veritabanına bağlanılamadı.")
    finally:
        if 'conn' in locals():
            conn.close()

    if not row:
        raise HTTPException(status_code=409, detail="Bu e-posta adresiyle zaten bir hesap var.")

    return LoginResponse(id=row[0], name=row[1], surname=row[2], email=row[3], role=row[4])

# --- DOĞRULAMA ORKESTRASYONU (MİMARİNİN KALBİ) ---
@app.post("/api/verify", response_model=VerificationResponse)
async def verify_claim(request: ClaimRequest):
    if client is None:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY tanımlı değil.")

    if not request.text or len(request.text.strip()) < 10:
        raise HTTPException(status_code=400, detail="Geçersiz iddia girildi.")

    start_total = time.perf_counter()

    # --- 1. ADIM: Google Fact Check Tools API (varsa gerçek fact-check raporları) ---
    web_evidence = query_google_fact_check(request.text)

    # --- 2. ADIM: Gerçek Google Arama Grounding'i ---
    # Fact Check API'den zaten yeterli gerçek kaynak geldiyse (ör. 2+), ikinci bir
    # Gemini çağrısına gerek yok — bu, API kullanımını ve 503 riskini azaltır.
    if len(web_evidence) >= 2:
        grounded_summary, grounded_sources = "", []
    else:
        grounded_summary, grounded_sources = get_grounded_evidence(request.text)

    evidence_text = ""
    if web_evidence:
        evidence_text += "\nDoğrulanmış Fact-Check Raporları:\n"
        for idx, item in enumerate(web_evidence, 1):
            evidence_text += (
                f"[{idx}] İddia: {item['claim_text']} | Kurum: {item['publisher']} | "
                f"Karar: {item['verdict']}\n"
            )
    if grounded_summary:
        evidence_text += f"\nCanlı Web Aramasından Elde Edilen Kanıt Özeti:\n{grounded_summary}\n"
    if not evidence_text:
        evidence_text = "\nHer iki araştırma kanalından da doğrudan kanıt bulunamadı. Genel bilgi birikiminle temkinli analiz et ve statüyü buna göre 'BELİRSİZ'e yakın tut.\n"

    system_instruction = f"""
    Sen üst düzey bir Otonom Gerçek Zamanlı Doğrulama (Fact-Check) Orkestratörüsün.
    [Araştırma Bulguları]:
    {evidence_text}

    Sorumlulukların:
    1. İddiayı kontrol edilebilir alt maddelere böl (`claims_breakdown`), her birine kendi kararını (verdict) ver.
    2. Genel bir doğruluk skoru (0-100), net bir statü (DOĞRU, YANLIŞ, BELİRSİZ) ve objektif bir özet (`summary`) üret.
    3. Yukarıdaki araştırma bulgularının DIŞINA çıkma; kanıt yoksa BELİRSİZ de.

    NOT: Kaynak/URL üretme — bu alan senden istenmiyor, sistem tarafından ayrıca ekleniyor.
    Yanıtını kesinlikle verilen JSON şemasına uygun şekilde üret.
    """

    try:
        # --- 3. ADIM: Yapılandırılmış Analiz (sources İSTEMİYORUZ, sadece metinsel alanlar) ---
        response = _call_with_retry(lambda: client.models.generate_content(
            model='gemini-1.5-flash',
            contents=request.text,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=StructuredAnalysis,
                temperature=0.1,
            ),
        ))

        structured = StructuredAnalysis.model_validate_json(response.text)

        # --- 4. ADIM: Kaynakları TAMAMEN sunucu tarafında, gerçek verilerden kur ---
        # Model hiçbir zaman bir URL string'i üretmedi; buradaki her link ya
        # Google Fact Check API'den ya da Gemini'nin gerçek arama sonucundan geliyor.
        candidate_sources: list[dict] = []
        seen_urls: set[str] = set()

        for item in web_evidence:
            url = item.get("url")
            if url and url not in seen_urls:
                candidate_sources.append({"title": f"{item['publisher']} — {item['title']}", "url": url})
                seen_urls.add(url)

        for item in grounded_sources:
            url = item.get("url")
            if url and url not in seen_urls:
                candidate_sources.append(item)
                seen_urls.add(url)

        # Son güvenlik ağı: gönderilmeden önce linklerin gerçekten açıldığını doğrula.
        alive_sources = verify_urls_are_alive(candidate_sources[:8])

        verdict_data = VerificationResponse(
            status=structured.status,
            confidence_score=structured.confidence_score,
            summary=structured.summary,
            claims_breakdown=structured.claims_breakdown,
            sources=[SourceItem(**s) for s in alive_sources[:6]],
        )

        # --- 5. ADIM: Veritabanına Kayıt ---
        try:
            conn = psycopg2.connect(**DB_CONFIG)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO fact_checks (claim, status, confidence_score, summary, claims_breakdown, sources, checked_by)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        request.text,
                        verdict_data.status.upper(),
                        verdict_data.confidence_score,
                        verdict_data.summary,
                        json.dumps([item.model_dump() for item in verdict_data.claims_breakdown], ensure_ascii=False),
                        json.dumps([item.model_dump() for item in verdict_data.sources], ensure_ascii=False),
                        request.user_id
                    )
                )
                cur.execute(
                    """
                    INSERT INTO chats (user_id, message, response, model)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (
                        request.user_id,
                        request.text,
                        verdict_data.model_dump_json(),
                        'gemini-2.5-flash'
                    )
                )
            conn.commit()
        except Exception as db_err:
            print(f"Fact-Check DB Kayıt Hatası: {str(db_err)}")
        finally:
            if 'conn' in locals():
                conn.close()

        print(f"Analiz Tamamlandı. Süre: {time.perf_counter() - start_total:.2f}s | Canlı kaynak sayısı: {len(verdict_data.sources)}")
        return verdict_data

    except Exception as e:
        print(f"Orkestrasyon Hatası: {str(e)}")
        err_msg = str(e)
        if "503" in err_msg or "UNAVAILABLE" in err_msg or "overloaded" in err_msg.lower():
            raise HTTPException(
                status_code=503,
                detail="Yapay zeka servisi şu anda yoğun talep altında. Lütfen birkaç saniye sonra tekrar deneyin."
            )
        raise HTTPException(status_code=500, detail="Yapay zeka analiz ajanları şu anda yanıt veremiyor.")

# --- KULLANICI GEÇMİŞİ ---
@app.get("/api/history")
def get_history(user_id: int = Query(...)):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, claim as message, summary as response, created_at as created_date,
                       status, confidence_score, claims_breakdown, sources
                FROM fact_checks 
                WHERE checked_by = %s 
                ORDER BY created_at DESC
                """,
                (user_id,)
            )
            rows = cur.fetchall()

            history_data = []
            for row in rows:
                history_data.append({
                    "id": row["id"],
                    "message": row["message"],
                    "response": json.dumps({
                        "status": row["status"],
                        "confidence_score": row["confidence_score"],
                        "summary": row["response"],
                        "claims_breakdown": parse_jsonb_field(row["claims_breakdown"]),
                        "sources": parse_jsonb_field(row["sources"])
                    }, ensure_ascii=False),
                    "created_date": str(row["created_date"])
                })
            return {"data": history_data}
    except psycopg2.Error as e:
        print(f"Fetch History DB Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Geçmiş veriler veritabanından çekilemedi.")
    finally:
        if 'conn' in locals():
            conn.close()

# --- YÖNETİCİ DENETİM MERKEZİ ---
@app.get("/api/admin/logs", response_model=AdminLogsResponse)
def get_admin_logs(admin_id: int = Depends(verify_admin_role)):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT f.id, f.claim, f.status, f.confidence_score, f.summary, 
                       f.claims_breakdown, f.sources, f.created_at, f.checked_by,
                       u.name as user_name, u.surname as user_surname, u.email as user_email
                FROM fact_checks f
                LEFT JOIN users u ON f.checked_by = u.id
                ORDER BY f.created_at DESC
            """)
            fact_rows = cur.fetchall()

            cur.execute("""
                SELECT c.id, c.user_id, c.message, c.response, c.model, c.created_date,
                       u.name as user_name, u.surname as user_surname, u.email as user_email
                FROM chats c
                LEFT JOIN users u ON c.user_id = u.id
                ORDER BY c.created_date DESC
            """)
            chat_rows = cur.fetchall()

            fact_checks_list = [
                FactCheckLogItem(
                    id=row["id"],
                    claim=row["claim"],
                    status=row["status"],
                    confidence_score=row["confidence_score"],
                    summary=row["summary"],
                    claims_breakdown=parse_jsonb_field(row["claims_breakdown"]),
                    sources=parse_jsonb_field(row["sources"]),
                    created_at=str(row["created_at"]),
                    checked_by=row["checked_by"],
                    user_name=row["user_name"] or "Sistem",
                    user_surname=row["user_surname"] or "",
                    user_email=row["user_email"] or ""
                ) for row in fact_rows
            ]

            chats_list = [
                ChatLogItem(
                    id=row["id"],
                    user_id=row["user_id"],
                    message=row["message"],
                    response=row["response"],
                    model=row["model"],
                    created_date=str(row["created_date"]),
                    user_name=row["user_name"] or "Kullanıcı",
                    user_surname=row["user_surname"] or "",
                    user_email=row["user_email"] or ""
                ) for row in chat_rows
            ]

            return AdminLogsResponse(fact_checks=fact_checks_list, chats=chats_list)

    except psycopg2.OperationalError:
        raise HTTPException(status_code=503, detail="Veritabanına bağlanılamadı.")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)