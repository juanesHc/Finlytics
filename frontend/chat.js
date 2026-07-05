// ============================================================
//  Finlytics — chat flotante con Haiku.
//  El historial vive aquí (frontend); el backend aplica su propia
//  cuota diaria y recorta a "memoria corta" (últimos mensajes).
// ============================================================

// IIFE: aísla las variables de este archivo para que NO choquen con las
// globales de script.js (ambos se cargan juntos en el home).
(function () {
const fab       = document.getElementById("chat-fab");
const panel     = document.getElementById("chat-panel");
const closeBtn  = document.getElementById("chat-close");
const form      = document.getElementById("chat-form");
const textInput = document.getElementById("chat-text");
const messages  = document.getElementById("chat-messages");

// Historial de la conversación: [{role: "user"|"assistant", content}]
const historial = [];
let saludado = false; // ¿ya mostramos el saludo inicial?

// --- Abrir / cerrar el panel ---
function abrirChat() {
  panel.classList.remove("hidden");
  fab.classList.add("chat-fab--open");
  if (!saludado) {
    // Saludo local (no llama a la API -> 0 tokens).
    pintarMensaje(
      "assistant",
      "¡Hola! Soy el asistente de Finlytics. Pregúntame sobre acciones, " +
      "conceptos de inversión o finanzas. (Esto no es asesoría financiera.)"
    );
    saludado = true;
  }
  textInput.focus();
}

function cerrarChat() {
  panel.classList.add("hidden");
  fab.classList.remove("chat-fab--open");
}

fab.addEventListener("click", () => {
  panel.classList.contains("hidden") ? abrirChat() : cerrarChat();
});
closeBtn.addEventListener("click", cerrarChat);

// --- Pintar un mensaje en el hilo ---
function pintarMensaje(role, texto) {
  const div = document.createElement("div");
  div.className = "chat-msg " + (role === "user" ? "chat-msg--user" : "chat-msg--bot");
  div.textContent = texto;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

// Indicador de "escribiendo…" mientras esperamos a Haiku.
function pintarTyping() {
  const div = document.createElement("div");
  div.className = "chat-msg chat-msg--bot chat-typing";
  div.innerHTML = "<span></span><span></span><span></span>";
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

// --- Enviar mensaje ---
async function enviar(texto) {
  // 1. Pintar y registrar el mensaje del usuario.
  pintarMensaje("user", texto);
  historial.push({ role: "user", content: texto });

  const typing = pintarTyping();
  textInput.disabled = true;

  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensajes: historial }),
    });

    typing.remove();

    if (!resp.ok) {
      let detalle = "Ups, algo salió mal. Inténtalo de nuevo.";
      try {
        const err = await resp.json();
        if (err.detail) detalle = err.detail;
      } catch (_) {}
      pintarMensaje("assistant", "⚠ " + detalle);
      return;
    }

    const data = await resp.json();
    pintarMensaje("assistant", data.respuesta);
    historial.push({ role: "assistant", content: data.respuesta });
  } catch (_) {
    typing.remove();
    pintarMensaje("assistant", "⚠ No pude conectar con el servidor.");
  } finally {
    textInput.disabled = false;
    textInput.focus();
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const texto = textInput.value.trim();
  if (!texto) return;
  textInput.value = "";
  enviar(texto);
});
})();
