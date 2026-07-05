
class CuotaExcedida(Exception):
    """La IP supero el limite diario de analisis (-> 429 en la API)."""


class TickerNoEncontrado(Exception):
    """El ticker no existe en FMP (-> 404 en la API)."""
