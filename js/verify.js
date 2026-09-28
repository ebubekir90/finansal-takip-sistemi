/* verify.js — Doğrulama: defteri yeniden okur, mükerrerlik ve tutarlılık kontrolü yapar, parmak izi hesaplar. */
const Verify = (function () {
  /* basit djb2 dize karması */
  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(16);
  }

  function run(transactions) {
    const issues = [];
    const seen = new Set();
    let duplicates = 0;
    let income = 0, expense = 0;

    const parts = [];
    transactions.forEach(t => {
      if (!Number.isInteger(t.amount_cents)) issues.push(`Tam sayı olmayan tutar: ${t.id}`);
      const key = `${t.date}|${String(t.description).toLowerCase().trim()}|${t.amount_cents}`;
      parts.push(key);
      if (seen.has(key)) duplicates++; else seen.add(key);
      if (t.amount_cents > 0) income += t.amount_cents;
      else expense += t.amount_cents;
    });

    if (duplicates) issues.push(`${duplicates} mükerrer işlem var`);
    const net = income + expense;
    const fingerprint = hash(parts.slice().sort().join("~"));

    return {
      ok: issues.length === 0,
      issues,
      fingerprint,
      counts: { total: transactions.length, duplicates, income, expense, net }
    };
  }

  return { run, hash };
})();
