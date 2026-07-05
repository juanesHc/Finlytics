// ============================================================
//  Finlytics — frontend. Llama a la API y pinta el resultado.
//  La API se sirve en el mismo origen, así que usamos rutas
//  relativas ("/api/...") -> sin problemas de CORS.
// ============================================================

// --- Referencias a elementos del DOM ---
const form      = document.getElementById("search-form");
const input     = document.getElementById("ticker-input");
const btn       = document.getElementById("search-btn");
const loadingEl = document.getElementById("loading");
const errorEl   = document.getElementById("error");
const resultEl  = document.getElementById("result");

// --- Helpers para mostrar/ocultar estados ---
function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function setLoading(on) {
  btn.disabled = on;
  if (on) {
    hide(errorEl);
    hide(resultEl);
    show(loadingEl);
  } else {
    hide(loadingEl);
  }
}

function showError(mensaje) {
  errorEl.textContent = mensaje;
  show(errorEl);
}

// --- Formateadores ---
// Market cap gigante -> "4.53 B" / "12.4 MM" legible.
function formatMarketCap(n) {
  if (n == null) return "—";
  if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + " B";   // billones (10^12)
  if (n >= 1e9)  return "$" + (n / 1e9).toFixed(2) + " MM";   // miles de millones
  if (n >= 1e6)  return "$" + (n / 1e6).toFixed(2) + " M";
  return "$" + n.toLocaleString("es");
}

function formatPrecio(n) {
  return "$" + Number(n).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Rellena una <ul> con un array de strings.
function fillList(ul, items) {
  ul.innerHTML = "";
  (items || []).forEach((texto) => {
    const li = document.createElement("li");
    li.textContent = texto;
    ul.appendChild(li);
  });
}

// --- Pinta el objeto Analisis que devuelve la API ---
function render(data) {
  const { fundamentales: f, veredicto: v } = data;

  // Cabecera
  document.getElementById("r-ticker").textContent = data.ticker;
  document.getElementById("r-nombre").textContent = f.nombre;
  document.getElementById("r-precio").textContent = formatPrecio(data.precio);

  // Badge de caché (verde = cacheado / azul = recién generado)
  const cachedEl = document.getElementById("r-cached");
  if (data.cached) {
    cachedEl.textContent = "cache";
    cachedEl.className = "badge badge--cache";
  } else {
    cachedEl.textContent = "nuevo";
    cachedEl.className = "badge badge--fresh";
  }

  // Fundamentales
  document.getElementById("f-sector").textContent    = f.sector || "—";
  document.getElementById("f-industria").textContent = f.industria || "—";
  document.getElementById("f-mcap").textContent      = formatMarketCap(f.market_cap);
  document.getElementById("f-beta").textContent      = f.beta != null ? f.beta : "—";

  // Veredicto
  document.getElementById("v-veredicto").textContent = v.veredicto;
  fillList(document.getElementById("v-fuertes"), v.puntos_fuertes);
  fillList(document.getElementById("v-riesgos"), v.riesgos);
  document.getElementById("v-resumen").textContent = v.resumen;

  // Disclaimer
  document.getElementById("r-disclaimer").textContent = data.disclaimer;

  show(resultEl);
}

// --- Llamada a la API ---
async function analizar(ticker) {
  setLoading(true);
  try {
    const resp = await fetch(`/api/analysis/${encodeURIComponent(ticker)}`);

    if (!resp.ok) {
      // La API manda el motivo en {"detail": "..."} (404, 429...).
      let detalle = "Algo salió mal. Inténtalo de nuevo.";
      try {
        const err = await resp.json();
        if (err.detail) detalle = err.detail;
      } catch (_) { /* respuesta sin JSON */ }

      if (resp.status === 429) {
        detalle = "🚫 " + detalle + " (límite de 5 análisis por día).";
      }
      showError(detalle);
      return;
    }

    const data = await resp.json();
    render(data);
  } catch (_) {
    // Falla de red / servidor caído.
    showError("No se pudo conectar con el servidor. ¿Está la API encendida?");
  } finally {
    setLoading(false);
  }
}

// --- Envío del formulario ---
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const ticker = input.value.trim().toUpperCase();
  if (ticker) analizar(ticker);
});
