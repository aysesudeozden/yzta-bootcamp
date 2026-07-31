import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Reconfigure stdout to use UTF-8 to prevent charmap errors on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='backslashreplace')

# Load environment
backend_dir = Path(__file__).resolve().parent
load_dotenv(backend_dir / ".env.local")
load_dotenv(backend_dir.parent / ".env")

import main

def mask_key(key: str) -> str:
    if not key:
        return "Tanımlı Değil"
    if len(key) <= 8:
        return "***"
    return f"{key[:4]}...{key[-4:]}"

def run_diagnostics(claim: str):
    print("=" * 60)
    print("API TEŞHİS RAPORU (FACT-CHECK / SERPER / GEMINI)")
    print("=" * 60)
    
    gemini_key = os.getenv("GEMINI_API_KEY")
    fact_check_key = os.getenv("FACT_CHECK_API_KEY")
    serper_key = os.getenv("SERPER_API_KEY")
    
    print(f"GEMINI_API_KEY      : {mask_key(gemini_key)}")
    print(f"FACT_CHECK_API_KEY  : {mask_key(fact_check_key)}")
    print(f"SERPER_API_KEY      : {mask_key(serper_key)}")
    print("-" * 60)
    
    print(f"Test Edilen İddia: '{claim}'\n")
    
    fact_check_results = []
    print("1. Google Fact Check Tools API Test Ediliyor...")
    try:
        fact_check_results = main.query_google_fact_check(claim)
        print(f"-> Fact Check API'den {len(fact_check_results)} sonuç bulundu.")
        for idx, res in enumerate(fact_check_results, 1):
            print(f"   [{idx}] Yayıncı: {res['publisher']}")
            print(f"       Başlık: {res['title']}")
            print(f"       URL  : {res['url']}")
    except Exception as e:
        print(f"-> Google Fact Check API Hatası: {e}")
        
    print("-" * 60)
    
    serper_results = []
    print("2. Serper API (Google Search) Test Ediliyor...")
    try:
        serper_results = main.query_serper_search(claim)
        print(f"-> Serper API'den {len(serper_results)} sonuç bulundu.")
        for idx, res in enumerate(serper_results, 1):
            print(f"   [{idx}] Başlık: {res['title']}")
            print(f"       URL  : {res['url']}")
    except Exception as e:
        print(f"-> Serper API Hatası: {e}")
        
    print("-" * 60)
    
    print("3. Gemini API Entegrasyonu Test Ediliyor...")
    if not main.client:
        print("-> Gemini Client başlatılamadı (GEMINI_API_KEY eksik veya geçersiz).")
        return
        
    evidence_text = ""
    if fact_check_results:
        evidence_text = "\nGoogle Fact Check API'den bulunan doğrulanmış kaynaklar ve teyit raporları:\n"
        for idx, item in enumerate(fact_check_results, 1):
            evidence_text += (
                f"[{idx}] İddia: {item['claim_text']}\n"
                f"    Ortaya Atan: {item['claimant']}\n"
                f"    Teyit Eden Kurum: {item['publisher']} - Karar: {item['verdict']}\n"
                f"    Kaynak Rapor Başlığı: {item['title']}\n"
                f"    Kaynak URL: {item['url']}\n\n"
            )
    elif serper_results:
        evidence_text = "\nGoogle Fact Check üzerinde doğrudan teyit raporu bulunamadı. Ancak Canlı Web Arama Ajanı (Serper API) ile şu güncel internet bulguları ve haberler tespit edildi:\n"
        for idx, item in enumerate(serper_results, 1):
            evidence_text += (
                f"[{idx}] Haber/Kaynak Başlığı: {item['title']}\n"
                f"    İçerik Özeti (Snippet): {item['snippet']}\n"
                f"    Kaynak URL: {item['url']}\n\n"
            )
    else:
        evidence_text = "\nHem Google Fact Check API hem de Serper canlı araması üzerinde bu iddiaya dair doğrudan bir bulguya ulaşılamadı. Genel bilgilerinle analiz et.\n"
        
    system_instruction = f"""
    Sen üst düzey bir Otonom Gerçek Zamanlı Doğrulama (Fact-Check) Orkestratürüsün.
    Aşağıda sana sunulan [Web Araştırma Bulguları] ve kullanıcının girdiği [İddia Metni]'ni karşılaştırarak profesyonel bir analiz yapacaksın.
    
    [Web Araştırma Bulguları]:
    {evidence_text}
    
    Sorumlulukların:
    1. Kullanıcının iddiasını kontrol edilebilir alt maddelere böl (`claims_breakdown`).
    2. Genel bir doğruluk skoru (0-100) ve objektif, akademik dille yazılmış bir özet (`summary`) üret.
    
    CRITICAL (ÇOK ÖNEMLİ - ZORUNLU KURAL):
    Eğer yukarıda sana [Web Araştırma Bulguları] sağlandıysa (Google Fact Check veya Serper arama bulguları), o bulguların içindeki "Kaynak URL" ve "Kaynak/Rapor Başlığı" bilgilerini KESİNLİKLE ama KESİNLİKLE yanıtındaki `sources` listesine eklemelisin.
    
    `sources` listesinin formatı tam olarak şöyle olmalıdır:
    [
      {{ "title": "Kaynak/Yayıncı Adı - Başlık", "url": "İlgili Kaynak URL'si" }}
    ]
    
    Yanıtını kesinlikle verilen JSON şemasına (VerificationResponse) uygun şekilde üret.
    """
    
    try:
        from google.genai import types
        response = main.client.models.generate_content(
            model='gemini-2.5-flash',
            contents=claim,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=main.VerificationResponse,
                temperature=0.1,
            ),
        )
        print("-> Gemini Yanıtı başarıyla alındı ve doğrulandı!")
        print("Ham JSON Çıktısı:")
        print(response.text)
    except Exception as e:
        print(f"-> Gemini Hatası: {e}")

if __name__ == "__main__":
    # Test iddiası
    test_claim = "Merkez Bankası döviz rezervlerinin son 10 yılın en düşük seviyesine gerilediği açıklandı."
    if len(sys.argv) > 1:
        test_claim = " ".join(sys.argv[1:])
    run_diagnostics(test_claim)
