import anthropic
from dotenv import load_dotenv

from utils import getDataFromEnv
from dtos import Fundamentales, Veredicto

load_dotenv()

client = anthropic.Anthropic()

MODELO = getDataFromEnv("CLAUDE_MODEL")
MAX_TOKENS = int(getDataFromEnv("MAX_TOKENS"))
SYSTEM = str(getDataFromEnv("PROMPT_INSTRUCCIONES"))


def generated_verdict(fundamentales):
    """Genera el veredicto de una accion con Claude (Haiku).

    Recibe un DTO Fundamentales (el ticker viaja dentro).
    Devuelve (Veredicto, uso_tokens).
    """
    respuesta = client.messages.parse(
        model=MODELO,
        max_tokens=MAX_TOKENS,
        temperature=0,
        system=SYSTEM,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Ticker: {fundamentales.ticker}\n"
                    f"Fundamentales (JSON):\n{fundamentales.model_dump()}\n\n"
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
    return veredicto, uso


