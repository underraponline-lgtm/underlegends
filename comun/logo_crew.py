# -*- coding: utf-8 -*-
"""🛡️ EL LOGO DE LA CREW DE CADA UNO, PARA LAS CARTAS (Dlx, 24/11/2026, a la carta de Temporada: «debajo del servidor
ahora estará el logo de la crew»).

    from comun import logo_crew as LC
    LC.de('makmah')        -> 'https://…r2.dev/logos-crews/….webp'   (la imagen que subió su crew)
    LC.de('oasis')         -> 'data:image/svg+xml;base64,…'           (su escudo armado)
    LC.de('nadie')         -> ''                                      (sin crew no hay pieza)
    python comun/logo_crew.py         el self-check

DE DÓNDE SALE, en el orden en que se pregunta (el mismo de la página, `escudoDe()` de web/src/escudo.jsx):
  1. la crew de la persona: `datos/crews_vivas.json` (las crews de la gente, `bot/crews_vivas.py`), por su clave;
  2. su `logo` si es una imagen (R2);
  3. si es un escudo armado (`esc:forma.simbolo.a.b[.division.borde.c][.SIGLA]`), dibujado acá en SVG;
  4. sin logo: el PNG oficial de `comun/logos_crew/<id>.png` si la crew es de las de antes (Follombia, KS);
  5. y si tampoco, el escudo que sale de su nombre (`delNombre()`), siempre el mismo — como en la página.

⚠️ ES UNA COPIA DE web/src/escudo.jsx, Y LO ES A PROPÓSITO: la carta se dibuja en Python y la página en React. Los
catálogos (formas, símbolos, colores, divisiones) y el hash de `delNombre()` tienen que ser IGUALES, o la misma crew
lleva un escudo en la página y otro en su carta. El self-check compara los catálogos contra el .jsx.
"""
import base64
import json
import os
import re
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
VIVAS = os.path.join(BASE, 'datos', 'crews_vivas.json')
OFICIALES = os.path.join(SCR, 'logos_crew')
JSX = os.path.join(BASE, 'web', 'src', 'escudo.jsx')

