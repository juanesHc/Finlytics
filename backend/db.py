import psycopg
from dotenv import load_dotenv
from utils import getDataFromEnv

load_dotenv()

DATABASE_URL = getDataFromEnv("DATABASE_URL")

LIMITE_DIARIO = 5 
def conectar():
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

