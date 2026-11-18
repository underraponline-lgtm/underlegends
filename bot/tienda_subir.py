"""🛍️ Sube el catálogo de la Tienda al objeto (`/avisos/tienda-catalogo`, con la clave del ciclo).

EL CATÁLOGO NO VIVE EN ESTE REPO, que es público: las piezas, sus nombres y sus precios son una sorpresa hasta el
lanzamiento. Vive afuera (el archivo privado de Dlx) y se sube desde ahí:

    python bot/tienda_subir.py <ruta/al/catalogo.json>             # lo revisa y dice qué cambiaría, sin subir nada
    python bot/tienda_subir.py <ruta/al/catalogo.json> --aplicar   # lo sube
    python bot/tienda_subir.py <ruta> --aplicar --forzar           # aunque suba un precio (no se hace: los precios no suben)

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
    for k in (c.get('vitrina') or {}).get('ids') or []:
        if k not in piezas:
            mal.append('la vitrina nombra una pieza que no existe: ' + k)
    for k, j in (c.get('colecciones') or {}).items():
        for x in j.get('piezas') or []:
            if x not in piezas:
                mal.append(f'la colección {k} nombra una pieza que no existe: {x}')
    return mal


def resumen(c):
    piezas = c.get('piezas') or {}
    por = {}
    for p in piezas.values():
        por[p['c']] = por.get(p['c'], 0) + 1
    return (f"{len(piezas)} piezas ({', '.join(f'{k} {v}' for k, v in sorted(por.items()))}) · vitrina "
            f"{len((c.get('vitrina') or {}).get('ids') or [])} · colecciones {len(c.get('colecciones') or {})} · "
            f"ediciones {len(c.get('ediciones') or {})} · {'ABIERTA' if c.get('abierta') else 'cerrada (sólo el dueño)'}")


def main(argv):
    rutas = [a for a in argv if not a.startswith('--')]
    if not rutas:
        print(__doc__)
        return 2
    with io.open(rutas[0], encoding='utf-8') as f:
        c = json.load(f)
    mal = revisar(c)
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
    return 0 if r.ok else 1


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main(sys.argv[1:]))