FORMAS = {
    'escudo': 'M50 4 L92 16 L92 52 C92 76 72 90 50 98 C28 90 8 76 8 52 L8 16 Z',
    'circulo': 'M50 4 A46 46 0 1 1 49.9 4 Z',
    'hexagono': 'M50 3 L92 27 L92 73 L50 97 L8 73 L8 27 Z',
    'rombo': 'M50 2 L98 50 L50 98 L2 50 Z',
    'estandarte': 'M12 4 H88 V96 L50 78 L12 96 Z',
    'octagono': 'M32 4 H68 L96 32 V68 L68 96 H32 L4 68 V32 Z',
    'redondo': 'M8 6 H92 V46 C92 72 74 88 50 97 C26 88 8 72 8 46 Z',
    'biselado': 'M20 4 H80 L96 20 V80 L80 96 H20 L4 80 V20 Z',
}
SIMBOLOS = {
    'corona': 'M24 64 L28 36 L40 50 L50 30 L60 50 L72 36 L76 64 Z M26 70 H74 V76 H26 Z',
    'micro': 'M42 24 a8 8 0 0 1 16 0 V50 a8 8 0 0 1 -16 0 Z M34 46 a16 16 0 0 0 32 0 M50 62 V74 M40 76 H60',
    'llama': 'M50 22 C60 36 68 42 66 56 C64 68 56 76 50 76 C42 76 34 68 34 58 C34 48 42 46 44 36 C48 44 50 44 50 22 Z',
    'rayo': 'M56 20 L36 54 H50 L44 80 L66 44 H52 Z',
    'estrella': 'M50 20 L58 42 L82 42 L62 56 L70 80 L50 66 L30 80 L38 56 L18 42 L42 42 Z',
    'calavera': 'M30 48 a20 20 0 1 1 40 0 V60 H62 V70 H38 V60 H30 Z M40 46 a5 5 0 1 0 0.1 0 M60 46 a5 5 0 1 0 0.1 0',
    'diamante': 'M32 34 H68 L80 48 L50 80 L20 48 Z',
    'ojo': 'M18 50 C30 32 70 32 82 50 C70 68 30 68 18 50 Z M50 41 a9 9 0 1 0 0.1 0',
    'puno': 'M32 46 V36 a5 5 0 0 1 10 0 V44 M42 44 V32 a5 5 0 0 1 10 0 V44 M52 44 V34 a5 5 0 0 1 10 0 V46 M62 46 V40 a5 5 0 0 1 10 0 V58 C72 70 64 78 52 78 H44 C36 78 30 70 30 60 V50 Z',
    'alas': 'M50 64 C40 52 26 50 16 36 C30 38 38 40 50 50 C62 40 70 38 84 36 C74 50 60 52 50 64 Z',
    'espadas': 'M26 26 L74 74 M74 26 L26 74 M22 66 L34 78 M66 78 L78 66',
    'auriculares': 'M28 62 V50 a22 22 0 0 1 44 0 V62 M24 58 h8 v18 h-8 Z M68 58 h8 v18 h-8 Z',
    'vinilo': 'M50 22 a28 28 0 1 1 -0.1 0 Z M50 44 a6 6 0 1 0 0.1 0 Z',
    'ancla': 'M50 30 V78 M38 38 H62 M26 58 C28 72 40 78 50 78 C60 78 72 72 74 58 M50 20 a5 5 0 1 0 0.1 0',
    'luna': 'M58 20 A30 30 0 1 0 80 64 A24 24 0 1 1 58 20 Z',
    'sol': 'M50 38 a12 12 0 1 0 0.1 0 M50 20 V28 M50 72 V80 M20 50 H28 M72 50 H80 M29 29 L35 35 M65 65 L71 71 M71 29 L65 35 M35 65 L29 71',
    'trofeo': 'M34 24 H66 V40 C66 52 58 58 50 58 C42 58 34 52 34 40 Z M46 58 H54 V70 H62 V76 H38 V70 H46 Z',
    'dado': 'M26 26 H74 V74 H26 Z M38 33 a5 5 0 1 0 0.1 0 Z M62 57 a5 5 0 1 0 0.1 0 Z M50 45 a5 5 0 1 0 0.1 0 Z',
    'laurel': 'M40 80 C20 70 16 46 28 24 M60 80 C80 70 84 46 72 24 M27 66 l-12 -6 M21 50 l-11 -9 M23 35 l-7 -12 M73 66 l12 -6 M79 50 l11 -9 M77 35 l7 -12',
    'spray': 'M40 36 H60 V78 H40 Z M44 28 H56 V36 H44 Z M64 22 h4 M66 30 h6 M64 38 h4',
    'sigla': '',
}
TRAZO = {'micro', 'espadas', 'auriculares', 'ancla', 'sol', 'laurel'}
HUECOS = {'vinilo', 'dado'}
COLORES = ['e41373', '29b298', 'f2b705', '2f6fdb', 'e5484d', '9b5cff', '0e0e10', 'f6f6f6', 'ff7a1a', '5fc8c0',
           'c9a227', 'b8bcc4', '7a1f3d', '1b2a4a', '9be22d', 'ff8fc7']
DIVISIONES = {
    'liso': '',
    'partido': 'M0 0 H50 V100 H0 Z',
    'cortado': 'M0 0 H100 V50 H0 Z',
    'banda': 'M0 0 H30 L100 70 V100 H70 L0 30 Z',
    'franja': 'M36 0 H64 V100 H36 Z',
    'chevron': 'M0 70 L50 40 L100 70 V100 L50 70 L0 100 Z',
    'cuartelado': 'M0 0 H50 V50 H0 Z M50 50 H100 V100 H50 Z',
}
BORDES = ['fino', 'grueso', 'doble']
FORMAS_ANTES = ['escudo', 'circulo', 'hexagono', 'rombo']
SIMBOLOS_ANTES = ['corona', 'micro', 'llama', 'rayo', 'estrella', 'calavera', 'diamante', 'ojo', 'puno', 'alas']
COLORES_ANTES = COLORES[:10]

_ESC = re.compile(r'^esc:([a-z]+)\.([a-z]+)\.([0-9a-f]{6})\.([0-9a-f]{6})(?:\.([a-z]+)\.([a-z]+)\.([0-9a-f]{6}))?'
                  r'(?:\.([^\W_a-z]{2,4}))?$')


