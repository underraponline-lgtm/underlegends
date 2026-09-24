"""La bandera de un país — un solo lugar para las cuatro cartas.

    from comun.banderas import src
    src('co')   -> 'data:image/png;base64,...'   (04_Pais/banderas/co.png)
    src('zz')   -> 'https://flagcdn.com/w80/zz.png'
    src('')     -> ''   · sin dato no hay pieza

POR QUE VIVE ACA
----------------
⚠️ **Las cuatro cartas dibujan una bandera y tres la pedían a flagcdn
teniéndola en el repo.** `04_Pais/banderas/` tiene las dieciséis oficiales 3:2,
bajadas de ese mismo CDN cuando se preparó la carta de País. Pedirlas afuera
tiene tres costos y ninguno avisa:

| | |
|---|---|
| **sin internet no hay bandera** | y en Chromium aislado la carta sale sin ella, en silencio |
| **el exportador tiene que bajarlas** | una petición por carta y por país |
| **es peor imagen** | `w80` son 80 px de ancho; el archivo del repo tiene **1280** |

Ese último punto es el que sorprende: la bandera se dibuja en 36×24 en la
Competitiva y en 44×30 en la Temporada, así que bajar de 1280 da **mejor
resultado** que bajar de 80 — el navegador tiene con qué filtrar.

⚠️ **NO ES LA MISMA IMAGEN QUE USA LA CARTA DE PAÍS DE FONDO.** Esa sale de
`04_Pais/banderas_carta/`, que son las mismas **preparadas**: estiradas a la
proporción de la carta con los escudos y las estrellas sacados de la
deformación. Acá va la oficial 3:2, que es lo que corresponde a un chip.

⚠️ **EL FALLBACK AL CDN SE QUEDA.** Hoy están las dieciséis del pool, pero el
día que aparezca un país nuevo el archivo no va a estar y la carta tiene que
salir igual. Si algún día el CDN también falla, la pieza no se dibuja — que es
mejor que el ícono de imagen rota.
"""
import base64
import os

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
DIR = os.path.join(BASE, '04_Pais', 'banderas')
CDN = 'https://flagcdn.com/w80/%s.png'

_cache = {}


def ruta(cc):
    """El archivo de esa bandera, si está."""
    if not cc:
        return None
    p = os.path.join(DIR, '%s.png' % str(cc).lower())
    return p if os.path.exists(p) else None


def src(cc):
    """Lo que va en el `src` de un <img>. '' si no hay país.

    ⚠️ **SIN DATO NO HAY PIEZA.** Con `cc` vacío devuelve '' y quien llama no
    dibuja el chip. Antes la URL quedaba `flagcdn.com/w80/.png`, que da 404, y
    el navegador pintaba su ícono de imagen rota — peor que no mostrar nada.
    """
    if not cc:
        return ''
    cc = str(cc).lower()
    if cc not in _cache:
        p = ruta(cc)
        if p:
            with open(p, 'rb') as f:
                _cache[cc] = ('data:image/png;base64,'
                              + base64.b64encode(f.read()).decode())
        else:
            _cache[cc] = CDN % cc
    return _cache[cc]


def _self_check():
    import json
    hay = sorted(os.path.splitext(f)[0] for f in os.listdir(DIR)
                 if f.endswith('.png'))
    print('LAS BANDERAS\n')
    print('  en %s: %d  (%s)' % (os.path.relpath(DIR, BASE), len(hay),
                                 ' '.join(hay)))
    p = os.path.join(BASE, 'datos', 'competitivo_pool.json')
    if not os.path.exists(p):
        return
    with open(p, encoding='utf-8') as f:
        pool = json.load(f)
    usa = sorted({x['cc'] for x in pool if x['cc']})
    sin = [c for c in usa if not ruta(c)]
    nadie = [c for c in usa if not any(x['cc'] == c for x in pool)]
    print('  el pool usa %d paises' % len(usa))
    print('  del repo: %d · del CDN: %d  (%s)'
          % (len(usa) - len(sin), len(sin), ' '.join(sin) or '—'))
    n_sin_cc = sum(1 for x in pool if not x['cc'])
    print('  sin pais, no llevan pieza: %d' % n_sin_cc)


if __name__ == '__main__':
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    _self_check()
