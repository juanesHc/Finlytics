from pydantic import BaseModel


class Fundamentales(BaseModel):
    ticker: str
    nombre: str
    precio: float
    sector: str | None = None
    industria: str | None = None
    market_cap: int | None = None
    beta: float | None = None


class Veredicto(BaseModel):
    veredicto: str
    puntos_fuertes: list[str]
    riesgos: list[str]
    resumen: str


class Analisis(BaseModel):
    ticker: str
    precio: float
    fundamentales: Fundamentales
    veredicto: Veredicto
    cached: bool
    disclaimer: str = "Esto no es asesoria financiera. Solo con fines informativos."


class MensajeChat(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    mensajes: list[MensajeChat]


class ChatResponse(BaseModel):
    respuesta: str
