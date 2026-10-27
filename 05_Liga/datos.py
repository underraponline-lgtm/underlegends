# -*- coding: utf-8 -*-
"""🏟️ LOS DATOS DE LA CARTA DE LIGA, de las ligas de producción (`bot/ligas.py`).

Lo mismo que muestra la página: `ligas.para_web()` con las claves de perfil que le pasa `subir_web.py` —la tabla, las
fechas con el PTB de cada batalla y `ks`, quién es quién—. Así la carta y la página no pueden decir dos cosas distintas
de la misma liga, y la carta de alguien queda bajo LA MISMA clave que su perfil.

La carta se dibuja con `carta.py`, que nació en la maqueta (artifact CLDPA3E94eRzjRybpwwywB, v14) y pide estos nombres:
`POR`, `COLOR`, `logo()`, `forma()`, `carrera()`, `puesto_antes()`, `avatar()`, `PINCEL`, `MASCARA`.
"""
import base64
import collections
import io
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(AQUI)
for _p in (BASE, os.path.join(BASE, 'bot'), os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from comun import respaldo as RS  # noqa: E402

with io.open(os.path.join(BASE, 'datos', 'colores_sv_marca.json'), encoding='utf-8') as _f:
    COLOR = json.load(_f)['usar']

POR = {}


def cargar(web=None):
    """Llena `POR` = `{liga: {n, sv, tabla, fechas, ks}}` con las ligas que tienen batallas. `web`: el resultado de
    `ligas.para_web()` ya armado (para probar sin el padrón)."""
    if web is None:
        import ligas as LG
        import subir_web as SW
        with io.open(os.path.join(BASE, 'datos', 'padron.json'), encoding='utf-8') as f:
            padron = json.load(f) or []
        # 🔑 LAS MISMAS CLAVES QUE LA PÁGINA: `subir_web._clave()`, con sus choques. Una clave calculada de otra manera
        # dejaría a alguien con su carta subida bajo un nombre y su perfil bajo otro: no la vería nunca
        claves = {p['raw']: SW._clave(p) for p in padron if p.get('raw')}
        web = LG.para_web(claves=claves) or {}
    POR.clear()
    for L in web.get('ligas') or []:
        if L.get('tabla'):
            POR[L['id']] = {'n': L['n'], 'sv': L['sv'], 'tabla': [list(f) for f in L['tabla']],
                            'fechas': L.get('fechas') or [], 'ks': L.get('ks') or {}}
    return POR


def _uri(ruta, mime='image/webp'):
    with open(ruta, 'rb') as f:
        return 'data:%s;base64,%s' % (mime, base64.b64encode(f.read()).decode())


_LOGO = {}


def logo(sv, px=28):
    """El logo del servidor de la liga, de `05_Liga/logos/` (los mismos de la página). Sin archivo, su inicial."""
    if sv not in _LOGO:
        p = os.path.join(AQUI, 'logos', 'logo_%s.webp' % sv)
        _LOGO[sv] = _uri(p) if os.path.exists(p) else ''
    if _LOGO[sv]:
        return "<img class='lg-logo' src='%s' alt='%s' style='width:%dpx;height:%dpx'>" % (_LOGO[sv], sv, px, px)
    return "<i class='lg-logo ini' style='width:%dpx;height:%dpx'>%s</i>" % (px, px, (sv or '?')[0])


def _con_ganador(lid):
    """Las batallas con resultado, de la más vieja a la más nueva. Sin las pendientes: una batalla sin veredicto no es
    una derrota (la maqueta las contaba como «P»)."""
    for f in sorted(POR[lid]['fechas'], key=lambda f: f['t']):
        yield f, [b for b in f['b'] if b[2]]


def forma(lid, n, k=5):
    """Las últimas `k`: 'g' ganó, 'r' perdió en réplica (1 pto), 'p' perdió."""
    out = []
    for _f, bs in _con_ganador(lid):
        for b in bs:
            if n in (b[0], b[1]):
                out.append('g' if b[2] == n else ('r' if b[3] == 'replica' else 'p'))
    return out[-k:]


def _corrida(lid, desde):
    pts = collections.Counter()
    out = []
    nombres = {f[0] for f in POR[lid]['tabla']}
    for f, bs in _con_ganador(lid):
        if f.get('d', '') < desde:
            continue
        for b in bs:
            if b[0] not in nombres or b[1] not in nombres:   # sin los invitados (ExtraPlayers), como la tabla
                continue
            per = b[1] if b[2] == b[0] else b[0]
            pts[b[2]] += 2 if b[3] == 'replica' else 3
            pts[per] += 1 if b[3] == 'replica' else 0
        out.append((f, dict(pts)))
    return out


_CARRERA = {}


def carrera(lid):
    """`[(fecha, {nombre: puntos acumulados})]`. Arranca en la fecha que hace que la carrera termine IGUAL a su tabla
    (directa 3/0, réplica 2/1): una liga que paró y volvió a empezar cuenta desde la vuelta, como su tabla."""
    if lid in _CARRERA:
        return _CARRERA[lid]
    tabla = {f[0]: f[3] for f in POR[lid]['tabla']}
    mejor = None
    for d in sorted({f.get('d', '') for f in POR[lid]['fechas']}) + ['']:
        c = _corrida(lid, d)
        fin = c[-1][1] if c else {}
        mal = sum(abs(fin.get(n, 0) - v) for n, v in tabla.items())
        if mejor is None or mal < mejor[0]:
            mejor = (mal, c)
    _CARRERA[lid] = mejor[1] if mejor else []
    return _CARRERA[lid]


def puesto_antes(lid):
    """`({nombre: puesto antes de la última fecha}, número de la fecha)`. Sin número de jornada (Snake, Albiceleste…),
    la cuenta de las fechas que hubo."""
    cs = carrera(lid)
    if len(cs) < 2:
        return {}, len(cs)
    pts = cs[-2][1]
    return {n: i for i, n in enumerate(sorted(pts, key=lambda n: -pts[n]))}, cs[-1][0].get('j') or len(cs)


#: la cara: con `FOTO_FICHA` en vez de la imagen, para el sello (`ciclo.py`), que no necesita bajar las fotos para saber
#: si una cambió
FOTO_FICHA = [False]


def avatar(lid, n):
    if FOTO_FICHA[0]:
        return ficha_foto(n)
    try:
        return RS.avatar(n) or ''
    except Exception:                                    # noqa: BLE001
        return ''


def ficha_foto(n):
    """Qué foto tendría esa persona, sin bajarla: oculta, o la versión de R2 (`datos/fotos_etag.json`, por clave)."""
    from comun.claves import clave
    try:
        if RS.oculta(n):
            return ''
    except Exception:                                    # noqa: BLE001
        pass
    if '_ETAG' not in _LOGO:
        try:
            with io.open(os.path.join(BASE, 'datos', 'fotos_etag.json'), encoding='utf-8') as f:
                _LOGO['_ETAG'] = json.load(f) or {}
        except (OSError, ValueError):
            _LOGO['_ETAG'] = {}
    return 'FOTO:%s' % (_LOGO['_ETAG'].get(clave(n)) or '')


# ── dos piezas de la maqueta del afiche (gen_afiche.py) ──────────────────────────────────────────────────────────────
MASCARA = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 240' preserveAspectRatio='none'>"
           "<filter id='d'><feTurbulence type='fractalNoise' baseFrequency='.045' numOctaves='3' seed='4'/>"
           "<feDisplacementMap in='SourceGraphic' scale='26'/></filter>"
           "<rect x='14' y='10' width='172' height='218' fill='white' filter='url(%23d)'/></svg>")
PINCEL = ("<svg class='af-pin' viewBox='0 0 300 120' preserveAspectRatio='none' aria-hidden='true'><filter id='pr'>"
          "<feTurbulence type='fractalNoise' baseFrequency='.06' numOctaves='3' seed='9'/><feDisplacementMap in='SourceGraphic' scale='18'/>"
          "</filter><path d='M8 70 C 60 20, 150 30, 292 18 L 296 88 C 200 104, 90 112, 4 104 Z' fill='currentColor' filter='url(#pr)'/></svg>")
