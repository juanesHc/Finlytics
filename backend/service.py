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
from claude import generateVerdict, chatReply
from dtos import Analisis, Fundamentales, Veredicto
from errors import CuotaExcedida, TickerNoEncontrado

CHAT_MEMORIA = 6
MAX_CHARS_MENSAJE = 500


def analyze(ip_hash, ticker):
    ticker = ticker.upper()
    conn = connect()
    try:
        count = checkDailyQuotas(conn, ip_hash)
        if count > LIMITE_DIARIO:
            raise CuotaExcedida("Limite de 5 analisis por dia alcanzado.")

        cache = readAnalysis(conn, ticker)
        if cache is not None:
            return Analisis(
                ticker=ticker,
                precio=cache["price"],
                fundamentales=Fundamentales(**cache["fundamentals"]),
                veredicto=Veredicto(**cache["analysis"]),
                cached=True,
            )

        fundamentales = getDataFromFMP(ticker)
        if fundamentales is None:
            raise TickerNoEncontrado(f"El ticker '{ticker}' no existe.")

        veredicto, uso = generateVerdict(fundamentales)
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


def chat(ip_hash, mensajes):
    conn = connect()
    try:
        count = checkChatQuota(conn, ip_hash)
        if count > LIMITE_CHAT_DIARIO:
            raise CuotaExcedida(
                f"Limite de chat alcanzado ({LIMITE_CHAT_DIARIO} mensajes por dia)."
            )
    finally:
        conn.close()

    limpios = []
    for m in mensajes:
        role = m.get("role")
        content = (m.get("content") or "").strip()[:MAX_CHARS_MENSAJE]
        if role in ("user", "assistant") and content:
            limpios.append({"role": role, "content": content})

    recortados = limpios[-CHAT_MEMORIA:]
    if not recortados:
        return "Escribe un mensaje para empezar."

    texto, uso = chatReply(recortados)
    return texto
