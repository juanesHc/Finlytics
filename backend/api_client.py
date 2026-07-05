

import anthropic
from dotenv import load_dotenv
from pydantic import BaseModel
from utils import getDataFromEnv

load_dotenv()

client = anthropic.Anthropic()

MODELO = getDataFromEnv("CLAUDE_MODEL") 
MAX_TOKENS = getDataFromEnv("MAX_TOKENS")  


class Veredicto(BaseModel):
    veredicto: str           
    puntos_fuertes: list[str] 
    riesgos: list[str]        
    resumen: str              


SYSTEM = (str(getDataFromEnv("PROMPT_INSTRUCCIONES")))


def generar_veredicto(ticker, fundamentals):

    respuesta = client.messages.parse(
        model=MODELO,
        max_tokens=MAX_TOKENS,
        temperature=0,
        system=SYSTEM,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Ticker: {ticker}\n"
                    f"Fundamentales (JSON):\n{fundamentals}\n\n"
                    "Da tu veredicto."
                ),
            }
        ],
        output_format=Veredicto,
    )

    veredicto = respuesta.parsed_output  
    uso = {
        "input": respuesta.usage.input_tokens,
        "output": respuesta.usage.output_tokens,
    }

    return veredicto.model_dump(), uso


