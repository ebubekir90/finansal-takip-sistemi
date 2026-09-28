/* categorize.js — Kural tabanlı kategorizasyon: gereksinim (need) / haz (want) / gelir (income) */
const Categorize = (function () {
  const RULE_KEY = "ft_rules_v1";

  const DEFAULT_RULES = [
    { pattern: "market", category: "Market", need: "need" },
    { pattern: "migros", category: "Market", need: "need" },
    { pattern: "a101", category: "Market", need: "need" },
    { pattern: "bim", category: "Market", need: "need" },
    { pattern: "carrefour", category: "Market", need: "need" },
    { pattern: "şok", category: "Market", need: "need" },
    { pattern: "kira", category: "Kira", need: "need" },
    { pattern: "rent", category: "Kira", need: "need" },
    { pattern: "elektrik", category: "Faturalar", need: "need" },
    { pattern: "su", category: "Faturalar", need: "need" },
    { pattern: "doğalgaz", category: "Faturalar", need: "need" },
    { pattern: "internet", category: "Faturalar", need: "need" },
    { pattern: "telefon", category: "Faturalar", need: "need" },
    { pattern: "fatura", category: "Faturalar", need: "need" },
    { pattern: "maaş", category: "Maaş", need: "income" },
    { pattern: "salary", category: "Maaş", need: "income" },
    { pattern: "ücret", category: "Maaş", need: "income" },
    { pattern: "kafe", category: "Yeme İçme", need: "want" },
    { pattern: "cafe", category: "Yeme İçme", need: "want" },
    { pattern: "restoran", category: "Yeme İçme", need: "want" },
    { pattern: "restaurant", category: "Yeme İçme", need: "want" },
    { pattern: "yemek", category: "Yeme İçme", need: "want" },
    { pattern: "market yemek", category: "Yeme İçme", need: "want" },
    { pattern: "ulaşım", category: "Ulaşım", need: "need" },
    { pattern: "taksi", category: "Ulaşım", need: "want" },
    { pattern: "benzin", category: "Ulaşım", need: "need" },
    { pattern: "akaryakıt", category: "Ulaşım", need: "need" },
    { pattern: "fuel", category: "Ulaşım", need: "need" },
    { pattern: "spotify", category: "Abonelik", need: "want" },
    { pattern: "netflix", category: "Abonelik", need: "want" },
    { pattern: "youtube", category: "Abonelik", need: "want" },
    { pattern: "prime", category: "Abonelik", need: "want" },
    { pattern: "subscription", category: "Abonelik", need: "want" },
    { pattern: "abonelik", category: "Abonelik", need: "want" },
    { pattern: "eczane", category: "Sağlık", need: "need" },
    { pattern: "pharmacy", category: "Sağlık", need: "need" },
    { pattern: "ilaç", category: "Sağlık", need: "need" },
    { pattern: "doktor", category: "Sağlık", need: "need" },
    { pattern: "giyim", category: "Giyim", need: "want" },
    { pattern: "clothing", category: "Giyim", need: "want" },
    { pattern: "eğlence", category: "Eğlence", need: "want" },
    { pattern: "entertainment", category: "Eğlence", need: "want" },
    { pattern: "oyun", category: "Eğlence", need: "want" },
    { pattern: "sinema", category: "Eğlence", need: "want" }
  ];

  function loadRules() {
    try {
      const raw = localStorage.getItem(RULE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return DEFAULT_RULES.map(r => Object.assign({}, r));
  }

  function saveRules(rules) { localStorage.setItem(RULE_KEY, JSON.stringify(rules)); }

  function normalize(description) {
    return String(description || "").toLowerCase().replace(/ğ/g, "g").replace(/ü/g, "u")
      .replace(/ş/g, "s").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c");
  }

  /* Açıklamayı eşleştir → { category, need } */
  function match(description) {
    const d = normalize(description);
    const rules = loadRules();
    for (const r of rules) {
      if (d.includes(normalize(r.pattern))) {
        return { category: r.category, need: r.need };
      }
    }
    return null;
  }

  /* Bir işlemi sınıflandır. Tutar pozitifse öncelikle gelir. */
  function classify(description, amountCents, existingCategory) {
    const m = match(description);
    if (amountCents > 0) {
      // gelir: kural "income" derse gelir, aksi halde varsayılan Gelir
      const isIncomeRule = m && m.need === "income";
      return {
        category: isIncomeRule ? m.category : (existingCategory || "Gelir"),
        need: "income"
      };
    }
    // gider
    if (m) return { category: m.category, need: m.need };
    return { category: existingCategory || "Kategorisiz", need: "" };
  }

  /* Tüm defteri kurallara göre yeniden sınıflandır (elle atanan kategori korunmaz) */
  function reclassifyAll() {
    const list = Ledger.load();
    list.forEach(t => {
      const c = classify(t.description, t.amount_cents, "");
      t.category = c.category;
      t.need = c.need;
    });
    Ledger.save(list);
  }

  return { loadRules, saveRules, classify, match, reclassifyAll, DEFAULT_RULES };
})();