def leer(logo):
    """`{forma, simb, a, b, div, borde, c, sigla}` de un `esc:…`, o None (`leerEscudo()` de escudo.jsx)."""
    m = _ESC.match(unicodedata.normalize('NFC', str(logo or '')))
    if not m or m.group(1) not in FORMAS or m.group(2) not in SIMBOLOS or m.group(3) not in COLORES or m.group(4) not in COLORES:
        return None
    sigla = m.group(8) or ''
    if sigla and (sigla.lower() == sigla):          # la sigla va en mayúsculas o números, como en el .jsx (\p{Lu}\p{Lo}\p{N})
        if not all(ch.isdigit() or unicodedata.category(ch) == 'Lo' for ch in sigla):
            return None
    e = {'forma': m.group(1), 'simb': m.group(2), 'a': m.group(3), 'b': m.group(4), 'div': 'liso', 'borde': 'fino',
         'c': m.group(4), 'sigla': sigla}
    if m.group(5) is not None:
        if m.group(5) not in DIVISIONES or m.group(6) not in BORDES or m.group(7) not in COLORES:
            return None
        e.update(div=m.group(5), borde=m.group(6), c=m.group(7))
    return e


def _hash(s):
    """FNV-1a de 32 bits sobre los puntos de código, como `hash()` de escudo.jsx (`Math.imul` y `>>> 0`)."""
    h = 2166136261
    for ch in str(s):
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def del_nombre(nombre):
    """El escudo de una crew sin logo, sacado de su nombre: siempre el mismo (`delNombre()` de escudo.jsx)."""
    h = _hash(str(nombre or '').lower().strip())
    e = {'forma': FORMAS_ANTES[h % len(FORMAS_ANTES)], 'simb': SIMBOLOS_ANTES[(h >> 3) % len(SIMBOLOS_ANTES)],
         'a': COLORES_ANTES[(h >> 7) % len(COLORES_ANTES)], 'b': COLORES_ANTES[(h >> 11) % len(COLORES_ANTES)],
         'div': 'liso', 'borde': 'fino', 'sigla': ''}
    if e['b'] == e['a']:
        e['b'] = '0e0e10' if e['a'] == 'f6f6f6' else 'f6f6f6'
    e['c'] = e['b']
    return e


def svg(e, sigla=''):
    """El escudo en SVG, 100 × 100 (`Escudo` de escudo.jsx)."""
    trazo = e['simb'] in TRAZO
    div = DIVISIONES.get(e.get('div') or 'liso', '')
    c = '#' + (e.get('c') or e['b'])
    borde = e.get('borde') or 'fino'
    p = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">']
    if div:
        p.append('<defs><clipPath id="k"><path d="%s"/></clipPath></defs>' % FORMAS[e['forma']])
    p.append('<path d="%s" fill="#%s"/>' % (FORMAS[e['forma']], e['a']))
    if div:
        p.append('<path d="%s" fill="%s" clip-path="url(#k)"/>' % (div, c))
    p.append('<path d="%s" fill="none" stroke="#030304" stroke-width="%d" stroke-linejoin="round"/>'
             % (FORMAS[e['forma']], 8 if borde == 'grueso' else 4))
    if borde == 'doble':
        p.append('<path d="%s" fill="none" stroke="%s" stroke-width="3" stroke-linejoin="round" '
                 'transform="translate(50 50) scale(0.84) translate(-50 -50)"/>' % (FORMAS[e['forma']], c))
    if e['simb'] == 'sigla':
        txt = (e.get('sigla') or sigla or '?')[:4]
        tam = 36 if len(txt) <= 2 else 29 if len(txt) == 3 else 23
        txt = txt.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        p.append('<text x="50" y="50" dy="0.35em" text-anchor="middle" font-size="%d" font-weight="900" fill="#%s" '
                 'stroke="#030304" stroke-width="2" paint-order="stroke" '
                 'style="font-family:Archivo,sans-serif;letter-spacing:-0.02em">%s</text>' % (tam, e['b'], txt))
    else:
        p.append('<path d="%s" fill="%s"%s stroke="#%s" stroke-width="%d" stroke-linejoin="round" stroke-linecap="round"/>'
                 % (SIMBOLOS[e['simb']], 'none' if trazo else '#' + e['b'],
                    ' fill-rule="evenodd"' if e['simb'] in HUECOS else '', e['b'], 6 if trazo else 2))
    p.append('</svg>')
    return ''.join(p)


def _data_svg(s):
    return 'data:image/svg+xml;base64,' + base64.b64encode(s.encode('utf-8')).decode('ascii')


_CACHE = {}


def _crews():
    if 'crews' not in _CACHE:
        try:
            _CACHE['crews'] = (json.load(open(VIVAS, encoding='utf-8')) or {}).get('crews') or []
        except (OSError, ValueError):
            _CACHE['crews'] = []
    return _CACHE['crews']


def crew_de(clave):
    """La crew (la fila de crews_vivas.json) de esa clave de perfil, o None."""
    k = str(clave or '').strip().lower()
    if not k:
        return None
    for c in _crews():
        if any(g and str(g[0]).lower() == k for g in c.get('gente') or []):
            return c
    return None


