/* subscriptions.js — Tekrarlayan ödemeleri (abonelikler) algılar ve keep/cancel kararı tutar */
const Subs = (function () {
  const DEC_KEY = "ft_subs_v1";

  function norm(desc) {
    return String(desc || "").toLowerCase().replace(/[^a-z0-9ğüşıöç]/g, "").replace(/ğ/g, "g")
      .replace(/ü/g, "u").replace(/ş/g, "s").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c").trim();
  }

  function loadDecisions() {
    try { return JSON.parse(localStorage.getItem(DEC_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveDecisions(d) { localStorage.setItem(DEC_KEY, JSON.stringify(d)); }

  /* Tekrarlayan harcama gruplarını bul */
  function detect(transactions) {
    const groups = {};
    transactions.filter(t => t.amount_cents < 0).forEach(t => {
      const k = norm(t.description);
      if (!k) return;
      if (!groups[k]) groups[k] = [];
      groups[k].push(t);
    });

    const subs = [];
    Object.keys(groups).forEach(k => {
      const txns = groups[k];
      if (txns.length < 2) return;
      // farklı aylara yayılmasını kontrol et
      const months = new Set(txns.map(t => t.date.slice(0, 7)));
      if (months.size < 2 && txns.length < 3) return;
      const total = txns.reduce((s, t) => s + Math.abs(t.amount_cents), 0);
      const monthly = Math.round(total / Math.max(months.size, 1));
      const yearly = monthly * 12;
      const lastDate = txns.map(t => t.date).sort().pop();
      const example = txns[0].description;
      subs.push({
        key: k,
        name: example,
        count: txns.length,
        months: months.size,
        monthly_cents: monthly,
        yearly_cents: yearly,
        last_date: lastDate
      });
    });
    subs.sort((a, b) => b.monthly_cents - a.monthly_cents);
    return subs;
  }

  function getDecision(key) {
    const d = loadDecisions();
    return d[key] || "";
  }
  function setDecision(key, val) {
    const d = loadDecisions();
    if (val) d[key] = val; else delete d[key];
    saveDecisions(d);
  }

  /* Abonelik özeti: aylık, yıllık, iptal tasarrufu */
  function stats(subs) {
    let monthly = 0, yearly = 0, cancelSavings = 0;
    subs.forEach(s => {
      monthly += s.monthly_cents;
      yearly += s.yearly_cents;
      if (getDecision(s.key) === "cancel") cancelSavings += s.yearly_cents;
    });
    return { monthly, yearly, cancelSavings };
  }

  return { detect, getDecision, setDecision, stats, loadDecisions, saveDecisions };
})();
