import psycopg
from dotenv import load_dotenv
from psycopg.types.json import Jsonb

from utils import getDataFromEnv

load_dotenv()

DATABASE_URL = getDataFromEnv("DATABASE_URL")

LIMITE_DIARIO = 5
LIMITE_CHAT_DIARIO = 10


def connect():
    return psycopg.connect(DATABASE_URL)


def checkDailyQuotas(conn, ip_hash):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO daily_quota (ip_hash, count) VALUES (%s, 1) "
            "ON CONFLICT (ip_hash, day) DO UPDATE SET count = daily_quota.count + 1 "
            "RETURNING count",
            (ip_hash,),
        )
        (count,) = cur.fetchone()
    conn.commit()
    return count


def checkChatQuota(conn, ip_hash):
    key = f"chat:{ip_hash}"
    return checkDailyQuotas(conn, key)


def readAnalysis(conn, ticker):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT analysis, fundamentals, price_at_analysis FROM analysis "
            "WHERE ticker = %s AND generated_at > now() - interval '24 hours'",
            (ticker,),
        )
        fila = cur.fetchone()

    if fila is None:
        return None

    analysis, fundamentals, price = fila
    return {"analysis": analysis, "fundamentals": fundamentals, "price": price}


def registerAnalysis(conn, ticker, analysis, fundamentals, price=None):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO analysis (ticker, analysis, fundamentals, price_at_analysis) "
            "VALUES (%s, %s, %s, %s) ON CONFLICT (ticker) "
            "DO UPDATE SET analysis = EXCLUDED.analysis, "
            "fundamentals = EXCLUDED.fundamentals, "
            "price_at_analysis = EXCLUDED.price_at_analysis, "
            "generated_at = now()",
            (ticker, Jsonb(analysis), Jsonb(fundamentals), price),
        )
    conn.commit()
