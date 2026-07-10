import os
import asyncio
from pathlib import Path
import bcrypt
import psycopg2
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from google.genai import types

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

    system_instruction = """
    Sen üst düzey bir Otonom Gerçek Zamanlı Doğrulama (Fact-Check) Orkestratörüsün.
    Arkada 3 farklı ajan akışını yönetiyorsun:
    1. [Ayrıştırma Ajanı]: Kullanıcının metnini kontrol edilebilir alt iddialara (claim) böl.
    2. [Arama ve Karşılaştırma Ajanı]: Bu iddiaları tarihsel gerçekler, güncel veriler ve bilimsel olgularla kıyasla.
    3. [Skorlama Ajanı]: Genel bir 'DOĞRU', 'YANLIŞ' veya 'BELİRSİZ' kararı ver, 0-100 arası güven skoru belirle.
    
    Yanıtını kesinlikle verilen JSON şemasına uygun şekilde üret. Objektif, tarafsız, net ve akademik bir dil kullan.
    """

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=request.text,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=VerificationResponse,
                temperature=0.2,
            ),
        )
        
        try:
            conn = psycopg2.connect(**DB_CONFIG)
            with conn.cursor() as cur:
                # DİKKAT: init.sql'e göre chats tablosu ve model kolonu kullanıldı.
                cur.execute(
                    """
                    INSERT INTO chats (user_id, message, response, model)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (request.user_id, request.text, response.text, 'gemini-2.5-flash')
                )
            conn.commit()
        except Exception as db_err:
            print(f"DB Error: {str(db_err)}")
        finally:
            if 'conn' in locals():
                conn.close()

        return VerificationResponse.model_validate_json(response.text)

    except Exception as e:
        raise HTTPException(status_code=500, detail="Yapay zeka analiz ajanları şu anda yanıt veremiyor.")

@app.get("/api/history")
def get_history(user_id: int = Query(...)):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        with conn.cursor() as cur:
            # DİKKAT: init.sql'e göre chats tablosu ve created_date kolonu kullanıldı.
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)