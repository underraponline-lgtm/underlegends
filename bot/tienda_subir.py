"""🛍️ Sube el catálogo de la Tienda al objeto (`/avisos/tienda-catalogo`, con la clave del ciclo).

EL CATÁLOGO NO VIVE EN ESTE REPO, que es público: las piezas, sus nombres y sus precios son una sorpresa hasta el
lanzamiento. Vive afuera (el archivo privado de Dlx) y se sube desde ahí:

    python bot/tienda_subir.py <ruta/al/catalogo.json>             # lo revisa y dice qué cambiaría, sin subir nada
    python bot/tienda_subir.py <ruta/al/catalogo.json> --aplicar   # lo sube
    python bot/tienda_subir.py <ruta> --aplicar --forzar           # aunque suba un precio (no se hace: los precios no suben)
    python bot/tienda_subir.py <ruta> --aplicar --arte <arte.json> # y el arte: los moldes de cada pieza (también privado)

El objeto vuelve a validar todo (`catalogoValido()` de bot/tienda.js) y es quien cobra: este script sólo lo lleva. Al
guardarlo, si una pieza bajó de precio devuelve la diferencia a quien la compró en los últimos 14 días, y la lista de
deseos avisa lo que entró en la vitrina. Mientras el catálogo diga `"abierta": false`, la Tienda sólo la ve el dueño.
"""
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'
CATEGORIAS = {'aro', 'deco', 'nom', 'carta', 'perfil', 'serv', 'fp', 'fv', 'fe', 'fd', 'ff', 'fr'}
#: 🃏 cada efecto de carta es de UNA carta (28/11/2026, `CARTAS_FX` de bot/tienda.js)
CARTAS_FX = ('temporada', 'competitivo', 'servidor', 'pais')


def revisar(c):
    """Lo mismo que mira el objeto, para enterarse antes de subir. Devuelve la lista de problemas (vacía si está bien)."""
    mal = []
    if not isinstance(c, dict):
        return ['no es un objeto']
    pr = c.get('precios')
    if not (isinstance(pr, list) and len(pr) == 6 and all(isinstance(p, int) and 0 < p <= 10 ** 6 for p in pr)):
        mal.append('precios: seis enteros, uno por rareza')
    piezas = c.get('piezas') or {}
    for k, p in piezas.items():
        if not (isinstance(p, dict) and p.get('c') in CATEGORIAS and isinstance(p.get('r'), int) and 0 <= p['r'] <= 5):
            mal.append('pieza rota: ' + k)
        # 🃏 el objeto le pone Temporada a un efecto que no dice de qué carta es; acá se pide que lo diga, así el archivo
        # privado es la decisión entera y no un default (28/11/2026)
        elif p['c'] == 'carta' and p.get('carta') not in CARTAS_FX:
            mal.append('el efecto %s no dice de qué carta es (`carta`: %s)' % (k, ' · '.join(CARTAS_FX)))
        elif p['c'] == 'carta' and p.get('g') and (piezas.get(p['g']) or {}).get('carta') != p.get('carta'):
            mal.append('la versión %s es de otra carta que su pieza %s' % (k, p['g']))
    # 👑 las variantes y las versiones incluidas: la cabeza existe, es de la misma ranura y no es variante de otra. Una
    # versión incluida es de CUALQUIER pieza (28/11/2026: hasta hoy, sólo de una edición o una Premium)
    for k, p in piezas.items():
        if not isinstance(p, dict):
            continue
        g = p.get('g')
        if 'inc' in (p.get('t') or []) and not g:
            mal.append('la versión incluida %s no dice de qué pieza es (`g`)' % k)
        if g:
            cab = piezas.get(g)
            if not isinstance(cab, dict) or cab.get('c') != p.get('c') or cab.get('g'):
                mal.append('la variante %s es de %s, que no existe, es de otra ranura o es variante de otra' % (k, g))
    # 🎟️ las ediciones numeradas, de CUALQUIER rareza (28/11/2026, Dlx: «otras calidades pueden tener lo mismo»): cada una
    # es de una pieza con `num`, con 2 a 100 copias; y una pieza con `num` sin su edición no se vende nunca, sin avisar
    eds = c.get('ediciones') or {}
    for k, e in eds.items():
        p = piezas.get(k)
        if not isinstance(p, dict) or 'num' not in (p.get('t') or []):
            mal.append('la edición %s no es de una pieza numerada (`num`)' % k)
        elif not (isinstance(e, dict) and isinstance(e.get('copias'), int) and not isinstance(e.get('copias'), bool) and 2 <= e['copias'] <= 100):
            mal.append('la edición %s: `copias` es un entero de 2 a 100' % k)
    for k, p in piezas.items():
        if isinstance(p, dict) and 'num' in (p.get('t') or []) and k not in eds:
            mal.append('la pieza %s es numerada y no tiene edición: no se vendería nunca' % k)
    for k in (c.get('vitrina') or {}).get('ids') or []:
        if k not in piezas:
            mal.append('la vitrina nombra una pieza que no existe: ' + k)
    for k, j in (c.get('colecciones') or {}).items():
        for x in j.get('piezas') or []:
            if x not in piezas:
                mal.append(f'la colección {k} nombra una pieza que no existe: {x}')
        # 🧺 lo mismo que pide el objeto (`catalogoValido()`): de 2 a 12 piezas. Y sin numeradas: «comprar la colección»
        # las daría sin número (no pasa por `comprarNumerada()`) (28/11/2026)
        n = len(j.get('piezas') or [])
        if not 2 <= n <= 12:
            mal.append(f'la colección {k} tiene {n} piezas: van de 2 a 12')
        for x in j.get('piezas') or []:
            if 'num' in ((piezas.get(x) or {}).get('t') or []):
                mal.append(f'la colección {k} tiene una pieza numerada ({x}): comprándola junta saldría sin número')
    # ⏳ `hasta`: se vende hasta ese momento (ms) y no vuelve (28/11/2026, «Cierre de temporada»)
    for k, p in piezas.items():
        if isinstance(p, dict) and 'hasta' in p and not (isinstance(p['hasta'], int) and not isinstance(p['hasta'], bool) and p['hasta'] > 0):
            mal.append('la pieza %s: `hasta` es un momento en ms' % k)
    return mal


