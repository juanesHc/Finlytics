from datetime import date, timedelta
import hashlib

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.staticfiles import StaticFiles

from dtos import Analisis, ChatRequest, ChatResponse , Fundamentales
from errors import CuotaExcedida, TickerNoEncontrado
from fmp import getDataFromFMP, getFinancialStatements, getPriceHistory, searchByName
from service import analyze, chat

app = FastAPI(
    title="Finlytics",
    description="Analista de acciones con IA. Publico.",
)


def hashIp(ip: str) -> str:
    return hashlib.sha256(ip.encode()).hexdigest()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/analysis/{ticker}", response_model=Analisis)
def getAnalysis(ticker: str, request: Request):
    ip_hash = hashIp(request.client.host)
    try:
        return analyze(ip_hash, ticker)
    except TickerNoEncontrado as e:
        raise HTTPException(status_code=404, detail=str(e))
    except CuotaExcedida as e:
        raise HTTPException(status_code=429, detail=str(e))


@app.post("/api/chat", response_model=ChatResponse)
def postChat(body: ChatRequest, request: Request):
    ip_hash = hashIp(request.client.host)
    try:
        mensajes = [m.model_dump() for m in body.mensajes]
        return ChatResponse(respuesta=chat(ip_hash, mensajes))
    except CuotaExcedida as e:
        raise HTTPException(status_code=429, detail=str(e))


@app.get("/api/search")
def searchCompanies(q: str):
    return searchByName(q)


@app.get("/api/financials/{ticker}")
def getFinancials(ticker: str, years: int = Query(5, ge=1, le=20)):
    data = getFinancialStatements(ticker, years)
    if data is None:
        raise HTTPException(
            status_code=404,
            detail=f"No hay estados financieros para '{ticker.upper()}'.",
        )
    return data

@app.get("/api/profile/{ticker}", response_model=Fundamentales)
def getProfile(ticker: str):
    data = getDataFromFMP(ticker)
    if data is None:
        raise HTTPException(
            status_code=404,
            detail=f"No hay perfil para '{ticker.upper()}'.",
        )
    return data

@app.get("/api/history/{ticker}")
def getHistory(ticker: str, days: int = Query(365, ge=1, le=1825)):
    toDate = date.today()
    fromDate = toDate - timedelta(days=days)
    data = getPriceHistory(ticker, fromDate.isoformat(), toDate.isoformat())
    if data is None :
        raise HTTPException(404, f"No hay histórico para '{ticker.upper()}'.")
    return data


app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
