# Takım İsmi

Parlayan Yıldızlar Takımı

# Ürün İle İlgili Bilgiler

## Takım Elemanları

- Buket Yurt: Team Member/Developer <!-- rolünüzü güncelleyin (Product Owner / Scrum Master / Developer) -->
- Sude Ö.: Team Member/Developer <!-- ad-soyad ve rolü güncelleyin -->
- Sedef: Team Member/Developer <!-- ad-soyad ve rolü güncelleyin -->
- Feyza İrem: Team Member/Developer <!-- ad-soyad ve rolü güncelleyin -->

## Ürün İsmi

Doğrulama Asistanı

## Ürün Açıklaması

Doğrulama Asistanı, şüpheli haberleri, sosyal medya paylaşımlarını ve iddiaları
otonom yapay zeka ajanlarıyla saniyeler içinde analiz eden gerçek zamanlı bir
doğrulama (fact-checking) uygulamasıdır. Kullanıcının girdiği metin,
multi-agent mimarisiyle kontrol edilebilir alt iddialara ayrıştırılır; canlı
web ve bilimsel veritabanları taranarak bulgular iddialarla çapraz analize
tabi tutulur ve nihai güven skoru, yönetici özeti ile kanıt raporu halinde
kullanıcıya sunulur. Tüm sonuçlar, doğrulama kaynaklarına (grounding links)
bağlantılarla birlikte şeffaf biçimde raporlanır.

## Ürün Özellikleri

- Canlı web ve bilimsel veritabanlarında tarama (Arama Ajanı)
- Bulgular ile iddiaların çapraz analizi (Karşılaştırma Ajanı)
- Nihai güven skoru ve kanıt raporu sentezi (Skorlama Ajanı)
- İddia kırılımları, yönetici özeti ve doğrulama kaynakları (grounding links) içeren sonuç ekranı
- E-posta/şifre ile giriş; Google ve GitHub ile devam etme seçenekleri
- Eski araştırmalara belli bir süre içinde tekrar ulaşabilme 

## Hedef Kitle

- Sosyal medya kullanıcıları
- Gazeteciler ve içerik üreticileri
- Öğrenciler ve akademisyenler
- Doğru bilgiye hızlı ulaşmak isteyen 15-65 yaş arası tüm internet kullanıcıları

## Product Backlog URL

[Jira Backlog Board](https://buketyurt.atlassian.net/jira/software/projects/SCRUM/boards/1/backlog)

---

# Sprint 1

- **Sprint Notları**: Sprint adı "İlk Elin Günahı Olmaz :)" olarak belirlenmiş olup 26 Haziran – 5 Temmuz 2026 tarihleri arasında yürütülmüştür. Sprint hedefi; WebSearch tool'unun belirlenmesi, login sayfası ve arayüz sayfası UI'larının geliştirilmesi, proje mimarisinin ve akışının çıkarılmasıdır.

- **Sprint içinde tamamlanması tahmin edilen puan**: 11 puan

- **Puan tamamlama mantığı**: Sprint'e alınan her story, iş yüküne göre puanlanmıştır: Mimari tasarım dökümanı (SCRUM-1: 3 puan), Login Sayfası (SCRUM-2: 2 puan), Arayüz Sayfası (SCRUM-3: 3 puan), Web search/grounding API araştırması (SCRUM-4: 3 puan). İlk sprint olduğu için ekip hızı (velocity) referansı bulunmadığından toplam 11 puanlık tahminle başlanmıştır.

- **Backlog düzeni ve Story seçimleri**: Backlog, ilk yapılacak story'lere göre düzenlenmiştir. Sprint 1'e ürünün temelini oluşturan mimari tasarım, login/arayüz UI geliştirmeleri ve web search araştırması alınmış; bu işlerin çıktısına bağımlı olan story'ler (SCRUM-5: Login sayfası ile arayüz sayfasının birleştirilmesi, SCRUM-6: Database bağlanması, SCRUM-7: Web tool'un arayüze entegrasyonu) sonraki sprint'ler için backlog'da bekletilmiştir.

  ![Jira Backlog](docs/sprint1/jira-backlog.jpeg)

- **Daily Scrum**: Daily Scrum toplantıları, ekip üyelerinin farklı zaman planlamaları sebebiyle WhatsApp üzerinden asenkron olarak yürütülmüştür. Sprint boyunca 30.06.2026 ve 02.07.2026 tarihlerinde iki daily yapılmış, üyeler yaptıkları işleri ve sonraki adımlarını paylaşmıştır. Daily Scrum ekran görüntüleri Word dosyası olarak da tarafımızdan paylaşılmaktadır: [YZTA Sprint Log](YZTA%20Sprint%20Log.docx)

  **Daily 1**

  ![Daily Scrum 30.06.2026](docs/sprint1/daily-scrum-2026-06-30.png)

  **Daily2**
  ![Daily Scrum 02.07.2026 - 1](docs/sprint1/daily-scrum-2026-07-02-3.png)
  ![Daily Scrum 02.07.2026 - 1](docs/sprint1/daily-scrum-2026-07-02-1.png)
  ![Daily Scrum 02.07.2026 - 2](docs/sprint1/daily-scrum-2026-07-02-2.png)

- **Sprint board update**: Sprint board ekran görüntüleri:

  Sprint devam ederken:

  ![Jira Sprint Board](docs/sprint1/jira-board.jpeg)

  Sprint sonu:

  ![Jira Sprint Board - Sprint Sonu](/docs/sprint1/jira-board-2.png)

- **Ürün Durumu**: Ekran görüntüleri:

  Login sayfası:

  ![Login Sayfası](docs/sprint1/product-login.png)

  Ana sayfa (iddia analiz ekranı):

  ![Ana Sayfa](docs/sprint1/product-home.png)

- **Sprint Review**: Sprint sonunda planlanan 11 puanın 8'i tamamlanmıştır. Login Sayfası (SCRUM-2: 2 puan), Arayüz Sayfası (SCRUM-3: 3 puan) ve Web search/grounding API araştırması (SCRUM-4: 3 puan) Done durumuna alınmış; ürünün login sayfası ile ana sayfası (iddia analiz ekranı) çalışır ve demoya hazır duruma getirilmiştir. Mimari tasarım dökümanı (SCRUM-1: 3 puan) sprint içinde tamamlanamamış olup bir sonraki sprint'e devredilmiştir. Bir sonraki sprint planlamasında bu iş; backlog'da bekleyen login ile arayüz sayfasının birleştirilmesi (SCRUM-5), database bağlanması (SCRUM-6) ve web tool'un arayüze entegrasyonu (SCRUM-7) story'leriyle birlikte ele alınacaktır. Sprint Review katılımcıları: Buket Yurt, Sude Özden., Sedef Ülker, Feyza İrem Kart. 

- **Sprint Retrospective**:
  - Daily Scrum'ların WhatsApp üzerinden asenkron yürütülmesinin ekibe uyduğuna ve devam etmesine karar verilmiştir.
  - UI değişikliklerinin commit'lenmeden önce takımla paylaşılıp geri bildirim alınması yaklaşımı benimsenmiştir.
  - Bir sonraki sprint'te login ile arayüz sayfasının birleştirilmesine, database bağlantısına ve web tool entegrasyonuna öncelik verilecektir.
