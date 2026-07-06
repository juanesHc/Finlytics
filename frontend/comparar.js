(function () {
  const inputs   = document.querySelectorAll(".compare-inputs .search__input");
  const input1   = inputs[0];
  const input2   = inputs[1];
  const btn      = document.querySelector(".search__btn");
  const statusEl = document.getElementById("compare-status");
  const resultEl = document.getElementById("compare-result");

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

  function formatPrice(n) {
    if (n == null) return "—";
    return "$" + Number(n).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function fetchProfile(ticker) {
    const resp = await fetch(`/api/profile/${encodeURIComponent(ticker)}`);
    if (!resp.ok) {
      let detail = `No se encontró '${ticker}'.`;
      try { const e = await resp.json(); if (e.detail) detail = e.detail; } catch (_) {}
      throw new Error(detail);
    }
    return resp.json();
  }

  const ROWS = [
    ["Empresa",    (f) => f.nombre || "—"],
    ["Precio",     (f) => formatPrice(f.precio)],
    ["Market cap", (f) => formatMoney(f.market_cap)],
    ["Beta",       (f) => (f.beta != null ? f.beta : "—")],
    ["Sector",     (f) => f.sector || "—"],
    ["Industria",  (f) => f.industria || "—"],
  ];

  function renderTable(a, b) {
    let html =
      `<thead><tr><th>Métrica</th><th>${esc(a.ticker)}</th><th>${esc(b.ticker)}</th></tr></thead><tbody>`;
    ROWS.forEach(([label, fn]) => {
      html += `<tr><td>${label}</td><td>${esc(fn(a))}</td><td>${esc(fn(b))}</td></tr>`;
    });
    html += "</tbody>";
    resultEl.innerHTML = html;
    show(resultEl);
  }

  async function compare() {
    const t1 = input1.value.trim().toUpperCase();
    const t2 = input2.value.trim().toUpperCase();
    if (!t1 || !t2) { setStatus("Escribe los dos tickers.", "error"); return; }

    setStatus("Cargando " + t1 + " y " + t2 + "…");
    hide(resultEl);
    btn.disabled = true;
    try {
      const [a, b] = await Promise.all([fetchProfile(t1), fetchProfile(t2)]);
      setStatus("");
      renderTable(a, b);
    } catch (e) {
      setStatus(e.message || "No se pudo comparar.", "error");
    } finally {
      btn.disabled = false;
    }
  }

  btn.addEventListener("click", compare);
  [input1, input2].forEach((inp) =>
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); compare(); }
    })
  );
})();
