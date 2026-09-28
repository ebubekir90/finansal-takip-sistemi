/* parser.js — CSV ve OFX ayrıştırıcı. Tüm tutarlar integer kuruşa çevrilir; hiçbir rakam yuvarlanmaz. */
const Parser = (function () {
  /* "12.345,67" / "1,234.56" / "-120.5" / "(25,00)" / "₺ 1.250" → kuruş (integer) */
  function toCents(raw) {
    if (raw === null || raw === undefined) return null;
    let s = String(raw).trim();
    if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/^-/.test(s)) { neg = true; s = s.replace(/-/g, ""); }
    if (/-$/.test(s)) { neg = true; s = s.replace(/-/g, ""); }

    // sayısal olmayan karakterleri temizle (para birimi, boşluk, virgül/nokta hariç)
    s = s.replace(/[^\d.,]/g, "");
    if (!s) return null;

    let decimalSep = null;
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastDot !== -1 && lastComma !== -1) {
      decimalSep = lastDot > lastComma ? "." : ",";
    } else if (lastDot !== -1) {
      // tek ayraç: 2 basamak sonraysa ondalık, değilse binlik
      decimalSep = s.length - lastDot - 1 === 2 && s.length - lastDot - 1 <= 2 ? "." : null;
    } else if (lastComma !== -1) {
      decimalSep = s.length - lastComma - 1 === 2 && s.length - lastComma - 1 <= 2 ? "," : null;
    }

    let clean;
    if (decimalSep) {
      const parts = s.split(decimalSep);
      const intPart = parts[0].replace(/[.,]/g, "");
      const fracPart = parts.length > 1 ? (parts[1] + "00").slice(0, 2) : "00";
      clean = intPart + fracPart;
    } else {
      clean = s.replace(/[.,]/g, "");
    }
    clean = clean.replace(/^0+(?=\d)/, "") || "0";
    const cents = parseInt(clean, 10);
    if (isNaN(cents)) return null;
    return neg ? -cents : cents;
  }

  /* Tarihi "YYYY-MM-DD" biçimine çevir */
  function toISO(dateStr) {
    let s = String(dateStr || "").trim();
    if (!s) return null;
    // OFX: YYYYMMDD veya YYYYMMDDHHMMSS (saatli, opsiyonel saat dilimi soneki)
    const ofxMatch = s.match(/^(\d{8})/);
    if (ofxMatch) return `${ofxMatch[1].slice(0, 4)}-${ofxMatch[1].slice(4, 6)}-${ofxMatch[1].slice(6, 8)}`;
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); // YYYY-MM-DD
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);  // DD-MM-YYYY veya MM-DD-YYYY
    if (m) {
      let a = pad(m[1]), b = pad(m[2]);
      let y = m[3].length === 2 ? "20" + m[3] : m[3];
      // önce gün/ay/ay/gün belirsizliği: büyük olan gündür (13+ ise ay)
      let day, month;
      if (parseInt(a, 10) > 12) { day = a; month = b; }
      else if (parseInt(b, 10) > 12) { day = b; month = a; }
      else { day = a; month = b; } // aksi halde DD-MM varsay
      return `${y}-${month}-${day}`;
    }
    return null;
  }
  function pad(n) { return String(n).padStart(2, "0"); }

  function detectDelimiter(firstLine) {
    const candidates = [",", ";", "\t", "|"];
    for (const d of candidates) if (firstLine.includes(d)) return d;
    return ",";
  }

  /* Satırı birimlerine ayır; tırnak içindeki ayraçları koru */
  function splitRow(line, delim) {
    const out = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === delim && !inQ) { out.push(cur); cur = ""; continue; }
      cur += c;
    }
    out.push(cur);
    return out.map(x => x.trim());
  }

  /* Sütun başlıklarını tahmin et */
  function detectColumns(header) {
    const idx = { date: -1, desc: -1, amount: -1, debit: -1, credit: -1 };
    header.forEach((h, i) => {
      const t = (h || "").toLowerCase();
      if (idx.date === -1 && /date|tarih|işlem tarihi|transaction date|islem tarihi|proces/.test(t)) idx.date = i;
      if (idx.desc === -1 && /desc|açıklama|aciklama|memo|payee|name|işlem|islem|merchant|kurum/.test(t) && !/tarih/.test(t)) idx.desc = i;
      if (/debit|borç|borc|çekiş|cekis|withdrawal|harcama|gider/.test(t)) idx.debit = i;
      if (/credit|alacak|yatırma|yatirma|deposit|gelen|giris|gelir/.test(t)) idx.credit = i;
      if (idx.amount === -1 && /amount|tutar|miktar|bakiye|sum|değer|deger/.test(t)) idx.amount = i;
    });

    return idx;
  }

  function parseCsv(text) {
    const rows = [];
    const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim());
    if (!lines.length) return { transactions: [], errors: ["Dosya boş"] };

    // başlık satırını bul: sütun adlarını içeren satır
    let headerIdx = -1, header = null, delim = detectDelimiter(lines[0]);
    for (let i = 0; i < Math.min(lines.length, 12); i++) {
      const row = splitRow(lines[i], delim);
      const joined = row.join(" ").toLowerCase();
      if (/(date|tarih)/.test(joined) && /(amount|tutar|debit|credit|miktar)/.test(joined)) {
        headerIdx = i; header = row; break;
      }
    }
    if (headerIdx === -1) {
      // başlık yoksa ilk satırı veri kabul et ve tahmin et
      headerIdx = -1;
      header = null;
    }

    const col = header ? detectColumns(header) : null;
    const start = headerIdx === -1 ? 0 : headerIdx + 1;
    const errors = [];
    const transactions = [];

    for (let i = start; i < lines.length; i++) {
      const row = splitRow(lines[i], delim);
      if (!row.length) continue;

      let date, desc, amountCents;
      if (col && col.date !== -1 && col.desc !== -1 && (col.amount !== -1 || col.debit !== -1 || col.credit !== -1)) {
        date = toISO(row[col.date]);
        desc = row[col.desc] || "(açıklama yok)";
        if (col.amount !== -1) amountCents = toCents(row[col.amount]);
        else {
          const d = toCents(row[col.debit]);
          const c = toCents(row[col.credit]);
          amountCents = c !== null && c !== 0 ? c : (d !== null ? -d : null);
        }
      } else {
        // başlıksız: tarih, açıklama, tutar sırasıyla dene (sondaki sayı tutar)
        const nums = [];
        row.forEach((c, ci) => { if (c && toCents(c) !== null) nums.push(ci); });
        if (!nums.length) continue;
        date = toISO(row[0]) || toISO(row[1]);
        desc = row.filter((c, ci) => ci !== nums[0]).join(" ") || "(açıklama yok)";
        amountCents = toCents(row[nums[nums.length - 1]]);
      }

      if (date && amountCents !== null && amountCents !== 0) {
        transactions.push({ date, description: desc, amount_cents: amountCents, source: "csv" });
      } else {
        errors.push(`Satır ${i + 1} atlandı (tarih veya tutar bulunamadı)`);
      }
    }
    return { transactions, errors };
  }

  function parseOfx(text) {
    // OFX içinde <STMTTRN> bloklarını çöz: TRNTYPE, DTPOSTED, NAME/MEMO, TRNAMT
    const errors = [];
    const transactions = [];
    const blockRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let m;
    while ((m = blockRe.exec(text)) !== null) {
      const body = m[1];
      const get = (tag) => {
        const r = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
        const g = body.match(r);
        return g ? g[1].trim() : null;
      };
      const date = toISO(get("DTPOSTED") || get("DTUSER"));
      const desc = get("NAME") || get("MEMO") || get("PAYEE") || "(açıklama yok)";
      const amt = get("TRNAMT");
      const cents = toCents(amt);
      if (date && cents !== null && cents !== 0) {
        transactions.push({ date, description: desc, amount_cents: cents, source: "ofx" });
      } else {
        errors.push("Bir OFX işlemi atlandı (tarih veya tutar bulunamadı)");
      }
    }
    if (!transactions.length && !/<STMTTRN>/i.test(text)) {
      errors.push("OFX içinde <STMTTRN> bloğu bulunamadı");
    }
    return { transactions, errors };
  }

  function parse(text, filename) {
    const name = (filename || "").toLowerCase();
    if (/\.ofx$/.test(name) || /\.qfx$/.test(name) || /\.qbo$/.test(name) || /<OFX>|<ofx>/i.test(text)) {
      return parseOfx(text);
    }
    return parseCsv(text);
  }

  return { parse, toCents, toISO };
})();

