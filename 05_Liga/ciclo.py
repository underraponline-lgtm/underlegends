# -*- coding: utf-8 -*-
"""🏟️ Las cartas de liga, en el ciclo (paso 2b9c de `bot/pipeline.py`, en `escuchar`, antes de la web).

    python 05_Liga/ciclo.py              # en seco: cuántas cambiaron
    python 05_Liga/ciclo.py --aplicar    # dibuja las que cambiaron, las sube a R2 y deja el índice
    python 05_Liga/ciclo.py --aplicar --todas   # todas, aunque el sello diga que no cambiaron

Una carta por persona y por liga que juega (Dlx, 26/10/2026: «todas las personas de las ligas tengan su tarjeta de
ligas»). Sólo la de quien tiene perfil (`ks` de la liga, la misma clave que su perfil): sin perfil no hay cuenta que la
abra. En R2: `<clave>/liga-<liga>.webp` (y `.chica.webp`).

🔑 EL SELLO ES EL HASH DE LA CARTA, como el de la Bloqueada (CLAUDE.md): el HTML que se va a dibujar, con la foto
reemplazada por su ficha (la versión de R2, `datos/fotos_etag.json`) —así se sabe si cambió sin bajar las fotos—, más
el CSS y las fuentes. Ve los datos Y el código: «una cache que mira los datos no ve el código».

📇 EL ÍNDICE ES EL MISMO ARCHIVO: `datos/cartas_liga.json` = `{cartas: {liga: {clave: [sello, ovr, puesto]}}}`. Lo lee
`subir_web.py` (paso 2c) para que la página y `/card` sepan quién tiene cuál, con qué versión y cuál es su mejor carta.
Va en `ARCHIVOS` de `bot/ci/guardar.sh`: un sello que no sobrevive al runner redibuja todo cada media hora.
"""
import hashlib
import io
import json
import os
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(AQUI)
for _p in (AQUI, BASE, os.path.join(BASE, 'bot')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
import carta as C  # noqa: E402
import datos as D  # noqa: E402

INDICE = os.path.join(BASE, 'datos', 'cartas_liga.json')


def leer():
    try:
        with io.open(INDICE, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def escribir(cartas):
    d = {'_leeme': 'Las cartas de liga subidas a R2: {liga: {clave: [sello, ovr, puesto desde 1]}}. Lo escribe 05_Liga/ciclo.py '
                   '(paso 2b9c) y lo lee subir_web.py. La imagen: <r2>/<clave>/liga-<liga>.webp?v=<sello>.',
         'cartas': {l: dict(sorted(v.items())) for l, v in sorted(cartas.items()) if v}}
    with io.open(INDICE, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
        f.write('\n')


def codigo():
    """Lo que cambia el dibujo y no está en el HTML de cada carta: el CSS, los filtros y las fuentes."""
    with io.open(os.path.join(AQUI, 'fuentes.css'), encoding='utf-8') as f:
        fu = f.read()
    return hashlib.sha1((C.armar_css() + C.DEFS + fu).encode('utf-8')).hexdigest()[:10]


def quienes():
    """`[(liga, i, clave)]`: cada fila de cada tabla con perfil."""
    out = []
    for lid, L in D.POR.items():
        for i, f in enumerate(L['tabla']):
            k = L['ks'].get(f[0])
            if k:
                out.append((lid, i, k))
        # 👑 y la del dueño, en todas (`carta.DUENO`), salvo que ya juegue esa liga
        if not any(k == C.DUENO[1] for l, _i, k in out if l == lid):
            out.append((lid, None, C.DUENO[1]))
    return out


def sellos(trabajos):
    """`{(liga, clave): (sello, ovr, puesto)}`, sin bajar ninguna foto."""
    cod = codigo()
    D.FOTO_FICHA[0] = True
    try:
        out = {}
        for lid, i, k in trabajos:
            h = hashlib.sha1((C.carta(lid, i) + cod).encode('utf-8')).hexdigest()[:10]
            out[(lid, k)] = (h, 0, 0) if i is None else (h, C.ovr_liga(lid).get(D.POR[lid]['tabla'][i][0], (0, 0))[0], i + 1)
        return out
    finally:
        D.FOTO_FICHA[0] = False


def caras():
    """El espejo de las fotos (`bot/fotos.py`), sólo cuando hay algo que dibujar: un runner limpio no las trae."""
    try:
        import fotos as FT
        import requests
        s = requests.Session()
        s.headers['Authorization'] = 'Bearer ' + FT.env('CLOUDFLARE_API_TOKEN')
        FT.espejo(s)
    except Exception as e:                               # noqa: BLE001
        print('      ⚠️ sin espejo de fotos (%s): dibujo con las caras que haya' % str(e)[:70])


def subir(hechos):
    """Sube cada PNG a `<clave>/liga-<liga>.webp` y su chica. Devuelve las que subieron."""
    import subir_cartas as SC
    from concurrent.futures import ThreadPoolExecutor
    s = SC.sesion()

    def uno(par):
        (lid, k), ruta = par
        clave_r2 = '%s/liga-%s.webp' % (k, lid)
        r = SC.subir(s, ruta, clave_r2)
        if r[0] is None:
            return par[0], r[1]
        try:
            with open(ruta, 'rb') as f:
                s.put('%s/objects/%s' % (SC.API, SC.clave_chica(clave_r2)), data=SC.a_chica(f.read()),
                      headers={'Content-Type': 'image/webp'}, timeout=60)
        except Exception:                                # noqa: BLE001
            pass                                         # la página vuelve a la grande
        return par[0], ''

    ok, mal = set(), []
    with ThreadPoolExecutor(4) as ex:
        for par, err in ex.map(uno, hechos.items()):
            (mal.append((par, err)) if err else ok.add(par))
    for par, err in mal[:6]:
        print('      ⚠️ no subió %s/%s: %s' % (par[1], par[0], err))
    return ok


def correr(aplicar=False, todas=False, tope=None):
    t0 = time.time()
    D.cargar()
    trabajos = quienes()
    nuevos = sellos(trabajos)
    viejo = (leer().get('cartas') or {})
    cambian = [(l, i, k) for l, i, k in trabajos
               if todas or (viejo.get(l) or {}).get(k, [None])[0] != nuevos[(l, k)][0]]
    print('      🏟️ %d carta(s) de liga en %d ligas · %d cambiaron%s' % (
        len(trabajos), len(D.POR), len(cambian), '' if aplicar else ' (en seco)'))
    if tope and len(cambian) > tope:
        print('      ⏳ dibujo %d ahora y el resto en la próxima vuelta' % tope)
        cambian = cambian[:tope]
    indice = {}
    vivos = {(l, k) for l, _i, k in trabajos}
    for l, v in viejo.items():
        for k, x in v.items():
            if (l, k) in vivos:
                indice.setdefault(l, {})[k] = x
    if not aplicar or not cambian:
        if aplicar and indice != viejo:
            escribir(indice)     # alguien que salió de una tabla: fuera del índice
        return 0
    caras()
    import navegador     # Chromium, sólo cuando hay que dibujar (bot/navegador.py)
    navegador.hace_falta()
    import exportar as EX
    hechos, malos = EX.dibujar(cambian)
    for l, k, m in malos[:6]:
        print('      ⚠️ %s · %s: %s' % (l, k, m))
    ok = subir(hechos)
    for par in ok:
        indice.setdefault(par[0], {})[par[1]] = list(nuevos[par])
    escribir(indice)
    print('      🏟️ %d subida(s) en %.0f s' % (len(ok), time.time() - t0))
    return 0 if len(ok) == len(cambian) else 1


if __name__ == '__main__':
    tope = None
    if '--tope' in sys.argv:
        tope = int(sys.argv[sys.argv.index('--tope') + 1])
    sys.exit(correr('--aplicar' in sys.argv, '--todas' in sys.argv, tope))
