/* charts.js — Kendi kendine yeten canvas grafik çizici (harici kütüphane yok, çevrimdışı çalışır) */
const Charts = (function () {
  const PALETTE = ["#3b6fe0", "#d97706", "#db2777", "#0891b2", "#7c3aed", "#16a34a",
    "#ea580c", "#0d9488", "#9333ea", "#ca8a04", "#dc2626", "#2563eb", "#65a30d", "#c026d3"];

  function setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(rect.width, 100);
    const h = parseInt(canvas.parentElement.style.height || "240", 10) || 240;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function drawDonut(canvas, data) {
    const { ctx, w, h } = setup(canvas);
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total <= 0) { drawEmpty(ctx, w, h, "Veri yok"); return; }
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) / 2 - 16;
    const inner = R * 0.62;
    let angle = -Math.PI / 2;
    data.forEach((d, i) => {
      const frac = d.value / total;
      const end = angle + frac * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, angle, end);
      ctx.arc(cx, cy, inner, end, angle, true);
      ctx.closePath();
      ctx.fillStyle = d.color || PALETTE[i % PALETTE.length];
      ctx.fill();
      angle = end;
    });
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.99, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  }

  function drawGroupedBar(canvas, labels, series) {
    const { ctx, w, h } = setup(canvas);
    if (!labels.length) { drawEmpty(ctx, w, h, "Veri yok"); return; }
    const pad = { top: 16, right: 16, bottom: 36, left: 52 };
    const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
    let max = 0;
    series.forEach(s => s.values.forEach(v => { if (Math.abs(v) > max) max = Math.abs(v); }));
    if (max === 0) max = 1;
    max = niceMax(max);

    drawAxis(ctx, pad, w, h, max);
    const n = labels.length;
    const groupW = cw / n;
    const slot = groupW / series.length;
    const barW = Math.max(slot * 0.6, 4);
    labels.forEach((lab, i) => {
      series.forEach((s, si) => {
        const v = s.values[i];
        const hgt = (Math.abs(v) / max) * ch;
        const x = pad.left + groupW * i + si * slot + (slot - barW) / 2;
        const y = v >= 0 ? pad.top + ch - hgt : pad.top + ch;
        ctx.fillStyle = s.color;
        ctx.fillRect(x, y, barW, v >= 0 ? hgt : Math.abs(hgt));
      });
      ctx.fillStyle = "#6b7485"; ctx.font = "11px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(lab, pad.left + groupW * i + groupW / 2, h - 10);
    });
    drawLegend(ctx, series, w, pad.top);
  }

  function drawLine(canvas, labels, values, color) {
    const { ctx, w, h } = setup(canvas);
    if (!labels.length) { drawEmpty(ctx, w, h, "Veri yok"); return; }
    const pad = { top: 16, right: 16, bottom: 36, left: 52 };
    const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
    let max = 0, min = 0;
    values.forEach(v => { if (v > max) max = v; if (v < min) min = v; });
    if (max === min) max = min + 1;
    const top = niceMax(max), bot = niceMax(Math.abs(min)) * (min < 0 ? -1 : 0);
    const range = (top - bot) || 1;

    // grid + y labels
    ctx.strokeStyle = "#eef0f5"; ctx.fillStyle = "#9aa3b2"; ctx.font = "10px sans-serif";
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (i / 4) * ch;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
      const val = top - (i / 4) * range;
      ctx.textAlign = "right"; ctx.fillText(fmtShort(val), pad.left - 6, y + 3);
    }
    // area + line
    const stepX = labels.length > 1 ? cw / (labels.length - 1) : cw;
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = pad.left + stepX * i;
      const y = pad.top + ch - ((v - bot) / range) * ch;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color || "#3b6fe0"; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.stroke();
    // x labels (sample to avoid crowding)
    const every = Math.ceil(labels.length / 8);
    ctx.fillStyle = "#6b7485"; ctx.textAlign = "center"; ctx.font = "10px sans-serif";
    labels.forEach((lab, i) => {
      if (i % every !== 0 && i !== labels.length - 1) return;
      ctx.fillText(lab, pad.left + stepX * i, h - 10);
    });
  }

  function drawAxis(ctx, pad, w, h, max) {
    ctx.strokeStyle = "#eef0f5"; ctx.fillStyle = "#9aa3b2"; ctx.font = "10px sans-serif";
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (i / 4) * (h - pad.top - pad.bottom);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
      const val = max - (i / 4) * max;
      ctx.textAlign = "right"; ctx.fillText(fmtShort(val), pad.left - 6, y + 3);
    }
  }

  function drawLegend(ctx, series, w, top) {
    let x = w - 16;
    for (let i = series.length - 1; i >= 0; i--) {
      const s = series[i];
      const label = s.name;
      const tw = ctx.measureText(label).width + 18;
      x -= tw;
      ctx.fillStyle = s.color; ctx.fillRect(x, top - 4, 10, 10);
      ctx.fillStyle = "#6b7485"; ctx.font = "11px sans-serif"; ctx.textAlign = "left";
      ctx.fillText(label, x + 14, top + 5);
    }
  }

  function drawEmpty(ctx, w, h, msg) {
    ctx.fillStyle = "#b6bdca"; ctx.font = "14px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(msg, w / 2, h / 2);
  }

  function niceMax(v) {
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / mag;
    const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return nice * mag;
  }

  function fmtShort(v) {
    const abs = Math.abs(v);
    if (abs >= 1e9) return (v / 1e9).toFixed(1) + "B";
    if (abs >= 1e6) return (v / 1e6).toFixed(1) + "M";
    if (abs >= 1e3) return (v / 1e3).toFixed(1) + "K";
    return String(Math.round(v));
  }

  return { drawDonut, drawGroupedBar, drawLine, PALETTE };
})();

