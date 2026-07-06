import requests
from dotenv import load_dotenv

from utils import getDataFromEnv
from dtos import Fundamentales

load_dotenv()

FMP_API_KEY = getDataFromEnv("FMP_API_KEY")
BASE_URL_FMP = getDataFromEnv("BASE_URL_FMP")


def getDataFromFMP(ticker):

    url = f"{BASE_URL_FMP}/profile"
    r = requests.get(url, params={"symbol": ticker, "apikey": FMP_API_KEY}, timeout=20)
    data = r.json()
    if not data:
        return None

    d = data[0]
    return Fundamentales(
        ticker=ticker.upper(),
        nombre=d["companyName"],
        precio=d["price"],
        sector=d.get("sector"),
        industria=d.get("industry"),
        market_cap=d.get("marketCap"),
        beta=d.get("beta"),
    )


def searchByName(query):

    url = f"{BASE_URL_FMP}/search-name"
    r = requests.get(
        url,
        params={"query": query, "limit": 10, "apikey": FMP_API_KEY},
        timeout=20,
    )
    data = r.json()
    if not data:
        return []
    
    return [
        {"symbol": d["symbol"], "name": d["name"], "exchange": d.get("exchange")}
        for d in data
    ]


def getFinancialStatements(ticker, years=5):

    url = f"{BASE_URL_FMP}/income-statement"
    r = requests.get(url, params={"symbol": ticker.upper(), "period": "annual", "limit": years, "apikey": FMP_API_KEY}, timeout=20)
    try:
        data = r.json()
    except ValueError:
        return None
    if not data or not isinstance(data, list):
        return None
    return data
