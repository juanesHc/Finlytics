"""
API HTTP de Finlytics (FastAPI).

Ejecutar (con el venv activado, desde la raiz del proyecto):
    uvicorn main:app --app-dir backend --reload

Docs automaticas en:  http://localhost:8000/docs
"""
import hashlib

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles

from dtos import Analisis, ChatRequest, ChatResponse
from errors import CuotaExcedida, TickerNoEncontrado
from service import analizar, chatear

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


@app.post("/api/chat", response_model=ChatResponse)
def post_chat(body: ChatRequest, request: Request):
    ip_hash = hash_ip(request.client.host)
    try:
        mensajes = [m.model_dump() for m in body.mensajes]
        return ChatResponse(respuesta=chatear(ip_hash, mensajes))
    except CuotaExcedida as e:
        raise HTTPException(status_code=429, detail=str(e))


# Sirve el mini-frontend (index.html, style.css, script.js) en el mismo origen
# que la API -> sin problemas de CORS. Debe montarse en "/" AL FINAL, despues de
# las rutas /api, para que estas tengan prioridad. html=True sirve index.html en "/".
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
