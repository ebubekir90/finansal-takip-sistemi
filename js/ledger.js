/* ledger.js — Defter yönetimi. Veriler tarayıcının localStorage'ında saklanır; hesap integer kuruş cinsindendir. */
const Ledger = (function () {
  const KEY = "ft_ledger_v1";

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function uid() {
    return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* Yeni işlemleri ekle; mükerrerleri atla (aynı tarih + açıklama + tutar) */
  function addTransactions(txns) {
    const list = load();
    const existing = new Set(list.map(t => keyOf(t)));
    let added = 0, skipped = 0;
    txns.forEach(t => {
      const k = keyOf(t);
      if (existing.has(k)) { skipped++; return; }
      existing.add(k);
      list.push({
        id: uid(),
        date: t.date,
        description: t.description,
        amount_cents: t.amount_cents,
        category: t.category || "",
        need: t.need || "",
        source: t.source || "manual",
        imported_at: new Date().toISOString()
      });
      added++;
    });
    save(list);
    return { added, skipped };
  }

  function addManual(t) {
    const list = load();
    const item = {
      id: uid(),
      date: t.date,
      description: t.description,
      amount_cents: t.amount_cents,
      category: t.category || "",
      need: t.need || "",
      source: "manual",
      imported_at: new Date().toISOString()
    };
    list.push(item);
    save(list);
    return item;
  }

  function remove(id) {
    save(load().filter(t => t.id !== id));
  }

  function update(id, patch) {
    save(load().map(t => t.id === id ? Object.assign({}, t, patch) : t));
  }

  function clear() { localStorage.removeItem(KEY); }

  function getAll() {
    return load().slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  function keyOf(t) {
    return `${t.date}|${String(t.description).toLowerCase().trim()}|${t.amount_cents}`;
  }

  /* kuruş → "1.234,56 ₺" (Türk biçimi) */
  function formatMoney(cents) {
    const neg = cents < 0;
    const abs = Math.abs(cents);
    const tl = Math.floor(abs / 100);
    const kr = abs % 100;
    const tlStr = tl.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "−" : "") + tlStr + "," + String(kr).padStart(2, "0") + " ₺";
  }

  function toCentsInput(str) {
    // kullanıcı girişi: "120,50" veya "120.50"
    const v = Parser.toCents(str);
    return v;
  }

  return { load, save, addTransactions, addManual, remove, update, clear, getAll, formatMoney, toCentsInput, uid };
})();
