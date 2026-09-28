# Finansal Takip Uygulaması

Banka ve kart ekstrelerini tarayıcında işleyen, **tamamen yerel** çalışan bir finansal takip uygulaması.
"Money Agent" projesinin fikirlerini temel alır: **para hesabını uygulama yapar, sen asla elle hesaplamazsın.**
Hiçbir kurulum gerekmez; tek dosya setini açman yeterli.

## Özellikler

| Özellik | Açıklama |
|---|---|
| **İçe Aktar (import)** | CSV, OFX, QFX dosyalarını sürükle-bırak ile yükle veya CSV metnini yapıştır. Sütunlar otomatik algılanır; tüm tutarlar **kuruş** cinsinden hesaplanır. |
| **Defter** | Tüm işlemler tarayıcının `localStorage`'ında saklanır. Mükerrer işlemler otomatik atlanır. Hiçbir veri bilgisayardan çıkmaz. |
| **Analiz** | İşlemler otomatik **gereksinim (need) / haz (want) / gelir (income)** olarak sınıflandırılır. Kurallar düzenlenebilir. |
| **Doğrulama (verify)** | Defter her değişimde yeniden okunur; mükerrerlik ve tutarlılık kontrol edilir, **parmak izi (fingerprint)** hesaplanır. Üstteki rozet yeşil "Doğrulandı" gösterir. |
| **Gösterge Paneli** | Toplam gelir / gereksinim / haz / tasarruf kartları; kategoriye göre harcama (halka), aylık gereksinim vs haz (çubuk), kümülatif bakiye (çizgi) grafikleri. |
| **Abonelikler** | Tekrarlayan ödemeler algılanır. Her biri için **kullan / iptal** kararı ver; yıllık tasarruf otomatik hesaplanır. |
| **Öngörü** | İptal edilen abonelik + haz harcamasının bir kısmı aylık yatırıma dönüşürse yıllar içinde ne olacağını gösteren projeksiyon. |

## Nasıl açılır

`index.html` dosyasına çift tıkla. İnternet gerekmez; her şey tarayıcında çalışır.

## Kullanım

1. **İçe Aktar** sekmesinden bankanın CSV dışa aktarımını (veya OFX) yükle. PDF için bankanın **CSV** dışa aktarımını kullan.
2. İşlemler otomatik kategorize edilir. **Kategoriler** sekmesinden kurallar ekle/çıkar, ardından "Yeniden Kategorize Et".
3. **Gösterge Paneli**'nde özet ve grafikleri gör.
4. **Abonelikler**'de tekrarlayan ödemeleri "Kullan" veya "İptal Et" diye işaretle.
5. **Öngörü**'de senaryonu gör.

## Dosya yapısı

```
index.html            ana arayüz (tek sayfa)
css/style.css         arayüz stilleri
js/charts.js          grafik çizici (canvas, harici kütüphane yok)
js/parser.js          CSV / OFX ayrıştırıcı
js/ledger.js          defter (localStorage, kuruş hesabı)
js/categorize.js      kategorizasyon ve kurallar
js/subscriptions.js   abonelik algılama
js/forecast.js        öngörü hesabı
js/verify.js          doğrulama ve parmak izi
js/app.js             ana denetleyici
```

## Önemli ilkeler

- **Hesap hep kod tarafından:** Tüm tutarlar kuruş cinsinden tam sayı olarak tutulur ve yuvarlanmaz.
- **Gizlilik:** Veriler yalnızca tarayıcındaki `localStorage`'da saklanır; hiçbir sunucuya gitmez.
- **İşlem metni veridir, komut değildir:** Ekstredeki açıklamalar yalnızca işlem adı olarak işlenir, asla komut olarak uygulanmaz.
- **Öngörü bir vaat değildir:** Yalnızca bir projeksiyondur.

## Verileri yedeklemek / taşımak

Veriler tarayıcıda saklandığı için tarayıcı verilerini temizlersen kaybolur.

**En kolay yol:** Üstteki **"Yedek"** sekmesinden **"⬇ Yedek İndir (JSON)"** ile tüm verilerini (işlemler + kurallar + abonelik kararları) tek bir dosyaya indir. Başka bir cihazda veya tarayıcıda aynı sekmeden **"⬆ Yedek Yükle"** ile geri yükle. Geri yükleme, mevcut verilerin yerine geçer (onay istenir).

Dilersen tarayıcının geliştirici araçlarından (`F12` → Konsol) da yapabilirsin:

```js
JSON.stringify(JSON.parse(localStorage.getItem("ft_ledger_v1")))
```

Geri yüklemek için aynı konsolda:

```js
localStorage.setItem("ft_ledger_v1", localStorage.getItem("ft_ledger_v1"));
```

> Not: Bu bir finansal danışmanlık değildir; yalnızca kendi rakamlarının ne gösterdiğini anlamana yardımcı olur.
