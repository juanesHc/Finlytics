"""
API HTTP de Finlytics (FastAPI).

Ejecutar (con el venv activado, desde la raiz del proyecto):
    uvicorn main:app --app-dir backend --reload

Docs automaticas en:  http://localhost:8000/docs
"""
import hashlib

from fastapi import FastAPI, HTTPException, Request

from dtos import Analisis
from errors import CuotaExcedida, TickerNoEncontrado
from service import analizar

app = FastAPI(
    title="Finlytics",
    description="Analista de acciones con IA. Publico, sin registro.",
)


def hash_ip(ip: str) -> str:
    return hashlib.sha256(ip.encode()).hexdigest()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/analysis/{ticker}", response_model=Analisis)
def get_analysis(ticker: str, request: Request):
    ip_hash = hash_ip(request.client.host)
    try:
        return analizar(ip_hash, ticker)
    except TickerNoEncontrado as e:
        raise HTTPException(status_code=404, detail=str(e))
    except CuotaExcedida as e:
        raise HTTPException(status_code=429, detail=str(e))
