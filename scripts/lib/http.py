"""Cliente HTTP partilhado: User-Agent de browser real, delay entre pedidos,
retry com backoff em erros de rede/5xx, e tratamento explicito de 403."""
import random
import time

import requests

from config import USER_AGENT, REQUEST_DELAY_RANGE, REQUEST_TIMEOUT, MAX_RETRIES


class BlockedError(Exception):
    """Levantado quando o site bloqueia o pedido (403)."""


_session = requests.Session()
_session.headers.update({"User-Agent": USER_AGENT})


def get(url, allow_404=False, delay_range=REQUEST_DELAY_RANGE):
    """GET com retry/backoff. Devolve o Response, ou None se allow_404 e status==404.
    Levanta BlockedError em 403 (nao tenta novamente — endpoints bloqueados nao
    se desbloqueiam com retries)."""
    last_exc = None
    for attempt in range(1, MAX_RETRIES + 1):
        time.sleep(random.uniform(*delay_range))
        try:
            resp = _session.get(url, timeout=REQUEST_TIMEOUT)
        except requests.RequestException as exc:
            last_exc = exc
            time.sleep(2 ** attempt)
            continue

        if resp.status_code == 403:
            raise BlockedError(f"Bloqueado (403) em {url}")
        # O Goodreads esta atras de uma AWS WAF: quando acha que ha pedidos a
        # mais responde 202 vazio com um desafio de JavaScript. Tentar de novo
        # logo a seguir so prolonga o bloqueio.
        if resp.headers.get("x-amzn-waf-action"):
            raise BlockedError(f"Pedido travado pelo anti-bot do Goodreads em {url} (espera uns minutos)")
        if resp.status_code == 404:
            if allow_404:
                return None
            resp.raise_for_status()
        if resp.status_code >= 500:
            last_exc = requests.HTTPError(f"{resp.status_code} em {url}")
            time.sleep(2 ** attempt)
            continue

        resp.raise_for_status()
        return resp

    raise last_exc or RuntimeError(f"Falha ao obter {url}")
