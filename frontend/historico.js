(function () {
  const input       = document.querySelector(".search__input");
  const btn         = document.querySelector(".search__btn");
  const statusEl    = document.getElementById("history-status");
  const panelEl     = document.getElementById("history");
  const titleEl     = document.getElementById("history-title");
  const metaEl      = document.getElementById("history-meta");
  const rangeSelect = document.getElementById("range-select");
  const chartEl     = document.getElementById("price-chart");

  let currentTicker = null;
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

  function formatPrice(n) {
    if (n == null) return "—";
    return "$" + Number(n).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function load() {
    const ticker = (currentTicker || input.value.trim().toUpperCase());
    if (!ticker) { setStatus("Escribe un ticker.", "error"); return; }
    currentTicker = ticker;

    const days = rangeSelect.value;
    setStatus("Cargando histórico de " + ticker + "…");
    btn.disabled = true;
    try {
      const resp = await fetch(`/api/history/${encodeURIComponent(ticker)}?days=${days}`);
      if (!resp.ok) {
        let detail = "No se pudo cargar el histórico.";
        try { const e = await resp.json(); if (e.detail) detail = e.detail; } catch (_) {}
        setStatus(detail, "error");
        hide(panelEl);
        return;
      }
      currentData = await resp.json();
      if (!currentData.length) { setStatus("Sin datos para " + ticker + ".", "error"); hide(panelEl); return; }
      setStatus("");
      renderPanel();
    } catch (_) {
      setStatus("No se pudo conectar con el servidor.", "error");
    } finally {
      btn.disabled = false;
    }
  }

  function renderPanel() {
    titleEl.textContent = currentTicker;
    renderMeta();
    renderChart();
    show(panelEl);
  }

  // Precio actual (más reciente) + variación % sobre el rango.
  function renderMeta() {
    const rows = currentData.slice().reverse(); // cronológico
    const first = rows[0].price;
    const last = rows[rows.length - 1].price;
    const change = first ? ((last - first) / first) * 100 : 0;
    const cls = change >= 0 ? "up" : "down";
    const sign = change >= 0 ? "+" : "";
    metaEl.innerHTML =
      `${esc(formatPrice(last))} ` +
      `<span class="${cls}">${sign}${change.toFixed(2)}%</span>`;
  }

  // Gráfico de línea SVG: precio (y) vs tiempo (x), del más viejo al más nuevo.
  function renderChart() {
    const rows = currentData.slice().reverse();
    const prices = rows.map((r) => r.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min || 1;

    const W = 640, H = 280;
    const padL = 56, padR = 16, padT = 16, padB = 28;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const n = rows.length;

    const x = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const y = (p) => padT + (1 - (p - min) / span) * plotH;

    const pts = rows.map((r, i) => `${x(i).toFixed(1)},${y(r.price).toFixed(1)}`);
    const yBottom = (padT + plotH).toFixed(1);
    const areaPath =
      `M ${x(0).toFixed(1)},${yBottom} ` +
      `L ${pts.join(" L ")} ` +
      `L ${x(n - 1).toFixed(1)},${yBottom} Z`;

    const firstDate = rows[0].date;
    const lastDate = rows[n - 1].date;

    let svg = "";
    svg += `<path class="area" d="${areaPath}"></path>`;
    svg += `<polyline class="line" points="${pts.join(" ")}"></polyline>`;
    // Etiquetas de precio (eje Y): max arriba, min abajo.
    svg += `<text class="axis-label" x="8" y="${(y(max) + 4).toFixed(1)}">${esc(formatPrice(max))}</text>`;
    svg += `<text class="axis-label" x="8" y="${(y(min) + 4).toFixed(1)}">${esc(formatPrice(min))}</text>`;
    // Etiquetas de fecha (eje X): primera y última.
    svg += `<text class="axis-label" x="${padL}" y="${H - 8}" text-anchor="start">${esc(firstDate)}</text>`;
    svg += `<text class="axis-label" x="${W - padR}" y="${H - 8}" text-anchor="end">${esc(lastDate)}</text>`;
    chartEl.innerHTML = svg;
  }

  function doLoad() {
    currentTicker = input.value.trim().toUpperCase();
    load();
  }

  btn.addEventListener("click", doLoad);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); doLoad(); }
  });
  rangeSelect.addEventListener("change", () => { if (currentTicker) load(); });
})();
