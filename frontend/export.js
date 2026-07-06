(function () {
  const input       = document.querySelector(".search__input");
  const searchBtn   = document.querySelector(".search__btn");
  const statusEl    = document.getElementById("export-status");
  const resultsEl   = document.getElementById("search-results");
  const panelEl     = document.getElementById("financials");
  const titleEl     = document.getElementById("financials-title");
  const yearsSelect = document.getElementById("years-select");
  const downloadBtn = document.getElementById("download-csv");
  const tableEl     = document.getElementById("financials-table");
  const chartEl     = document.getElementById("revenue-chart");

  let currentSymbol = null;
  let currentName   = "";
  let currentData   = [];

  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }

  function setStatus(msg, kind) {
    statusEl.textContent = msg || "";
    statusEl.className = "export-status" + (kind ? " export-status--" + kind : "");
  }

  function esc(s) {
    const div = document.createElement("div");
    div.textContent = s == null ? "" : String(s);
    return div.innerHTML;
  }

  function formatMoney(n) {
    if (n == null || isNaN(n)) return "—";
    const abs = Math.abs(n);
    if (abs >= 1e12) return "$" + (n / 1e12).toFixed(2) + " B";
    if (abs >= 1e9)  return "$" + (n / 1e9).toFixed(2) + " MM";
    if (abs >= 1e6)  return "$" + (n / 1e6).toFixed(2) + " M";
    return "$" + Number(n).toLocaleString("es");
  }

  function yearOf(d) {
    return d.fiscalYear || (d.date || "").slice(0, 4);
  }

  async function search(query) {
    setStatus("Buscando “" + query + "”…");
    hide(panelEl);
    resultsEl.innerHTML = "";
    hide(resultsEl);
    try {
      const resp = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!resp.ok) { setStatus("Error al buscar. Inténtalo de nuevo.", "error"); return; }
      const items = await resp.json();
      if (!items.length) { setStatus("Sin resultados para “" + query + "”.", "error"); return; }
      setStatus("");
      renderResults(items);
    } catch (_) {
      setStatus("No se pudo conectar con el servidor. ¿Está la API encendida?", "error");
    }
  }

  function renderResults(items) {
    resultsEl.innerHTML = items.map((it) =>
      `<li class="search-results__item" data-symbol="${esc(it.symbol)}" data-name="${esc(it.name || it.symbol)}">
         <span class="sr-symbol">${esc(it.symbol)}</span>
         <span class="sr-name">${esc(it.name || "")}</span>
         <span class="sr-exch">${esc(it.exchange || "")}</span>
       </li>`
    ).join("");

    resultsEl.querySelectorAll(".search-results__item").forEach((li) => {
      li.addEventListener("click", () => {
        currentSymbol = li.dataset.symbol;
        currentName   = li.dataset.name;
        loadFinancials();
      });
    });
    show(resultsEl);
  }

  async function loadFinancials() {
    const years = yearsSelect.value;
    setStatus("Cargando estados de " + currentSymbol + "…");
    try {
      const resp = await fetch(
        `/api/financials/${encodeURIComponent(currentSymbol)}?years=${years}`
      );
      if (!resp.ok) {
        let detail = "No se pudieron cargar los estados financieros.";
        try { const e = await resp.json(); if (e.detail) detail = e.detail; } catch (_) {}
        setStatus(detail, "error");
        return;
      }
      currentData = await resp.json();
      if (!currentData.length) { setStatus("Sin datos para " + currentSymbol + ".", "error"); return; }
      setStatus("");
      hide(resultsEl);
      renderPanel();
    } catch (_) {
      setStatus("No se pudo conectar con el servidor.", "error");
    }
  }

  function renderPanel() {
    titleEl.textContent = `${currentName} (${currentSymbol}) — Income Statement`;
    renderTable();
    renderChart();
    show(panelEl);
  }

  const TABLE_ROWS = [
    ["Revenue", "revenue"],
    ["Cost of Revenue", "costOfRevenue"],
    ["Gross Profit", "grossProfit"],
    ["Operating Income", "operatingIncome"],
    ["Net Income", "netIncome"],
    ["EPS", "eps"],
  ];

  function renderTable() {
    const years = currentData.map(yearOf);
    let html = "<thead><tr><th>Métrica</th>";
    years.forEach((y) => { html += `<th>${esc(y)}</th>`; });
    html += "</tr></thead><tbody>";

    TABLE_ROWS.forEach(([label, key]) => {
      html += `<tr><td>${label}</td>`;
      currentData.forEach((d) => {
        const v = d[key];
        const cell = key === "eps" ? (v != null ? v : "—") : formatMoney(v);
        html += `<td>${esc(cell)}</td>`;
      });
      html += "</tr>";
    });

    html += "</tbody>";
    tableEl.innerHTML = html;
  }

  function renderChart() {
    const rows = currentData.slice().reverse();
    const values = rows.map((d) => d.revenue || 0);
    const max = Math.max(...values, 1);

    const W = 600, H = 240, pad = 34, gap = 16;
    const n = rows.length;
    const barW = (W - pad * 2 - gap * Math.max(n - 1, 0)) / n;

    let svg = "";
    rows.forEach((d, i) => {
      const val = d.revenue || 0;
      const barH = (val / max) * (H - pad * 2);
      const x = pad + i * (barW + gap);
      const y = H - pad - barH;
      const cx = x + barW / 2;
      svg +=
        `<rect class="bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" ` +
        `width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="3"></rect>` +
        `<text class="bar-value" x="${cx.toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle">${esc(formatMoney(val))}</text>` +
        `<text class="bar-label" x="${cx.toFixed(1)}" y="${H - pad + 16}" text-anchor="middle">${esc(yearOf(d))}</text>`;
    });
    chartEl.innerHTML = svg;
  }

  function toCsvField(v) {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function buildCsv() {
    const keys = Object.keys(currentData[0]);
    const lines = [keys.map(toCsvField).join(",")];
    currentData.forEach((d) => {
      lines.push(keys.map((k) => toCsvField(d[k])).join(","));
    });
    return lines.join("\r\n");
  }

  function downloadCsv() {
    if (!currentData.length) return;
    const csv = "﻿" + buildCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finlytics_${currentSymbol}_income.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus("Descargado finlytics_" + currentSymbol + "_income.csv ✓", "ok");
  }

  function doSearch() {
    const query = input.value.trim();
    if (query) search(query);
  }

  searchBtn.addEventListener("click", doSearch);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); doSearch(); }
  });
  yearsSelect.addEventListener("change", () => { if (currentSymbol) loadFinancials(); });
  downloadBtn.addEventListener("click", downloadCsv);
})();
