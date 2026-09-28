/* forecast.js — Aylık yatırımın yıllar içindeki bileşik büyümesi. Sadece bir projeksiyondur, getiri vaadi değildir. */
const Forecast = (function () {
  /*
   * Aylık bileşik simülasyon.
   * monthlyCents: her ay eklenen yatırım (kuruş)
   * years: yıl sayısı
   * annualPct: yıllık getiri yüzdesi
   * Döndürür: [{ year, balance_cents }] (her yıl sonu bakiyesi)
   */
  function compute(monthlyCents, years, annualPct) {
    const r = annualPct / 100;
    const monthlyRate = r / 12;
    let balance = 0;
    const out = [];
    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) {
        balance = Math.round(balance * (1 + monthlyRate) + monthlyCents);
      }
      out.push({ year: y, balance_cents: balance });
    }
    return out;
  }

  /* Katkı toplamı (para yatırılan tutar) */
  function contributed(monthlyCents, years) {
    return monthlyCents * 12 * years;
  }

  return { compute, contributed };
})();
