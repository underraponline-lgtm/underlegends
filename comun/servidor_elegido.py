"""🏠 EL SERVIDOR QUE ELIGIÓ CADA UNO, PARA LAS CARTAS.

Dlx, 13/10/2026, mirando la fila de Erian en el Ranking: *«erian es de urban…
actualiza eso… recuerda que quité eso de los servidores para todos a menos que
se lo pongan manualmente en la tarjeta como erian»*.

La regla es del 12/10 (2.80: *«quiero que quites de dónde son todos, o sea el
servidor, a menos que eso lo hayan elegido»*) y se aplicó a la PÁGINA —
`web/src/elegidos.js`—, pero no a las cartas: la Temporada, la Competitiva y la
de País seguían dibujando el escudo de `sv`, que es el servidor donde **más
jugaste** (el argmax del pool). Erian eligió Urban Freestyle en Mi cuenta, juega
casi todo en FFA, y su carta decía FFA.

Ahora las tres dibujan sólo el que eligió cada uno, y sin elegir, ninguno.
⚠️ **La de Servidor no cambia**: mide lo que hiciste en cada servidor, o sea que
su escudo es un dato, no tu identidad (la misma excepción que la 2.80).

🔑 DE DÓNDE SALE: `/api/avisos/servidores`, la misma ruta pública que lee la
página (`servidoresElegidos()` del Durable Object: cuál eligió cada perfil,
nunca quién es quién). `bajar()` la trae y deja la copia en
`datos/servidor_elegido.json`, que es lo que leen los generadores; si la ruta no
contesta se usa la copia, así una caída no le saca el servidor a nadie. La pide
`bot/que_cambio.huellas()`, que corre antes de dibujar en los dos trabajos del
ciclo: el sello ve el cambio y el dibujo lee la misma copia.

⚠️ `''` ES «NINGUNO»: contestó y no quiso ninguno. Para la carta es lo mismo
que no haber elegido.

    python comun/servidor_elegido.py          # el self-check y quién eligió qué
"""
import json
import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE not in sys.path:
    sys.path.insert(0, BASE)
RUTA = os.path.join(BASE, 'datos', 'servidor_elegido.json')
URL = 'https://underlegends.pages.dev/api/avisos/servidores'
_SIGLA = re.compile(r'^[A-Z]{2,5}$')

_mapa = None


def _limpio(n):
    """`{clave: sigla}` sólo con siglas válidas: `''` (ninguno) y lo raro se van."""
    out = {}
    for k, v in (n or {}).items():
        if isinstance(k, str) and isinstance(v, str) and _SIGLA.match(v):
            out[k] = v
    return dict(sorted(out.items()))


def mapa():
    """`{clave: sigla}` de la copia en disco; `{}` si no hay copia."""
    global _mapa
    if _mapa is None:
        try:
            with open(RUTA, encoding='utf-8') as f:
                _mapa = _limpio((json.load(f) or {}).get('n'))
        except (OSError, ValueError):
            _mapa = {}
    return _mapa


def bajar(timeout=15):
    """Trae lo de hoy, deja la copia (sólo si cambió) y lo devuelve. Si no contesta, la copia."""
    global _mapa
    try:
        import requests
        r = requests.get(URL, headers={'accept': 'application/json'}, timeout=timeout)
        r.raise_for_status()
        # ⚠️ `r.json()` y no `json.loads(r.text)`: sin charset, `requests` adivina (CLAUDE.md)
        n = _limpio(r.json().get('n'))
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude leer qué servidor eligió cada uno (%s): uso la copia' % str(e)[:60])
        return mapa()
    if n != mapa() or not os.path.exists(RUTA):
        with open(RUTA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'_leeme': 'el servidor que eligió cada uno en Mi cuenta, por clave de perfil. '
                                 'Lo escribe comun/servidor_elegido.py desde /api/avisos/servidores',
                       'n': n}, f, ensure_ascii=False, indent=1)
            f.write('\n')
    _mapa = n
    return n


def de(nombre, m=None):
    """La sigla que eligió `nombre` (como viene en el pool), o `''` si no eligió ninguno."""
    from comun.claves import clave
    return (mapa() if m is None else m).get(clave(nombre), '')


def _self_check():
    """Que `''` y lo raro no pasen, y que la clave sea la del perfil (sin bandera, sin tildes)."""
    malos = 0
    m = _limpio({'erian': 'URBF', 'litkunai': '', 'x': 'urbf', 'y': 'DEMASIADO', 'agustin51k': 'URBF'})
    casos = [
        (de('Erian 🇵🇦', m), 'URBF'),
        (de('AGUSTÍN51K', m), 'URBF'),
        (de('litkunai', m), ''),       # «ninguno»
        (de('x', m), ''),               # minúsculas: no es una sigla
        (de('y', m), ''),               # seis letras: tampoco
        (de('Nadie', m), ''),           # no eligió
    ]
    for got, want in casos:
        if got != want:
            malos += 1
            print('   🔴 esperaba %r y dio %r' % (want, got))
    return malos


if __name__ == '__main__':
    malos = _self_check()
    m = mapa()
    print('servidor elegido: %d en la copia%s' % (len(m), (' · ' + ', '.join('%s=%s' % kv for kv in m.items())) if m else ''))
    print('self-check:', 'ok' if not malos else '%d mal' % malos)
    sys.exit(1 if malos else 0)
