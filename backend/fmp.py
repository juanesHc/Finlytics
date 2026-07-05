import requests
from dotenv import load_dotenv
from utils import getDataFromEnv

load_dotenv()

FMP_API_KEY = getDataFromEnv("FMP_API_KEY")
BASE_URL_FMP = getDataFromEnv("BASE_URL_FMP")


def getDataFromFMP(ticker):
        url = f"{BASE_URL_FMP}/profile"
        r = requests.get(url, params={"symbol": ticker, "apikey": FMP_API_KEY}, timeout=20)
        data = r.json()      
        if len(data) == 0:
            return None
        else:
            return data[0]
    
