# Finlytics

**Analista de acciones con IA — público, sin registro.**

Escribes un ticker (ej. `AAPL`) y Finlytics te devuelve precio, fundamentales
clave y **un veredicto en lenguaje natural generado por Claude** ("sólida pero
cara frente a su sector"). Sin cuentas ni login.

> Estado: **funcionando**. Backend + mini-frontend + chatbot operativos, en fase
> de **preparación para despliegue** (PaaS: Render).

---

## 1. Qué hace

- **Análisis con veredicto IA** — fundamentales de FMP + un veredicto de Claude
  (Haiku) cacheado en Postgres.
- **Chatbot** — asistente flotante en todas las pantallas, responde dudas de
  inversión con Haiku (cuota propia).
- **Exportar CSV** — estados financieros (income statement) de FMP: vista previa,
  gráfico de ingresos y descarga en `.csv`.
- **Comparar** — dos empresas lado a lado (precio, market cap, beta, sector…).
- **Histórico de precios** — gráfico de línea del precio en el tiempo, con rango.

**Principios de producto:**

- **Público y sin fricción** — sin registro, sin paywall.
- **Honesto** — todo veredicto lleva disclaimer: *no es asesoría financiera*.

---

## 2. Arquitectura

Interfaz: **API JSON + mini-frontend** (páginas HTML que consumen la API, servidas
por la misma FastAPI → mismo origen, sin CORS).

| Capa             | Tecnología                        | Rol                                            |
| ---------------- | --------------------------------- | ---------------------------------------------- |
| Backend / API    | **Python (FastAPI)**              | orquesta FMP + Claude, sirve API y frontend    |
| IA               | **Claude API** (Haiku)            | genera el veredicto y responde el chat         |
| Datos de mercado | **FMP** (Financial Modeling Prep) | perfil, fundamentales, estados, históricos     |
| Persistencia     | **PostgreSQL**                    | caché de análisis + rate-limit por IP          |
| Empaquetado      | **Docker Compose**                | servicios `web` (Python) + `db` (Postgres)     |

```
                    ┌──────────────┐
   navegador  ──►   │  mini-front  │  (HTML + fetch a la API, mismo origen)
                    └──────┬───────┘
                           │ GET /api/...
                    ┌──────▼───────┐        ┌──────────────┐
                    │   FastAPI    │───────►│  PostgreSQL  │  (caché + cuota diaria)
                    │   (Python)   │◄───────│              │
                    └──┬────────┬──┘        └──────────────┘
                       │        │
              ┌────────▼──┐  ┌──▼──────────┐
              │   FMP     │  │   Claude    │  (solo si no hay caché fresca)
              │ (datos)   │  │  (veredicto)│
              └───────────┘  └─────────────┘
```

---

## 3. Regla de oro: pocos tokens

El requisito no negociable: **minimizar el consumo de la API de Claude.**

- **Caché primero** — el veredicto de un ticker se genera **una vez** y se guarda
  en Postgres (TTL 24 h). La mayoría de peticiones repetidas cuestan **0 tokens**.
- **Validar el ticker en FMP ANTES de llamar a Claude** — corta símbolos falsos gratis.
- **Salida corta y estructurada** — `max_tokens` bajo, JSON de campos fijos,
  `temperature` baja.
- **Rate-limit por IP** — 5 análisis/día y 10 mensajes de chat/día (tabla
  `daily_quota`, UPSERT atómico).
- **Las funciones de datos puros de FMP** (perfil, estados, histórico, búsqueda)
  **no llaman a Claude** → 0 tokens.

---

## 4. Esquema de datos (PostgreSQL)

Definido en `db/schema.sql` (todo con `CREATE TABLE IF NOT EXISTS`, idempotente).

### `analysis` — caché de veredictos de Claude
| columna             | tipo            | notas                                     |
| ------------------- | --------------- | ----------------------------------------- |
| `ticker`            | `text` PK       | símbolo en mayúsculas                     |
| `analysis`          | `jsonb`         | veredicto generado por Claude             |
| `fundamentals`      | `jsonb`         | snapshot de datos FMP del análisis        |
| `price_at_analysis` | `numeric(14,4)` | precio al momento del análisis            |
| `generated_at`      | `timestamptz`   | para calcular el TTL (24 h)               |

### `daily_quota` — rate-limit por IP y día
| columna    | tipo      | notas                                                    |
| ---------- | --------- | -------------------------------------------------------- |
| `ip_hash`  | `text`    | hash SHA-256 de la IP (nunca en claro)                   |
| `day`      | `date`    | día de la ventana                                        |
| `count`    | `integer` | peticiones en el día · PK `(ip_hash, day)`               |

> El chat reusa esta tabla con clave namespaced `chat:<ip_hash>` (cuota separada).

### `ticker_stats` — popularidad (reservada para *trending*)
| columna     | tipo          | notas                    |
| ----------- | ------------- | ------------------------ |
| `ticker`    | `text` PK     |                          |
| `hits`      | `bigint`      | veces consultado         |
| `last_seen` | `timestamptz` |                          |

---

## 5. API

| Método | Ruta                              | Descripción                                            | Claude |
| ------ | --------------------------------- | ------------------------------------------------------ | :----: |
| `GET`  | `/`                               | mini-frontend (HTML)                                   |   —    |
| `GET`  | `/health`                         | healthcheck                                            |   —    |
| `GET`  | `/api/analysis/{ticker}`          | análisis con veredicto (cacheado o generado)           |   sí   |
| `POST` | `/api/chat`                       | mensaje al chatbot                                     |   sí   |
| `GET`  | `/api/search?q=`                  | busca empresas por nombre (FMP)                        |   —    |
| `GET`  | `/api/profile/{ticker}`           | fundamentales (Comparar)                               |   —    |
| `GET`  | `/api/financials/{ticker}?years=` | income statement (Exportar CSV)                        |   —    |
| `GET`  | `/api/history/{ticker}?days=`     | histórico de precios                                   |   —    |

**Ejemplo `/api/analysis/AAPL`:**
```json
{
  "ticker": "AAPL",
  "precio": 213.55,
  "fundamentales": {
    "ticker": "AAPL", "nombre": "Apple Inc.", "precio": 213.55,
    "sector": "Technology", "industria": "Consumer Electronics",
    "market_cap": 3200000000000, "beta": 1.2
  },
  "veredicto": {
    "veredicto": "Sólida pero con valoración exigente",
    "puntos_fuertes": ["Márgenes altísimos", "Recompras agresivas"],
    "riesgos": ["Múltiplo por encima de su media", "Dependencia del iPhone"],
    "resumen": "Calidad indiscutible; el precio ya descuenta mucho optimismo."
  },
  "cached": true,
  "disclaimer": "Esto no es asesoria financiera. Solo con fines informativos."
}
```

---

## 6. Correr en local (Docker Compose)

```bash
cp .env.example .env      # rellena FMP_API_KEY, ANTHROPIC_API_KEY, prompts...
docker compose up -d --build
```

- API + frontend: <http://localhost:8000>  ·  docs: <http://localhost:8000/docs>
- El esquema SQL se aplica solo en el primer arranque (`db/` montado en
  `docker-entrypoint-initdb.d`).
- El `frontend/` va **bind-mounted**: editas HTML/CSS/JS y ves el cambio con solo
  refrescar el navegador (sin reconstruir). El código Python sí requiere
  `docker compose up -d --build web`.

---

## 7. Despliegue en Render (PaaS)

La imagen ya está lista para PaaS: uvicorn escucha el `$PORT` que inyecta Render y
el `frontend/` va **horneado** en la imagen (no depende del bind-mount).

1. **Postgres gestionado** — crea una instancia y copia su *Internal Database URL*.
2. **Web Service (Docker)** — apunta a `backend/Dockerfile` con *Root Directory* `.`
   (el contexto de build es la raíz del repo).
3. **Aplica el esquema una vez** contra la BD de Render (el truco de
   `docker-entrypoint-initdb.d` NO corre en Postgres gestionado):
   ```bash
   psql "<EXTERNAL_DATABASE_URL>" -f db/schema.sql
   ```
4. **Variables de entorno** (ver `.env.example`): `DATABASE_URL`, `FMP_API_KEY`,
   `BASE_URL_FMP`, `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `MAX_TOKENS`,
   `PROMPT_INSTRUCCIONES`, `CHAT_SYSTEM_PROMPT`.

> El servicio `db` del `docker-compose.yml` es **solo para desarrollo local**; en
> Render se usa el Postgres gestionado.

---

## 8. Estructura del repositorio

```
Finlytics/
├── backend/            # FastAPI: main.py (rutas), service.py, fmp.py, claude.py,
│                       #          db.py, dtos.py, errors.py, utils.py, Dockerfile
├── frontend/           # mini-frontend (HTML/CSS/JS por pantalla)
├── db/schema.sql       # esquema de Postgres
├── docker-compose.yml  # dev local (web + db)
├── .dockerignore       # higiene del contexto de build (raíz)
├── .env.example        # plantilla de variables de entorno
├── README.md           # este documento
└── CLAUDE.md           # guía para sesiones de Claude Code
```

---

> **Disclaimer:** Finlytics es una herramienta informativa/educativa. Nada de lo
> que muestra constituye asesoría financiera.
