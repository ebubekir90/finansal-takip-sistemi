/* app.js — Ana denetleyici: sekmeler, içe aktarma, işlemler, paneller */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  let currentSubs = [];   // algılanan abonelikler (önbellek)

  /* ---------- Yardımcılar ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
  function needTag(need) {
    const map = { need: ["Gereksinim", "need"], want: ["Haz", "want"], income: ["Gelir", "income"] };
    const [label, cls] = map[need] || ["Belirsiz", "uncat"];
    return `<span class="tag ${cls}">${label}</span>`;
  }
  function amountHtml(cents) {
    return cents >= 0
      ? `<span class="amount pos">${esc(Ledger.formatMoney(cents))}</span>`
      : `<span class="amount neg">${esc(Ledger.formatMoney(cents))}</span>`;
  }
  function monthKey(date) { return (date || "").slice(0, 7); }

  /* ---------- Doğrulama rozeti ---------- */
  function updateVerify() {
    const txns = Ledger.getAll();
    const res = Verify.run(txns);
    const badge = $("verifyBadge");
    badge.classList.remove("ok", "fail");
    if (!txns.length) {
      badge.classList.add("ok");
      $("verifyIcon").textContent = "✓";
      $("verifyText").textContent = "Boş defter — doğru";
      return res;
    }
    if (res.ok) {
      badge.classList.add("ok");
      $("verifyIcon").textContent = "✓";
      $("verifyText").textContent = "Doğrulandı · " + txns.length + " işlem · #" + res.fingerprint.slice(0, 6);
    } else {
      badge.classList.add("fail");
      $("verifyIcon").textContent = "✕";
      $("verifyText").textContent = "Doğrulama hatası: " + res.issues.join("; ");
    }
    return res;
  }

  /* ---------- Sekme yönetimi ---------- */
  function initTabs() {
    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        $("tab-" + tab.dataset.tab).classList.add("active");
        if (tab.dataset.tab === "dashboard") renderDashboard();
        if (tab.dataset.tab === "subscriptions") renderSubscriptions();
        if (tab.dataset.tab === "forecast") renderForecast();
      });
    });
  }

  /* ---------- Gösterge Paneli ---------- */
  function renderDashboard() {
    const txns = Ledger.getAll();
    let income = 0, need = 0, want = 0, otherExp = 0;
    const catMap = {};
    txns.forEach(t => {
      if (t.amount_cents > 0) income += t.amount_cents;
      else if (t.need === "need") need += t.amount_cents;
      else if (t.need === "want") want += t.amount_cents;
      else otherExp += t.amount_cents;

      if (t.amount_cents < 0) {
        const c = t.category || "Kategorisiz";
        catMap[c] = (catMap[c] || 0) + Math.abs(t.amount_cents);
      }
    });

    $("sumIncome").textContent = Ledger.formatMoney(income);
    $("sumNeed").textContent = Ledger.formatMoney(need);
    $("sumWant").textContent = Ledger.formatMoney(want);
    $("sumSaving").textContent = Ledger.formatMoney(income + need + want + otherExp);

    currentSubs = Subs.detect(Ledger.getAll());
    const res = Subs.stats(currentSubs);
    $("subMonthly").textContent = Ledger.formatMoney(res.monthly);
    $("subYearly").textContent = Ledger.formatMoney(res.yearly);
    $("subCancelSavings").textContent = Ledger.formatMoney(res.cancelSavings);

    // Donut: kategoriye göre harcama
    const donutData = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a]).map((c, i) => ({
      label: c, value: catMap[c], color: Charts.PALETTE[i % Charts.PALETTE.length]
    }));
    Charts.drawDonut($("chartDonut"), donutData);
    const totalD = donutData.reduce((s, x) => s + x.value, 0);
    const legend = donutData.map(d => {
      const pct = totalD ? Math.round(d.value / totalD * 100) : 0;
      return `<span><span class="swatch" style="background:${d.color}"></span>${esc(d.label)} · ${pct}%</span>`;
    }).join("");
    $("donutLegend").innerHTML = legend || "Henüz harcama yok.";

    // Aylık gereksinim vs haz (bar)
    const monthly = {};
    txns.forEach(t => {
      const mk = monthKey(t.date);
      if (!monthly[mk]) monthly[mk] = { need: 0, want: 0 };
      if (t.amount_cents < 0 && t.need === "need") monthly[mk].need += Math.abs(t.amount_cents);
      if (t.amount_cents < 0 && t.need === "want") monthly[mk].want += Math.abs(t.amount_cents);
    });
    const months = Object.keys(monthly).sort();
    Charts.drawGroupedBar($("chartBar"), months, [
      { name: "Gereksinim", values: months.map(m => monthly[m].need), color: "#d97706" },
      { name: "Haz", values: months.map(m => monthly[m].want), color: "#db2777" }
    ]);

    // Kümülatif bakiye (line)
    const cum = {};
    let running = 0;
    txns.forEach(t => {
      running += t.amount_cents;
      cum[monthKey(t.date)] = running;
    });
    const cumMonths = Object.keys(cum).sort();
    Charts.drawLine($("chartLine"), cumMonths, cumMonths.map(m => cum[m]), "#3b6fe0");

    $("noDataNote").textContent = txns.length ? "" :
      "Henüz işlem yok. 'İçe Aktar' sekmesinden CSV/OFX dosyanı yükle veya 'İşlemler'den elle ekle.";
  }

  /* ---------- İşlemler tablosu ---------- */
  function renderTransactions() {
    const q = ($("txSearch").value || "").toLowerCase();
    const filter = $("txFilter").value;
    const txns = Ledger.getAll().filter(t => {
      if (filter === "income" && t.amount_cents <= 0) return false;
      if (filter === "need" && t.need !== "need") return false;
      if (filter === "want" && t.need !== "want") return false;
      if (filter === "uncategorized" && (t.need === "income" || t.need === "need" || t.need === "want")) return false;
      if (q && !String(t.description).toLowerCase().includes(q) && !String(t.category || "").toLowerCase().includes(q)) return false;
      return true;
    }).slice().reverse();

    const body = $("txBody");
    if (!txns.length) {
      body.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">İşlem yok</td></tr>`;
    } else {
      body.innerHTML = txns.map(t => `
        <tr>
          <td>${esc(t.date)}</td>
          <td title="${esc(t.description)}">${esc(t.description.length > 40 ? t.description.slice(0, 40) + "…" : t.description)}</td>
          <td>${esc(t.category || "—")}</td>
          <td>${needTag(t.need)}</td>
          <td class="num">${amountHtml(t.amount_cents)}</td>
          <td><button class="icon-btn" data-del="${t.id}" title="Sil">🗑</button></td>
        </tr>`).join("");
    }
    $("txCount").textContent = txns.length;
  }

  /* ---------- Kategoriler / Kurallar ---------- */
  function renderRules() {
    const rules = Categorize.loadRules();
    $("ruleBody").innerHTML = rules.map((r, i) => `
      <tr>
        <td>${esc(r.pattern)}</td>
        <td>${esc(r.category)}</td>
        <td>${needTag(r.need)}</td>
        <td><button class="icon-btn" data-delrule="${i}" title="Sil">🗑</button></td>
      </tr>`).join("");
  }

  /* ---------- Abonelikler ---------- */
  function renderSubscriptions() {
    currentSubs = Subs.detect(Ledger.getAll());
    const list = $("subList");
    if (!currentSubs.length) {
      list.innerHTML = "";
      $("subNote").textContent = "Henüz tekrarlayan ödeme algılanmadı. En az iki farklı ayda görünen aynı harcama abonelik sayılır.";
      return;
    }
    $("subNote").textContent = "";
    list.innerHTML = currentSubs.map(s => {
      const dec = Subs.getDecision(s.key);
      return `
        <div class="sub-card">
          <div class="grow">
            <h4>${esc(s.name)}</h4>
            <div class="meta">${s.count} işlem · ${s.months} farklı ay · son: ${esc(s.last_date)}</div>
          </div>
          <div class="price">${esc(Ledger.formatMoney(s.monthly_cents))}<span class="muted small">/ay</span></div>
          <div class="price">${esc(Ledger.formatMoney(s.yearly_cents))}<span class="muted small">/yıl</span></div>
          <div class="keep-cancel">
            <button data-sub="${s.key}" data-dec="keep" class="${dec === "keep" ? "keep-on" : ""}">Kullan</button>
            <button data-sub="${s.key}" data-dec="cancel" class="${dec === "cancel" ? "cancel-on" : ""}">İptal Et</button>
          </div>
        </div>`;
    }).join("");
  }

  /* ---------- Öngörü ---------- */
  function renderForecast() {
    const pct = parseFloat($("fcReturn").value) || 0;
    const years = parseInt($("fcYears").value, 10) || 10;
    const wantPct = parseFloat($("fcWantPct").value) || 0;

    const stats = Subs.stats(currentSubs);
    const txns = Ledger.getAll();
    let wants = 0;
    txns.forEach(t => { if (t.amount_cents < 0 && t.need === "want") wants += Math.abs(t.amount_cents); });
    const months = new Set(txns.map(t => monthKey(t.date))).size || 1;
    const cancelMonthly = Math.round(stats.cancelSavings / 12);
    const wantMonthly = Math.round((wants / months) * wantPct / 100);
    const investMonthly = cancelMonthly + wantMonthly;

    const data = Forecast.compute(investMonthly, years, pct);
    Charts.drawLine($("chartForecast"),
      data.map(d => "Y" + d.year),
      data.map(d => d.balance_cents),
      "#0891b2");

    const last = data[data.length - 1];
    const contributed = Forecast.contributed(investMonthly, years);
    $("forecastSummary").innerHTML = `
      <div>Aylık yatırım: <strong>${esc(Ledger.formatMoney(investMonthly))}</strong>
        <span class="muted small">(iptal: ${esc(Ledger.formatMoney(cancelMonthly))} + haz: ${esc(Ledger.formatMoney(wantMonthly))})</span>
      </div>
      <div>Yatırılan toplam: <strong>${esc(Ledger.formatMoney(contributed))}</strong></div>
      <div>${years} yıl sonra tahmini değer: <div class="big">${esc(Ledger.formatMoney(last.balance_cents))}</div></div>
      <p class="muted small">Yalnızca bir projeksiyon; getiri vaadi değildir.</p>`;
  }

  /* ---------- İçe Aktarma ---------- */
  function showImportResult(html) {
    $("importResult").innerHTML = html;
  }

  function importText(text, filename) {
    const res = Parser.parse(text, filename);
    if (!res.transactions.length) {
      showImportResult(`<div class="err">İşlem bulunamadı. ${esc(res.errors.join(" "))}</div>`);
      return;
    }
    // her işlemi kategorize et
    const classified = res.transactions.map(t => {
      const c = Categorize.classify(t.description, t.amount_cents, "");
      return Object.assign({}, t, { category: c.category, need: c.need });
    });
    const out = Ledger.addTransactions(classified);
    const warn = res.errors.length ? `<p class="muted small">${esc(res.errors.join(" · "))}</p>` : "";
    showImportResult(`<div class="ok">
      <strong>${out.added}</strong> işlem eklendi${out.skipped ? `, <strong>${out.skipped}</strong> mükerrer atlandı` : ""}.
      ${warn}
      <button class="btn" onclick="App.go('transactions')">İşlemleri Gör</button>
    </div>`);
    refreshAll();
  }

  function initImport() {
    const drop = $("dropZone");
    const fileInput = $("fileInput");
    drop.addEventListener("click", () => fileInput.click());
    drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("dragover"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("dragover"));
    drop.addEventListener("drop", e => {
      e.preventDefault();
      drop.classList.remove("dragover");
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener("change", () => { if (fileInput.files.length) handleFiles(fileInput.files); fileInput.value = ""; });

    $("btnParsePaste").addEventListener("click", () => {
      const text = $("csvPaste").value;
      if (!text.trim()) { showImportResult(`<div class="err">Yapıştırılacak metin boş.</div>`); return; }
      importText(text, "paste.csv");
    });
  }

  function handleFiles(files) {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => importText(String(reader.result || ""), file.name);
      reader.onerror = () => showImportResult(`<div class="err">${esc(file.name)} okunamadı.</div>`);
      reader.readAsText(file);
    });
  }

  /* ---------- Yedekleme / Geri Yükleme ---------- */
  function showBackupResult(html) { $("backupResult").innerHTML = html; }

  function exportBackup() {
    const data = {
      app: "finansal-takip",
      version: 1,
      exportedAt: new Date().toISOString(),
      ledger: Ledger.load(),
      rules: Categorize.loadRules(),
      subDecisions: Subs.loadDecisions()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = "finansal-takip-yedek-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showBackupResult(`<div class="ok">Yedek indirildi: <strong>${esc(a.download)}</strong> (${data.ledger.length} işlem).</div>`);
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || data.app !== "finansal-takip" || !Array.isArray(data.ledger)) {
          showBackupResult(`<div class="err">Geçersiz yedek dosyası: uygulama formatı tanınmadı.</div>`);
          return;
        }
        if (!confirm("Yedek, mevcut tüm verilerin yerine geçecek. Devam etmek istiyor musun?")) {
          showBackupResult(`<div class="muted">Geri yükleme iptal edildi.</div>`);
          return;
        }
        Ledger.save(data.ledger);
        if (Array.isArray(data.rules)) Categorize.saveRules(data.rules);
        if (data.subDecisions && typeof data.subDecisions === "object") Subs.saveDecisions(data.subDecisions);
        refreshAll();
        renderRules();
        renderSubscriptions();
        renderForecast();
        showBackupResult(`<div class="ok"><strong>${data.ledger.length}</strong> işlem ve kurallar/kararlar geri yüklendi.</div>`);
      } catch (e) {
        showBackupResult(`<div class="err">Dosya okunamadı: ${esc(e.message)}</div>`);
      }
    };
    reader.onerror = () => showBackupResult(`<div class="err">Dosya okunamadı.</div>`);
    reader.readAsText(file);
  }

  function initBackup() {
    $("btnExport").addEventListener("click", exportBackup);
    $("btnImportBackup").addEventListener("click", () => $("backupInput").click());
    $("backupInput").addEventListener("change", () => {
      if ($("backupInput").files.length) importBackup($("backupInput").files[0]);
      $("backupInput").value = "";
    });
  }

  /* ---------- Elle işlem modalı ---------- */
  let editId = null;
  function openModal(id) {
    editId = id;
    $("modalTitle").textContent = id ? "İşlemi Düzenle" : "Elle İşlem";
    const t = id ? Ledger.load().find(x => x.id === id) : null;
    $("mDate").value = t ? t.date : new Date().toISOString().slice(0, 10);
    $("mDesc").value = t ? t.description : "";
    $("mAmount").value = t ? (t.amount_cents / 100).toFixed(2) : "";
    $("mCategory").value = t ? (t.category || "") : "";
    $("modal").classList.remove("hidden");
  }
  function closeModal() { $("modal").classList.add("hidden"); editId = null; }

  function initModal() {
    $("btnAddManual").addEventListener("click", () => openModal(null));
    $("mCancel").addEventListener("click", closeModal);
    $("modal").addEventListener("click", e => { if (e.target === $("modal")) closeModal(); });
    $("txForm").addEventListener("submit", e => {
      e.preventDefault();
      const cents = Ledger.toCentsInput($("mAmount").value);
      if (cents === null) { alert("Geçerli bir tutar gir."); return; }
      const desc = $("mDesc").value.trim();
      if (!desc) { alert("Açıklama gir."); return; }
      const c = Categorize.classify(desc, cents, $("mCategory").value.trim());
      if (editId) {
        Ledger.update(editId, {
          date: $("mDate").value, description: desc, amount_cents: cents,
          category: c.category, need: c.need
        });
      } else {
        Ledger.addManual({
          date: $("mDate").value, description: desc, amount_cents: cents,
          category: c.category, need: c.need
        });
      }
      closeModal();
      refreshAll();
    });
  }

  /* ---------- Olaylar ---------- */
  function initEvents() {
    // işlem tablosu
    $("txBody").addEventListener("click", e => {
      const btn = e.target.closest("[data-del]");
      if (btn) { Ledger.remove(btn.dataset.del); refreshAll(); }
    });
    $("txSearch").addEventListener("input", renderTransactions);
    $("txFilter").addEventListener("change", renderTransactions);

    // kurallar
    $("ruleBody").addEventListener("click", e => {
      const btn = e.target.closest("[data-delrule]");
      if (btn) {
        const rules = Categorize.loadRules();
        rules.splice(parseInt(btn.dataset.delrule, 10), 1);
        Categorize.saveRules(rules);
        renderRules();
      }
    });
    $("btnAddRule").addEventListener("click", () => {
      const p = $("rulePattern").value.trim();
      const c = $("ruleCategory").value.trim();
      if (!p || !c) { alert("Desen ve kategori gir."); return; }
      const rules = Categorize.loadRules();
      rules.push({ pattern: p, category: c, need: $("ruleNeed").value });
      Categorize.saveRules(rules);
      $("rulePattern").value = ""; $("ruleCategory").value = "";
      renderRules();
    });
    $("btnReclassify").addEventListener("click", () => {
      Categorize.reclassifyAll();
      refreshAll();
    });

    // abonelik kararları
    $("subList").addEventListener("click", e => {
      const btn = e.target.closest("[data-sub]");
      if (!btn) return;
      Subs.setDecision(btn.dataset.sub, btn.dataset.dec);
      renderSubscriptions();
      renderDashboard();
      updateVerify();
    });

    // öngörü
    ["fcReturn", "fcYears", "fcWantPct"].forEach(id => {
      $(id).addEventListener("input", renderForecast);
    });

    // temizle
    $("btnClearAll").addEventListener("click", () => {
      if (!Ledger.getAll().length) return;
      if (confirm("Tüm işlemler silinecek. Emin misin?")) {
        Ledger.clear();
        refreshAll();
      }
    });
  }

  function refreshAll() {
    renderDashboard();
    renderTransactions();
    updateVerify();
  }

  function backfillUnclassified() {
    let changed = false;
    Ledger.load().forEach(t => {
      if (!t.need) {
        const c = Categorize.classify(t.description, t.amount_cents, "");
        t.category = c.category; t.need = c.need;
        changed = true;
      }
    });
    if (changed) Ledger.save(Ledger.load());
  }

  function init() {
    initTabs();
    initImport();
    initBackup();
    initModal();
    initEvents();
    backfillUnclassified();
    Categorize.reclassifyAll();
    refreshAll();
    renderRules();
    renderSubscriptions();
    renderForecast();
  }

  document.addEventListener("DOMContentLoaded", init);

  /* dışarıya açılan sekme geçişi (import sonucundaki buton için) */
  window.App = {
    go: (tab) => {
      const btn = document.querySelector(`.tab[data-tab="${tab}"]`);
      if (btn) btn.click();
    }
  };
})();


