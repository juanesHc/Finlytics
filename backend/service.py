"""
Capa de servicio: el 'director de orquesta'.
Combina db + fmp + claude con la regla de oro (pocos tokens) incrustada:
cada corte temprano ahorra tokens; Claude es el ultimo recurso.
"""
from db import (
    connect,
    checkDailyQuotas,
    checkChatQuota,
    readAnalysis,
    registerAnalysis,
    LIMITE_DIARIO,
    LIMITE_CHAT_DIARIO,
)
from fmp import getDataFromFMP
from claude import generated_verdict, chat_reply
from dtos import Analisis, Fundamentales, Veredicto
from errors import CuotaExcedida, TickerNoEncontrado

# Memoria corta: cuantos mensajes recientes se envian como contexto.
CHAT_MEMORIA = 6
# Tope de caracteres por mensaje (higiene de tokens: corta entradas gigantes).
MAX_CHARS_MENSAJE = 500


def analizar(ip_hash, ticker):
    """Analiza una accion y devuelve un DTO Analisis.

    Lanza CuotaExcedida o TickerNoEncontrado si no procede.
    """
    ticker = ticker.upper()
    conn = connect()
    try:
        # 1. Rate-limit: cuenta esta consulta de la IP para hoy.
        #    (Contamos TODAS las peticiones, cacheadas o no = "5 consultas/dia".)
        count = checkDailyQuotas(conn, ip_hash)
        if count > LIMITE_DIARIO:
            raise CuotaExcedida("Limite de 5 analisis por dia alcanzado.")

        # 2. Cache fresca (<24h)? -> 0 tokens, 0 llamadas externas.
        cache = readAnalysis(conn, ticker)
        if cache is not None:
            return Analisis(
                ticker=ticker,
                precio=cache["price"],
                fundamentales=Fundamentales(**cache["fundamentals"]),
                veredicto=Veredicto(**cache["analysis"]),
                cached=True,
            )

        # 3. Validar el ticker en FMP ANTES de llamar a Claude (corta gratis).
        fundamentales = getDataFromFMP(ticker)
        if fundamentales is None:
            raise TickerNoEncontrado(f"El ticker '{ticker}' no existe.")

        # 4. Ultima opcion: Claude genera el veredicto y lo guardamos en cache.
        veredicto, uso = generated_verdict(fundamentales)
        registerAnalysis(
            conn,
            ticker,
            veredicto.model_dump(),
            fundamentales.model_dump(),
            fundamentales.precio,
        )
        return Analisis(
            ticker=ticker,
            precio=fundamentales.precio,
            fundamentales=fundamentales,
            veredicto=veredicto,
            cached=False,
        )
    finally:
        conn.close()


def chatear(ip_hash, mensajes):
    """Responde en el chat aplicando la regla de oro.

    `mensajes` = lista de dicts {"role", "content"} (toda la conversacion del
    cliente). Devuelve el texto de la respuesta de Haiku.
    Lanza CuotaExcedida si se supero el limite diario de chat.
    """
    conn = connect()
    try:
        # 1. Rate-limit propio del chat (separado de los 5 analisis/dia).
        count = checkChatQuota(conn, ip_hash)
        if count > LIMITE_CHAT_DIARIO:
            raise CuotaExcedida(
                f"Limite de chat alcanzado ({LIMITE_CHAT_DIARIO} mensajes por dia)."
            )
    finally:
        conn.close()

    # 2. Higiene de tokens: recortar cada mensaje y quedarnos con los ultimos N.
    limpios = []
    for m in mensajes:
        role = m.get("role")
        content = (m.get("content") or "").strip()[:MAX_CHARS_MENSAJE]
        if role in ("user", "assistant") and content:
            limpios.append({"role": role, "content": content})

    recortados = limpios[-CHAT_MEMORIA:]
    if not recortados:
        return "Escribe un mensaje para empezar."

    # 3. Haiku responde (contexto = system prompt fijo + memoria corta).
    texto, uso = chat_reply(recortados)
    return texto


if __name__ == "__main__":
    # Prueba end-to-end: 1a vez llama a FMP+Claude; 2a vez viene de cache.
    for i in (1, 2):
        r = analizar("ip-de-prueba", "AAPL")
        print(f"[{i}] cached={r.cached} | {r.ticker} ${r.precio} -> {r.veredicto.veredicto}")
