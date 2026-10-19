# -*- coding: utf-8 -*-
"""🗳️ LO QUE PASA EN EL BOT EN VIVO Y LO MIRAN LOS TAGS (19/10/2026, el TAG 🗳️ FAVORITO DEL PÚBLICO que aprobó Dlx).

    python bot/hechos_vivo.py          baja `/avisos/favoritos` del objeto a datos/favoritos.json (sólo si cambió)
    python bot/hechos_vivo.py --auto   el self-check, sin red

🔑 POR QUÉ UN ARCHIVO Y NO UNA LECTURA DESDE LA CARTA: los TAGs salen de `sheet/hechos_tags.py`, que lee sólo `datos/`,
y el sello de las cartas los ve porque entran a la fila (`tg_t`). Leído desde el generador, la carta no se enteraría.

⚠️ VA EN EL PASO 0a2 DE `bot/pipeline.py`, antes de los pools (paso 2), que son los que arman `tg_t`. Sin red, queda el
de la corrida anterior: un TAG una corrida tarde no rompe nada.

Lo que baja son NOMBRES como los escribe la llave (`{nombre: veces}`), sin ningún Discord ID: la clave la pone
`hechos_tags`, que resuelve los nombres igual que para las llaves.
"""
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUTA = os.path.join(BASE, 'datos', 'favoritos.json')
URL = 'https://liga-global-bot.liga-global-ul.workers.dev/avisos/favoritos'


def armar(pub):
    """El archivo, sin la hora (si no, cambiaría en cada corrida y sería un commit por nada)."""
    n = {str(k): int(v) for k, v in ((pub or {}).get('n') or {}).items() if str(k).strip() and int(v or 0) > 0}
    return {'_leeme': 'Cuántas veces el público votó a cada uno como ganador en el bot en vivo, en la temporada '
                      '(`favoritos()` del objeto). Lo escribe bot/hechos_vivo.py; lo lee sheet/hechos_tags.py',
            'temporada': (pub or {}).get('temporada') or '', 'n': dict(sorted(n.items()))}


def escribir(d):
    nuevo = json.dumps(d, ensure_ascii=False, indent=1) + '\n'
    try:
        with io.open(RUTA, encoding='utf-8') as f:
            if f.read() == nuevo:
                return False
    except OSError:
        pass
    with io.open(RUTA, 'w', encoding='utf-8', newline='\n') as f:
        f.write(nuevo)
    return True


def bajar():
    try:
        import requests
        r = requests.get(URL, timeout=15)
        r.raise_for_status()
        pub = r.json()  # ⚠️ `r.json()` y no `json.loads(r.text)`: sin charset, `requests` adivina (CLAUDE.md)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude leer los votos del bot en vivo (%s): quedan los de antes' % str(e)[:80])
        return 0
    d = armar(pub)
    c = escribir(d)
    print('   🗳️ %d con votos del público%s' % (len(d['n']), ' · datos/favoritos.json cambió' if c else ''))
    return 0


def _auto():
    a = armar({'t': 1, 'temporada': 't1', 'n': {'Beto': 2, 'Ana': 5, ' ': 3, 'Cyn': 0}})
    bien = a['n'] == {'Ana': 5, 'Beto': 2} and list(a['n']) == ['Ana', 'Beto'] and a['temporada'] == 't1' and 't' not in a
    print(('   ✅ ' if bien else '   🔴 ') + 'armar: sin la hora, sin vacíos ni ceros, en orden')
    return 0 if bien else 1


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(_auto())
    sys.exit(bajar())
