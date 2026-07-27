-- Kullanıcıları tutacağımız tablonun iskeleti
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, -- Kullanıcının benzersiz ID'si
    name VARCHAR(50) NOT NULL, -- Kullanıcının adı
    surname VARCHAR(50) NOT NULL, -- Kullanıcının soyadı
    email VARCHAR(100) UNIQUE NOT NULL, -- Sisteme giriş yapılacak benzersiz e-posta adresi
    password_hash VARCHAR(255) NOT NULL, -- Güvenlik için hashlenmiş şifre
    role VARCHAR(50) NOT NULL DEFAULT 'user', -- Kullanıcının yetkisi (ör: admin, user)
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Hesabın oluşturulma tarihi
);

-- Doğrulanan haberleri/iddiaları tutacağımız tablonun iskeleti
CREATE TABLE IF NOT EXISTS fact_checks (
    id SERIAL PRIMARY KEY, -- Analiz kaydının benzersiz ID'si
    claim TEXT NOT NULL, -- Kullanıcıdan gelen haber metni veya iddia
    status VARCHAR(50) NOT NULL, -- Analizin sonucu (Asılsız, Doğru, Kısmen doğru, Yanıltıcı)
    confidence_score INT NOT NULL, -- Yapay zekanın analize verdiği güven skoru yüzdesi (0-100)
    summary TEXT, -- Yapılan çapraz doğrulamanın genel özeti
    claims_breakdown JSONB, -- İddianın alt parçalara ayrılarak incelendiği detay listesi (JSON formunda)
    sources JSONB, -- İddiayı doğrulayan/çürüten kaynak linkleri ve başlıkları (JSON formunda)
    checked_by INT REFERENCES users(id), -- Analizi gerçekleştiren kullanıcının ID'si
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Analizin yapıldığı tarih ve saat
);

-- Kullanıcıların sohbet geçmişini tutacağımız tablonun iskeleti
CREATE TABLE IF NOT EXISTS chats (
    id SERIAL PRIMARY KEY, -- Sohbet mesajının benzersiz ID'si
    user_id INT REFERENCES users(id) ON DELETE CASCADE, -- Mesajı gönderen kullanıcının ID'si (Kullanıcı silinirse mesajları da silinir)
    message TEXT NOT NULL, -- Kullanıcının sisteme yazdığı mesaj/soru
    response TEXT NOT NULL, -- Yapay zekanın kullanıcıya verdiği cevap
    model VARCHAR(50) NOT NULL, -- Cevabı üretirken kullanılan modelin adı (ör: gemini-2.5-flash)
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Mesajlaşmanın gerçekleştiği tarih ve saat
);