def resumen(c):
    piezas = c.get('piezas') or {}
    por = {}
    for p in piezas.values():
        por[p['c']] = por.get(p['c'], 0) + 1
    fx = {}
    for p in piezas.values():
        if p['c'] == 'carta':
            fx[p.get('carta') or 'temporada'] = fx.get(p.get('carta') or 'temporada', 0) + 1
    if fx:
        por['carta'] = '%d (%s)' % (por['carta'], ', '.join('%s %d' % (c, fx[c]) for c in CARTAS_FX if c in fx))
    return (f"{len(piezas)} piezas ({', '.join(f'{k} {v}' for k, v in sorted(por.items()))}) · vitrina "
            f"{len((c.get('vitrina') or {}).get('ids') or [])} · colecciones {len(c.get('colecciones') or {})} · "
            f"ediciones {_ediciones(c)} · {'ABIERTA' if c.get('abierta') else 'cerrada (sólo el dueño)'}")


def _ediciones(c):
    """cuántas ediciones y de qué rareza cada una (desde el 28/11/2026 pueden ser de cualquiera)"""
    eds, piezas = c.get('ediciones') or {}, c.get('piezas') or {}
    por = {}
    for k in eds:
        r = (piezas.get(k) or {}).get('r')
        por[r] = por.get(r, 0) + 1
    return '%d%s' % (len(eds), ' (' + ', '.join('rareza %s: %d' % (r, n) for r, n in sorted(por.items(), key=lambda x: -(x[0] or 0))) + ')' if eds else '')


def pelea(c, forzar=False):
    """⚔️ La pelea de la vitrina (21/11/2026): la Tienda promete que la pieza que junta más ♡ y compras vuelve en la
    próxima vitrina (`peleaVitrina()` de bot/tienda.js). Si este catálogo cambia la vitrina y deja afuera a la que va
    ganando, no se sube (con `--forzar`, sólo avisa). Sin conexión o sin pelea, no frena nada."""
    import requests
    try:
        vivo = (requests.post('https://underlegends.pages.dev/api/avisos/tienda', json={'anon': 1}, timeout=30).json() or {}).get('cat') or {}
    except (OSError, ValueError):
        print('  ⓘ no pude leer la pelea de la vitrina publicada')
        return []
    pe, antes = vivo.get('pelea') or {}, (vivo.get('vitrina') or {}).get('ids') or []
    gana, nueva = pe.get('gana'), ((c.get('vitrina') or {}).get('ids') or [])
    if not gana or nueva == antes:
        return []
    cu = (pe.get('cuenta') or {}).get(gana) or [0, 0]
    nombre = ((vivo.get('piezas') or {}).get(gana) or {}).get('n') or gana
    print('  ⚔️ ganó la pelea de la vitrina: %s (%s, %d ♡ y %d compras)' % (nombre, gana, cu[0], cu[1]))
    if gana in nueva:
        return []
    msj = 'la vitrina nueva deja afuera a la que ganó la pelea (%s): la Tienda promete que vuelve' % gana
    if forzar:
        print('  ⚠️', msj, '(--forzar: se sube igual)')
        return []
    return [msj]


def main(argv):
    rutas = [a for i, a in enumerate(argv) if not a.startswith('--') and not (i and argv[i - 1] == '--arte')]
    if not rutas:
        print(__doc__)
        return 2
    with io.open(rutas[0], encoding='utf-8') as f:
        c = json.load(f)
    mal = revisar(c) + pelea(c, '--forzar' in argv)
    print('catálogo:', resumen(c) if not mal else 'con problemas')
    for m in mal:
        print('  ❌', m)
    if mal:
        return 1
    if '--aplicar' not in argv:
        print('(sin --aplicar no se sube nada)')
        return 0
    import requests
    import clave_ciclo as CC
    import fotos as F
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        print('sin DISCORD_TOKEN: no puedo subir')
        return 1
    cuerpo = {'catalogo': c, 'forzar': '--forzar' in argv}
    r = requests.post(WORKER + '/avisos/tienda-catalogo', data=json.dumps(cuerpo, ensure_ascii=False).encode('utf-8'),
                      headers={'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'}, timeout=30)
    out = r.json() if r.headers.get('content-type', '').startswith('application/json') else {'texto': r.content.decode('utf-8', 'replace')[:200]}
    print(r.status_code, out)
    if not r.ok:
        return 1
    if '--arte' in argv:
        i = argv.index('--arte')
        with io.open(argv[i + 1], encoding='utf-8') as f:
            arte = json.load(f)
        r = requests.post(WORKER + '/avisos/tienda-arte-subir', data=json.dumps({'arte': arte}, ensure_ascii=False).encode('utf-8'),
                          headers={'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'}, timeout=60)
        print('arte:', r.status_code, r.json() if r.headers.get('content-type', '').startswith('application/json') else r.status_code)
        return 0 if r.ok else 1
    return 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main(sys.argv[1:]))