def src(c):
    """El `src` del logo de una crew (su fila de crews_vivas.json): la imagen, el escudo armado, el oficial o el de su
    nombre. Vacío sólo si no hay crew."""
    if not c:
        return ''
    logo = str(c.get('logo') or '')
    if re.match(r'^https://[^\s"\'<>]+$', logo):
        return logo
    e = leer(logo) if logo.startswith('esc:') else None
    if e:
        return _data_svg(svg(e, c.get('sigla') or ''))
    for ext in ('png', 'webp', 'jpg'):
        f = os.path.join(OFICIALES, '%s.%s' % (c.get('id') or '', ext))
        if not logo and os.path.exists(f):
            tipo = {'png': 'image/png', 'webp': 'image/webp', 'jpg': 'image/jpeg'}[ext]
            return 'data:%s;base64,%s' % (tipo, base64.b64encode(open(f, 'rb').read()).decode('ascii'))
    return _data_svg(svg(del_nombre(c.get('nombre') or c.get('id') or '')))


def de(clave):
    """El `src` del logo de la crew de esa persona, o vacío si no tiene crew."""
    return src(crew_de(clave))


def _self_check():
    mal = []

    def ok(cond, que):
        print('   %s %s' % ('✅' if cond else '🔴', que))
        if not cond:
            mal.append(que)

    # los catálogos, contra el .jsx
    try:
        jsx = open(JSX, encoding='utf-8').read()
        for nombre, d in (('FORMAS', FORMAS), ('SIMBOLOS', SIMBOLOS), ('DIVISIONES', DIVISIONES)):
            bloque = jsx.split('export const %s = {' % nombre, 1)[1].split('};', 1)[0]
            pares = dict(re.findall(r"^\s*(\w+): '([^']*)',", bloque, re.M))
            ok(pares == d, 'los %s son los mismos que en web/src/escudo.jsx (%d)' % (nombre.lower(), len(d)))
        cols = re.findall(r"'([0-9a-f]{6})'", jsx.split('export const COLORES = [', 1)[1].split('];', 1)[0])
        ok(cols == COLORES, 'los %d colores, en el mismo orden' % len(COLORES))
    except (OSError, IndexError) as e:
        ok(False, 'no pude leer web/src/escudo.jsx (%s)' % e)
    # el hash de delNombre(): el mismo que el de JS (medido con node sobre «follombia» y «KS»)
    ok(_hash('follombia') == 2207283666 and _hash('ñ') == 1946908892, 'el hash del nombre es el FNV-1a de la página')
    e = leer('esc:rombo.micro.29b298.9b5cff')
    ok(e and e['div'] == 'liso' and e['c'] == '9b5cff', 'el código corto: liso, fino y el símbolo como tercer color')
    e2 = leer('esc:escudo.sigla.e41373.f6f6f6.banda.doble.f2b705.MTR')
    ok(e2 and e2['sigla'] == 'MTR' and e2['div'] == 'banda' and 'MTR' in svg(e2), 'el código largo, con su sigla')
    ok(leer('esc:escudo.nada.e41373.f6f6f6') is None and leer('esc:escudo.micro.123456.f6f6f6') is None,
       'una pieza que no está en el catálogo no vale')
    d = del_nombre('Follombia')
    ok(d['forma'] in FORMAS_ANTES and d['b'] != d['a'], 'sin logo, el escudo del nombre (sólo con las piezas de antes)')
    ok(src(None) == '' and de('') == '', 'sin crew no hay pieza')
    ok(src({'id': 'X', 'nombre': 'X', 'logo': 'https://pub-x.r2.dev/logos-crews/a.webp'}) == 'https://pub-x.r2.dev/logos-crews/a.webp'
       and src({'id': 'X', 'nombre': 'X', 'logo': 'esc:circulo.estrella.e5484d.29b298'}).startswith('data:image/svg+xml'),
       'la imagen subida va tal cual; el escudo armado, dibujado')
    if os.path.exists(os.path.join(OFICIALES, 'Follombia.png')):
        ok(src({'id': 'Follombia', 'nombre': 'Follombia', 'logo': ''}).startswith('data:image/png'), 'Follombia, con su PNG oficial')
    print('\n%s' % ('🔴 %d mal' % len(mal) if mal else '✅ el logo de la crew sale igual que en la página'))
    return not mal


if __name__ == '__main__':
    sys.exit(0 if _self_check() else 1)
