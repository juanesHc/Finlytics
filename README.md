# Finlytics 📈🤖

**Analista de acciones con IA — público, sin registro.**

Escribes un ticker (ej. `AAPL`) y Finlytics te devuelve precio, fundamentales
clave y **un veredicto en lenguaje natural generado por Claude** ("sólida pero
cara frente a su sector"). Todo el estado vive en la URL — no hay cuentas ni login.

> Estado del proyecto: **fase de diseño**. Este documento define el propósito,
> la arquitectura, el esquema de datos y las decisiones. Todavía no hay código.

---

## 1. Propósito

Democratizar el análisis fundamental: cualquiera pega un ticker y obtiene, en
segundos, lo que normalmente exige leer un balance y saber interpretarlo. La
gracia no es mostrar números (eso ya lo hacen mil webs) sino **traducirlos a una
opinión clara y accionable** usando un LLM.

**Principios de producto:**

- **Público y sin fricción** — sin registro, sin cookies de sesión, sin paywall.
- **Compartible** — cada análisis es una URL (`/analisis/AAPL`).
- **Honesto** — el veredicto siempre lleva disclaimer: *no es asesoría financiera*.

---

## 2. Arquitectura

Interfaz elegida: **API JSON + mini-frontend** (una página HTML que consume la API).

| Capa            | Tecnología          | Rol                                                    |
| --------------- | ------------------- | ------------------------------------------------------ |
| Backend / API   | **Python (FastAPI)**| orquesta FMP + Claude, sirve la API y la página        |
| IA              | **Claude API**      | genera el veredicto (con caché agresiva)               |
| Datos de mercado| **FMP** (Financial Modeling Prep) | precios, fundamentales, noticias         |
| Persistencia    | **PostgreSQL**      | caché de análisis, rate-limit, tickers populares       |
| Empaquetado     | **Docker Compose**  | servicios `web` (Python) + `db` (Postgres)             |

```
                    ┌──────────────┐
   navegador  ──►   │  mini-front  │  (HTML + fetch a la API)
                    └──────┬───────┘
                           │ GET /api/analysis/{ticker}
                    ┌──────▼───────┐        ┌──────────────┐
                    │   FastAPI    │───────►│  PostgreSQL  │  (caché + rate-limit)
                    │   (Python)   │◄───────│              │
                    └──┬────────┬──┘        └──────────────┘
                       │        │
              ┌────────▼──┐  ┌──▼─────────┐
              │   FMP     │  │  Claude    │  (solo si no hay caché fresca)
              │ (datos)   │  │  (veredicto)│
              └───────────┘  └────────────┘
```

---

## 3. Estrategia de mínimo consumo de tokens ⭐

El objetivo explícito del proyecto: **que Python + la API de Claude brillen,
pero gastando MUY pocos tokens.** Todo el diseño gira en torno a esto.

### 3.1 Caché primero (la idea central)

Claude solo trabaja **una vez por ticker** y su respuesta se guarda en Postgres:

```
GET /AAPL
   │
   ├─ ¿Análisis en Postgres con antigüedad < TTL?  ──SÍ──►  servir cacheado   (0 tokens)
   │
   └─NO─► FMP trae datos ─► Claude genera veredicto (1 llamada) ─► guardar en Postgres
```

Como los tickers populares (AAPL, TSLA, NVDA...) se repiten constantemente, se
espera que **la gran mayoría de visitas cuesten 0 tokens**.

- **TTL propuesto:** 24 h para el veredicto (los fundamentales apenas cambian
  intradía). El precio se puede refrescar aparte, sin llamar a Claude.

### 3.2 Salidas cortas y deterministas

- `max_tokens` bajo y **formato de salida fijo** (JSON estructurado con campos
  acotados: `veredicto`, `puntos_fuertes[]`, `riesgos[]`, `resumen`).
- `temperature` baja → respuestas consistentes y reproducibles.

### 3.3 Prompt caching de Anthropic

- La parte fija del prompt (instrucciones + esquema de salida) se marca como
  cacheable → descuento en tokens de **entrada** en llamadas repetidas.

### 3.4 Blindaje anti-abuso (app pública sin login)

Una app pública que llama a un LLM puede sufrir *token drain* si alguien la
spammea. Mitigaciones:

- **Validar el ticker contra FMP ANTES de llamar a Claude** — si el símbolo no
  existe, se corta ahí (FMP es barato/gratis; Claude no).
- **Rate-limit por IP** (tabla en Postgres o Redis futuro).
- **Tope global diario** de análisis *frescos* (nuevas llamadas a Claude) como
  red de seguridad configurable por env var.
- **Sin procesos en background** que llamen a Claude solos — siempre bajo demanda.

---

## 4. Esquema de datos (PostgreSQL)

> Propuesta inicial — sujeta a ajuste al implementar.

### `analysis` — caché de veredictos de Claude
| columna         | tipo          | notas                                            |
| --------------- | ------------- | ------------------------------------------------ |
| `ticker`        | `text` PK     | símbolo en mayúsculas (ej. `AAPL`)               |
| `payload`       | `jsonb`       | veredicto completo generado por Claude           |
| `fundamentals`  | `jsonb`       | snapshot de datos FMP usados para el análisis    |
| `model`         | `text`        | modelo de Claude usado (para invalidar futuro)   |
| `input_tokens`  | `int`         | tokens gastados (métrica de coste)               |
| `output_tokens` | `int`         | tokens gastados (métrica de coste)               |
| `generated_at`  | `timestamptz` | para calcular el TTL                              |

### `rate_limit` — control de abuso por IP
| columna       | tipo          | notas                                    |
| ------------- | ------------- | ---------------------------------------- |
| `ip_hash`     | `text`        | hash de la IP (no guardar IP en claro)   |
| `window_start`| `timestamptz` | inicio de la ventana de conteo           |
| `count`       | `int`         | peticiones en la ventana                 |

### `ticker_stats` — popularidad (para métricas / trending)
| columna       | tipo          | notas                                    |
| ------------- | ------------- | ---------------------------------------- |
| `ticker`      | `text` PK     |                                          |
| `hits`        | `bigint`      | veces consultado                         |
| `last_seen`   | `timestamptz` |                                          |

---

## 5. Contrato de la API (borrador)

| Método | Ruta                       | Descripción                                              |
| ------ | -------------------------- | ------------------------------------------------------- |
| `GET`  | `/`                        | sirve el mini-frontend (HTML)                           |
| `GET`  | `/api/analysis/{ticker}`   | análisis completo (cacheado o recién generado)          |
| `GET`  | `/api/quote/{ticker}`      | solo precio en vivo (sin Claude, refresco barato)       |
| `GET`  | `/api/trending`            | tickers más consultados (de `ticker_stats`)             |
| `GET`  | `/health`                  | healthcheck para Docker                                  |

**Ejemplo de respuesta `/api/analysis/AAPL`:**
```json
{
  "ticker": "AAPL",
  "price": 213.55,
  "fundamentals": { "pe": 33.1, "roe": 1.47, "debtToEquity": 1.87, "...": "..." },
  "analysis": {
    "veredicto": "Sólida pero con valoración exigente",
    "puntos_fuertes": ["Márgenes altísimos", "Recompras agresivas"],
    "riesgos": ["PER por encima de su media histórica", "Dependencia del iPhone"],
    "resumen": "Calidad indiscutible; el precio ya descuenta mucho optimismo."
  },
  "cached": true,
  "generated_at": "2026-07-04T12:00:00Z",
  "disclaimer": "Esto no es asesoría financiera."
}
```

---

## 6. Decisiones tomadas

- **Propósito:** analista de acciones con IA (vs. comparador / noticias / educativo).
- **Interfaz:** API JSON + mini-frontend (vs. HTML server-side puro / solo API).
- **Prioridad #1:** que Python + Claude brillen **gastando pocos tokens** → la
  caché en Postgres es el corazón del diseño, no un añadido.
- **Sin registro:** el estado vive en la URL; nada de cuentas de usuario.

## 7. Decisiones pendientes

- [ ] TTL exacto del veredicto (¿24 h? ¿48 h?) y del precio.
- [ ] Modelo de Claude a usar (equilibrio coste/calidad — probablemente Haiku
      para el veredicto por coste, evaluar en la fase de pruebas).
- [ ] Fuente de la API key de Claude en runtime (env var / `.env` / secreto Docker).
- [ ] ¿Redis para rate-limit o basta con Postgres al inicio? (empezar con Postgres).
- [ ] Diseño visual del mini-frontend.

## 8. Roadmap

1. **[hecho]** Definir propósito, arquitectura y esquema de datos (este doc).
2. Validar el flujo FMP → Claude con un script de prueba (medir tokens reales).
3. Montar el esqueleto: `docker-compose`, `Dockerfile`, `requirements`, esquema SQL.
4. Endpoint `/api/analysis/{ticker}` con caché en Postgres.
5. Blindaje anti-abuso (validación de ticker + rate-limit).
6. Mini-frontend.
7. Pulido, métricas de tokens y despliegue.

---

## 9. Estructura del repositorio (prevista)

```
Finlytics/
├── backend/          # FastAPI (Python): rutas, lógica FMP + Claude, caché
├── frontend/         # mini-frontend (HTML/JS que consume la API)
├── db/               # esquema SQL e inicialización de Postgres
├── docker-compose.yml
├── README.md         # este documento
└── CLAUDE.md         # guía para sesiones de Claude Code
```

> **Disclaimer:** Finlytics es una herramienta informativa/educativa. Nada de lo
> que muestra constituye asesoría financiera.
