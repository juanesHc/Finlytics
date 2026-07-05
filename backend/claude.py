import anthropic
from dotenv import load_dotenv

from utils import getDataFromEnv
from dtos import  Veredicto

load_dotenv()

client = anthropic.Anthropic()

MODELO = getDataFromEnv("CLAUDE_MODEL")
MAX_TOKENS = int(getDataFromEnv("MAX_TOKENS"))
SYSTEM = str(getDataFromEnv("PROMPT_INSTRUCCIONES"))


MAX_TOKENS_CHAT = 300
CHAT_SYSTEM = (getDataFromEnv("CHAT_SYSTEM_PROMPT") )


def chat_reply(mensajes):

    respuesta = client.messages.create(
        model=MODELO,
        max_tokens=MAX_TOKENS_CHAT,
        temperature=0.3,
        system=CHAT_SYSTEM,
        messages=mensajes,
    )
    texto = respuesta.content[0].text
    uso = {
        "input": respuesta.usage.input_tokens,
        "output": respuesta.usage.output_tokens,
    }
    return texto, uso


def generated_verdict(fundamentales):

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


