# -*- coding: utf-8 -*-
"""🏟️ LA CARTA DE LIGA (la quinta): el afiche pegado de cada uno en cada liga que juega.

Dlx la diseñó en la maqueta del 26/10/2026 (artifact CLDPA3E94eRzjRybpwwywB, v14) y la cerró: OVR de liga 60/40 (puntos de
la tabla y PTB por batalla), los TAG LÍDER DE LA LIGA · INVICTO · RACHA DE N · MÁS PTB, el rango competitivo en la franja,
y el marco del Pase «el afiche pegado» (ése vive en la web, `web/src/marcos.jsx`). La tiene TODO el que juega la liga, sin
pedir verificación (Dlx, 26/10/2026), y sólo la ve su dueño en su cuenta.

PAPEL     fibra, arrugas (luz difusa sobre ruido) y un pliegue; el roto con FIBRA BLANCA y, debajo del roto de abajo, los
          restos de un AFICHE VIEJO de otro color con letras cortadas
FOTO      impresa: duotono con el color de la liga, trama, corrimiento de registro; sin foto, la silueta de comun/sin_foto
FRANJA    puesto, cambio, rango competitivo, PTS, V-D, las últimas y el logo de UL, en la tinta que contrasta con la liga
NIVELES   resto: una hoja · podio: dos afiches, cinta PODIO, brillo · 1.º: tres afiches, fluorescente, corona, estrella

Los datos salen de `datos.py` (las ligas de la página); el PNG, de `exportar.py`; el ciclo, de `ciclo.py`.
"""
import io
import json
import math
import os
import random
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(AQUI)
if AQUI not in sys.path:
    sys.path.insert(0, AQUI)
import datos as G  # noqa: E402
AF = G2 = G
from comun import sin_foto as SF  # noqa: E402

W, H = 300, 420              # el papel
#: el logo de UL y el sello de la temporada, de donde los leen las otras cuatro cartas (normal_v3, gencomp)
_ul = open(os.path.join(BASE, '01_Temporada', 'ul_b64.txt'), encoding='utf-8').read().strip()
#: el UL BLANCO, sin fondo: el mismo archivo que la Temporada y la Competitiva (Dlx: «tiene que ser el blanco, así como
#: están en todas las otras tarjetas»). El de comun/marca es el de colores, el de la web
UL = _ul if _ul.startswith('data:') else 'data:image/png;base64,' + _ul
from comun.temporada import SELLO as TEMP  # noqa: E402
SW, SH = 340, 470            # el escenario: deja lugar a la pestaña (arriba) y al nombre (a la izquierda)
OX, OY = 22, 30              # dónde cae el papel en el escenario
NEON = '#E8FF3A'


def mix(a, b, t):
    a, b = a.lstrip('#'), b.lstrip('#')
    ca = [int(a[i:i + 2], 16) for i in (0, 2, 4)]
    cb = [int(b[i:i + 2], 16) for i in (0, 2, 4)]
    return '#%02X%02X%02X' % tuple(round(x + (y - x) * t) for x, y in zip(ca, cb))


def lum(c):
    c = c.lstrip('#')
    r, g, b = [int(c[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda v: v / 12.92 if v <= .03928 else ((v + .055) / 1.055) ** 2.4   # noqa: E731
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b)


def tinta(col):
    """La tinta de la franja: la que más contrasta con el color de la liga."""
    L = lum(col)
    return '#030304' if (L + .05) / .05 > 1.05 / (L + .05) else '#F6F6F6'


# ── el roto (21st «Torn Poster»: cresta con ruido fractal, picos y fibra) ──────────────────────────
def cresta(seed, n, base, amp):
    """Una cresta rota: `n` puntos, alrededor de `base`, con ondas, dientes y algún pico."""
    r = random.Random(seed).random
    ph = [r() * 6.283 for _ in range(3)]
    ys = []
    for i in range(n):
        x = i / (n - 1)
        w = amp * (.55 * math.sin(x * 7 + ph[0]) + .3 * math.sin(x * 17 + ph[1]) + .15 * math.sin(x * 41 + ph[2]))
        pico = 2.4 if r() < .14 else 1
        ys.append(base + w + (r() - .5) * amp * .9 * pico)
    return ys


def pol(pts):
    return 'M' + 'L'.join('%.1f %.1f' % p for p in pts) + 'Z'


def hoja(seed=7, n=40):
    """Las tres curvas del papel: la silueta de afuera (con la fibra), la tinta, y la banda del afiche viejo abajo."""
    xs = [W * i / (n - 1) for i in range(n)]
    r = random.Random(seed + 1)
    top0 = cresta(seed, n, 7, 5)                          # el borde de arriba
    bot0 = [H - y for y in cresta(seed + 2, n, 8, 6)]     # el borde de abajo
    rim = [1.6 + r.random() * 3.6 for _ in range(n)]      # la fibra blanca: 2 a 5 px
    banda = cresta(seed + 3, n, 20, 8)                    # cuánto del afiche viejo asoma
    top1 = [y + f for y, f in zip(top0, rim)]
    bot_viejo = [y - f for y, f in zip(bot0, rim)]
    bot1 = [y - max(6, b) for y, b in zip(bot_viejo, banda)]
    rim2 = [1.4 + r.random() * 3 for _ in range(n)]
    afuera = pol(list(zip(xs, top0)) + list(zip(xs[::-1], bot0[::-1])))
    viejo = pol(list(zip(xs, top1)) + list(zip(xs[::-1], bot_viejo[::-1])))
    fibra2 = pol(list(zip(xs, top1)) + list(zip(xs[::-1], [b + f for b, f in zip(bot1, rim2)][::-1])))
    tin = pol(list(zip(xs, top1)) + list(zip(xs[::-1], bot1[::-1])))
    return afuera, viejo, fibra2, tin, min(bot1)


AFUERA, VIEJO, FIBRA2, TINTA, PIE = hoja()

DEFS = """<svg width='0' height='0' style='position:absolute' aria-hidden='true'><defs>
<filter id='fibra' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' seed='3'/>
 <feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 .95  0 0 0 .09 0'/></filter>
<filter id='arruga' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.011 .016' numOctaves='2' seed='8' result='n'/>
 <feDiffuseLighting in='n' surfaceScale='3.2' lighting-color='#fff'><feDistantLight azimuth='225' elevation='52'/></feDiffuseLighting></filter>
<filter id='gasto' x='-10%' y='-10%' width='120%' height='120%'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' seed='5' result='t'/>
 <feColorMatrix in='t' type='luminanceToAlpha' result='a'/><feComponentTransfer in='a' result='m'><feFuncA type='discrete' tableValues='1 1 0 1 1 0 1'/></feComponentTransfer>
 <feComposite in='SourceGraphic' in2='m' operator='in'/></filter>
<filter id='aerosol'><feTurbulence type='fractalNoise' baseFrequency='.08' numOctaves='2' seed='2'/><feDisplacementMap in='SourceGraphic' scale='5'/></filter>
DUOS
</defs></svg>"""


def duo(lid, col):
    """El duotono de la foto: las sombras en la tinta del papel, las luces en el color de la liga aclarado."""
    osc, med, luz = (0x0E, 0x0E, 0x10), tuple(int(mix(col, '#000000', .55)[i:i + 2], 16) for i in (1, 3, 5)), \
        tuple(int(mix(col, '#FFFFFF', .8)[i:i + 2], 16) for i in (1, 3, 5))
    # con medios tonos (27/10/2026: «que se vea el avatar»): antes las sombras se aplastaban en dos pasos de negro
    mid = tuple(int(mix(col, '#FFFFFF', .25)[i:i + 2], 16) for i in (1, 3, 5))
    f = lambda k: ' '.join('%.3f' % (v[k] / 255) for v in (osc, med, mid, luz, (0xF6, 0xF6, 0xF4)))   # noqa: E731
    return ("<filter id='duo-%s' color-interpolation-filters='sRGB'><feColorMatrix type='saturate' values='0'/>"
            "<feComponentTransfer><feFuncR type='table' tableValues='%s'/><feFuncG type='table' tableValues='%s'/>"
            "<feFuncB type='table' tableValues='%s'/></feComponentTransfer></filter>") % (lid, f(0), f(1), f(2))


def aerosol(seed, cx, cy, rx, ry, n, col):
    """Salpicadura de aerosol: puntos que se ralean hacia afuera."""
    r = random.Random(seed)
    out = []
    for _ in range(n):
        a = r.random() * 6.283
        d = r.random() ** .55
        x, y = cx + math.cos(a) * rx * d, cy + math.sin(a) * ry * d
        s = .6 + (1 - d) * 2.4 * r.random()
        out.append("<circle cx='%.1f' cy='%.1f' r='%.1f' fill='%s' opacity='%.2f'/>" % (x, y, s, col, .35 + .6 * r.random()))
    return ''.join(out)


def chorreado(seed, x0, x1, y, col, n=5):
    r = random.Random(seed)
    out = []
    for _ in range(n):
        x = x0 + r.random() * (x1 - x0)
        L = 12 + r.random() * 46
        w = 2 + r.random() * 3
        out.append("<rect x='%.1f' y='%.1f' width='%.1f' height='%.1f' rx='%.1f' fill='%s'/><circle cx='%.1f' cy='%.1f' r='%.1f' fill='%s'/>"
                   % (x, y, w, L, w / 2, col, x + w / 2, y + L, w * .8, col))
    return ''.join(out)


CORONA_AEROSOL = ("<svg class='v6-corona' viewBox='0 0 120 80' aria-hidden='true'><g filter='url(#aerosol)' fill='none' stroke='%s' "
                  "stroke-width='7' stroke-linejoin='round' stroke-linecap='round'><path d='M10 70 L16 18 L40 46 L60 8 L80 46 L104 18 L110 70 Z'/>"
                  "<path d='M14 72 L108 72' stroke-width='5'/></g></svg>") % NEON
ESTRELLA = ("<svg class='v6-estrella' viewBox='0 0 100 100' aria-hidden='true'><polygon points='50,4 61,36 96,37 68,57 79,92 50,71 21,92 32,57 4,37 39,36' "
            "fill='%s' stroke='#030304' stroke-width='5' stroke-linejoin='round'/><text x='50' y='63' text-anchor='middle' "
            "font-family='Anton' font-size='26' fill='#030304'>#1</text></svg>") % NEON


def nombre_css(n):
    """El nombre, con LA MISMA REGLA de las otras cartas (`comun/nombre.py`, Dlx: «entre más grande sea, más pequeño»):
    cuatro escalones por largo —hasta 6, 8, 10 letras y más—, sin angostar la letra. El escalón más grande es de 62 px en
    esta carta. Si aun así un nombre muy largo pasara de los 236 px que hay hasta la franja, se achica un poco más, nunca
    se aprieta."""
    from comun import nombre as NM
    f = NM.rem(n) / NM.ESCALONES[0][1] * 56
    ancho = len(n) * .43 * f
    if ancho > 236:
        f = 236 / (len(n) * .43)
    return round(f, 1), 1.0


def vertical(L):
    """El nombre de la liga de costado (Dlx: «las siglas, por ejemplo SNK League Generations»). Si pasa de 14 letras, la
    primera palabra se cambia por la sigla del servidor —salvo que ya la tenga—; y si sigue larga, va en dos renglones.
    El tamaño sale del renglón más largo y de los ~70 px que quedan entre los números y el sello."""
    n = L['n'].upper()
    sys.path.insert(0, os.path.join(BASE, 'bot'))
    from siglas import sigla   # la sigla que se LEE (SR -> SNK, URBF -> URB), la misma de la página y de /card
    sv = sigla(L.get('sv') or '').upper()
    if len(n) > 14 and sv and sv not in n.split():
        n = ' '.join([sv] + n.split()[1:])
    ls = [n]
    if len(n) > 12 and ' ' in n:
        ps = n.split()
        corte = min(range(1, len(ps)), key=lambda k: abs(len(' '.join(ps[:k])) - len(' '.join(ps[k:]))))
        ls = [' '.join(ps[:corte]), ' '.join(ps[corte:])]
    f = min(22, 70 / (max(len(x) for x in ls) * .56))
    return "<span class='v6-vert' style='font-size:%.1fpx'>%s</span>" % (f, '<br>'.join(ls))


def ptb_liga(lid):
    """🎤 EL PTB ACUMULADO (Dlx: «un número que se base en el PTB de cada jornada, una acumulación»): la suma de los
    puntos que los jurados le dieron en cada batalla de la liga, ganara o perdiera. Cada batalla trae el de los dos lados.
    La escala es de cada liga (FMS ~22 por batalla, Snake ~130): se compara adentro de la liga, no entre ligas."""
    acc = {}
    for f, _p in G2.carrera(lid):
        for b in f['b']:
            if len(b) > 5 and isinstance(b[4], (int, float)) and isinstance(b[5], (int, float)):
                acc[b[0]] = acc.get(b[0], 0) + b[4]
                acc[b[1]] = acc.get(b[1], 0) + b[5]
    return acc


def ovr_liga(lid):
    """🎯 EL OVR DE LIGA, de 0 a 99 (Dlx: «entre más PTB y buenos resultados, más arriba»). Dos partes, las dos
    comparadas con lo mejor de SU liga:
      · 60 % los PUNTOS de la tabla ÷ los del líder. Ya dicen cómo te fue: directa 3, réplica ganada 2, réplica perdida 1.
      · 40 % el PTB: cada batalla se mide contra el promedio de SU jornada (1.10 = 10 % más que el promedio de esa
        fecha), se promedia, y se divide por el mejor de la liga. Contra la jornada y no crudo, porque hay ligas que
        puntúan en escalas distintas según la fecha (FMH Tricolor: 96 a 87 una jornada, 28 a 21.5 otra).
    Promedio y no suma: con la suma, ir a réplica daba más PTB que ganar directo (CrisZJ, 3.º de FMS Perú con 14
    batallas, le ganaba al líder). El promedio lleva tres batallas «de relleno» en el promedio, para que una sola batalla
    buena no deje a nadie arriba de todos. Una liga sin PTB cargado usa sólo los puntos.
    Devuelve {nombre: (ovr, ptb_promedio_crudo)} — el crudo es el que se muestra en la carta."""
    acc, nb, rel = {}, {}, {}
    for f, _p in G2.carrera(lid):
        bs = [b for b in f['b'] if len(b) > 5 and isinstance(b[4], (int, float)) and isinstance(b[5], (int, float)) and b[4] + b[5] > 0]
        if not bs:
            continue
        media = sum(b[4] + b[5] for b in bs) / (2 * len(bs))
        for b in bs:
            for x, me in ((b[0], b[4]), (b[1], b[5])):
                acc[x] = acc.get(x, 0) + me
                nb[x] = nb.get(x, 0) + 1
                rel[x] = rel.get(x, 0) + me / media
    tabla = G.POR[lid]['tabla']
    lider = max(f[3] for f in tabla) or 1
    if not acc:   # una liga sin PTB cargado (LKR Champions, FZ League): el OVR sale sólo de los puntos, y el PTB dice «—»
        return {n: (min(99, round(99 * pts / lider)), 0) for n, pj, g, pts in tabla}
    K = 3
    suave = {n: (rel[n] + K * 1.0) / (nb[n] + K) for n in rel}
    mejor = max(suave.values())
    out = {}
    for n, pj, g, pts in tabla:
        a = suave.get(n, 1.0)
        out[n] = (max(0, min(99, round(99 * (.6 * pts / lider + .4 * a / mejor)))), acc.get(n, 0) / nb[n] if nb.get(n) else 0)
    return out


def tira(seed, n=22):
    """El contorno de la tira del TAG: papel arrancado arriba y abajo, cortes chuecos en las puntas (en %)."""
    import random
    r = random.Random(seed)
    arriba = [(round(i * 100 / n, 1), round(r.uniform(0, 14), 1)) for i in range(n + 1)]
    abajo = [(round(100 - i * 100 / n, 1), round(100 - r.uniform(0, 14), 1)) for i in range(n + 1)]
    der = [(round(100 - r.uniform(0, 1.6), 1), y) for y in (30, 55, 80)]
    izq = [(round(r.uniform(0, 1.6), 1), y) for y in (75, 48, 22)]
    return 'polygon(%s)' % ','.join('%s%% %s%%' % xy for xy in arriba + der + abajo + izq)


_RG = {}


def rango_de(n):
    """🏅 EL RANGO COMPETITIVO de esa persona, el MISMO de sus otras cartas: sale del pool competitivo, con la puerta de
    10 eventos (`comun/requisitos.py`). Devuelve ('letra', subrango) · ('falta', eventos) · ('nada', None).
    Debajo de 10 eventos no hay letra — no se inventa — y la celda dice cuánto lleva, como la página («7/10»)."""
    import unicodedata
    raiz = os.path.join(BASE, 'datos') + os.sep
    if not _RG:
        def nz(t):
            return ''.join(c for c in unicodedata.normalize('NFKD', t).lower() if c.isalnum() and ord(c) < 128)
        _RG['nz'] = nz
        _RG['alias'] = json.load(io.open(raiz + 'akas.json', encoding='utf-8'))['alias']
        _RG['por'] = {}
        for x in json.load(io.open(raiz + 'competitivo_pool.json', encoding='utf-8')):
            for k in (x.get('raw'), x.get('full')):
                if k:
                    _RG['por'][nz(k)] = x
    nz = _RG['nz']
    k = nz(n)
    x = _RG['por'].get(k) or _RG['por'].get(nz(_RG['alias'].get(k, '')))
    if not x:
        return 'nada', None
    from comun.requisitos import minimo
    if (x.get('ev') or 0) < minimo('competitivo', 'ev'):
        return 'falta', x.get('ev') or 0
    return 'letra', x.get('subrango') or x.get('rango')


def celda_rango(n, suf):
    """La celda de la franja: la figura del rango y su letra sobre una placa negra (el color del rango no pelea con el de
    la liga), o el contador de eventos, o una raya."""
    from comun import rangos as RG
    tipo, v = rango_de(n)
    if tipo == 'letra':
        base = v.rstrip('+-')
        letra = v.replace('-', '\u2212')
        return ("<span class='v6-dt v6-rg'><small>RANGO</small><span class='pl' style='--rc:%s'>%s<b>%s</b></span></span>"
                % (RG.ACENTO[base], RG.icono(base, 17, suf), letra))
    if tipo == 'falta':
        return "<span class='v6-dt v6-rg'><small>RANGO</small><span class='pl falta'><b>%d/10</b><i>EV</i></span></span>" % v
    return "<span class='v6-dt v6-rg'><small>RANGO</small><span class='pl falta'><b>—</b></span></span>"


def liga_corta(L):
    """El nombre de la liga para la etiqueta: si pasa de 14 letras, la primera palabra es la sigla que se lee."""
    n = L['n'].upper()
    sys.path.insert(0, os.path.join(BASE, 'bot'))
    from siglas import sigla
    sv = sigla(L.get('sv') or '').upper()
    if len(n) > 14 and sv and sv not in n.split():
        n = ' '.join([sv] + n.split()[1:])
    if len(n) > 14:   # «SNK LEAGUE GENERATIONS» -> «SNK GENERATIONS»: la palabra «liga» sobra en una carta de liga
        n = ' '.join(w for w in n.split() if w not in ('LEAGUE', 'LIGA', 'DE', 'LA'))
    ws = n.split()
    while len(' '.join(ws)) > 16 and len(ws) > 2:   # «LKR PLAZA UNDERGROUND» -> «LKR UNDERGROUND»
        ws.pop(1)
    return ' '.join(ws)


def tag_de(lid, i, n, pj, g, d, ptb):
    """El TAG de la carta de liga, de ESTADO: sale sólo mientras se cumple. Dlx eligió cuatro (26/10/2026): el líder, el
    invicto (3 o más, todas ganadas), la racha (3 o más seguidas) y el mejor PTB por batalla de su liga. «EN ASCENSO»
    quedó sin elegir —no descartado—; si no se cumple ninguno, «DE LA LIGA». Viven sólo en esta carta."""
    fs = G.forma(lid, n, 9)
    racha = 0
    for x in reversed(fs):
        if x != 'g':
            break
        racha += 1
    o = ovr_liga(lid)
    proms = [v[1] for v in o.values() if v[1]]
    if i == 0:
        return 'LÍDER DE LA LIGA', 't1', '👑'
    if pj >= 3 and g == pj:
        return 'INVICTO', 't1', '🛡️'
    if racha >= 3:
        return 'RACHA DE %d' % racha, 't2', '🔥'
    if proms and o.get(n, (0, 0))[1] == max(proms):
        return 'MÁS PTB', 't2', '🎤'
    return 'DE LA LIGA', 't4', '🏆'



#: 👑 LA CARTA DEL DUEÑO (Dlx, 27/10/2026: «de todas y desbloqueado todo acuérdate»): una en CADA liga aunque no juegue
#: ninguna. Sin batallas no hay número que poner, así que el puesto, el OVR y el TAG van en «—» y «DE LA LIGA»: se le
#: desbloquea la carta, no se le inventa un puesto (sin dato no hay pieza). `carta(liga, None)` la dibuja
DUENO = ('DLX', 'dlx')


def carta(lid, i, s=1.0, est='eA'):
    L = G.POR[lid]
    dueno = i is None
    n, pj, g, pts = (DUENO[0], 0, 0, 0) if dueno else L['tabla'][i]
    i = 0 if dueno else i
    col = G.COLOR.get(L['sv'], '#E41373')
    ink = tinta(col)
    antes, fecha = AF.puesto_antes(lid)
    d = (antes[n] - i) if n in antes and not dueno else None
    fl = '—' if dueno else 'NUEVO' if d is None else ('▲%d' % d) if d > 0 else ('▼%d' % -d) if d < 0 else 'IGUAL'
    fc = 'nuevo' if d is None else 'sube' if d and d > 0 else 'baja' if d and d < 0 else ''
    av = AF.avatar(lid, n) or SF.uri(n)
    sin = not AF.avatar(lid, n)
    forma = ''.join("<i class='%s'>%s</i>" % ('g' if x == 'g' else 'p', 'G' if x == 'g' else 'P') for x in G.forma(lid, n, 5))
    nivel = '' if dueno else 'n1' if i == 0 else 'pod' if i < 3 else ''
    ptb = ptb_liga(lid)
    v = ptb.get(n, 0)
    ovr, prom = ('', 0) if dueno else ovr_liga(lid).get(n, (0, 0))
    ptb_txt = 'SIN BATALLAS' if dueno else ('%.1f PTB' % prom) if prom else ''   # una liga sin PTB cargado dice sólo «OVR»
    tag = ('DE LA LIGA', 't4', '🏆') if dueno else tag_de(lid, i, n, pj, g, d, ptb)
    fsz, sx = nombre_css(n)
    seed = sum(map(ord, n)) + i
    viejo_col = ['#F2C14E', '#E9E2CF', '#F28C9B', '#9BD7C8'][seed % 4]
    viejo_txt = ['BATALLA', 'FINAL', 'JORNADA', 'CYPHER'][seed % 4]
    detras = ''
    if nivel == 'pod':
        detras = "<div class='v6-detras' style='--h:%s;--r:3.5deg;--x:9px;--y:-6px'></div>" % mix(viejo_col, '#FFFFFF', .2)
    if nivel == 'n1':
        detras = ("<div class='v6-detras' style='--h:%s;--r:-4deg;--x:-10px;--y:-4px'></div>"
                  "<div class='v6-detras' style='--h:%s;--r:5deg;--x:12px;--y:-9px'></div>") % (mix(col, '#FFFFFF', .45), viejo_col)
    papel = ("<svg class='v6-hoja' viewBox='0 0 %d %d' aria-hidden='true'>"
             "<path d='%s' fill='#EFE9DA'/>"
             "<path d='%s' fill='%s'/>"
             "<g clip-path='path(\"%s\")'><text x='-10' y='%d' font-family='Anton' font-size='86' fill='#030304' opacity='.55'>%s</text>"
             "<rect width='%d' height='%d' filter='url(#fibra)'/></g>"
             "<path d='%s' fill='#F3EEE0'/>"
             "</svg>") % (W, H, AFUERA, VIEJO, viejo_col, VIEJO, H + 30, viejo_txt, W, H, FIBRA2)
    tinta_html = (
        "<div class='v6-tinta' style='clip-path:path(\"%s\")'>"
        "<svg class='v6-capa' viewBox='0 0 %d %d' preserveAspectRatio='none' aria-hidden='true'><rect width='%d' height='%d' filter='url(#fibra)'/></svg>"
        "%s"
        "<span class='v6-pin' style='color:%s'>%s</span>"
        "<svg class='v6-capa' viewBox='0 0 %d %d' aria-hidden='true'>%s%s</svg>"
        "<div class='v6-foto%s'><img class='a' src='%s' alt='' style='filter:url(#duo-%s)'>"
        "<img class='reg' src='%s' alt='' style='filter:url(#duo-%s)'><span class='v6-trama'></span></div>"
        "<span class='v6-jor' style='clip-path:%s'>%s<b>%s</b><small>%s · J%d</small></span>"
        "<div class='v6-ovr'><span class='n'><b class='o'>%s</b><b class='m'>%s</b><b class='f'>%s</b></span></div>"
        "<div class='v6-fila'><span class='v6-tag %s' style='clip-path:%s'>%s</span><span class='v6-cinta c'></span></div>"
        "<svg class='v6-capa v6-arruga' viewBox='0 0 %d %d' preserveAspectRatio='none' aria-hidden='true'><rect width='%d' height='%d' filter='url(#arruga)'/></svg>"
        "<span class='v6-pliegue'></span><span class='v6-luz'></span><span class='v6-vin'></span>"
        "</div>") % (
        TINTA, W, H, W, H,
        "<span class='v6-gigante'>1</span>" if nivel == 'n1' else '',
        col, AF.PINCEL, W, H, chorreado(seed, 40, 200, 232, col), aerosol(seed + 9, 70, 300, 120, 34, 70, col),
        ' sin' if sin else '', av, lid, av, lid, tira(seed + 5, 18), G.logo(L['sv'], 18), liga_corta(L), TEMP, fecha, ovr, ovr, ovr, tag[1], tira(seed), tag[0], W, H, W, H)
    franja = (
        "<div class='v6-fr' style='--ink:%s'><span class='v6-foil'></span>"
        "<small>PUESTO</small><b class='v6-num%s'>%s</b><em class='%s'>%s</em>%s"
        "<span class='v6-dt'><small>PTS</small><b>%d</b></span><span class='v6-dt'><small>V-D</small><b>%d-%d</b></span>"
        "<span class='v6-dt v6-u5'><small>ÚLTIMAS</small><span>%s</span></span>"
        "<span class='v6-logo'><img src='%s' alt='Under Legends' style='%s'></span></div>") % (
        ink, ' sin' if dueno else ' dos' if i >= 9 else '', '—' if dueno else i + 1, fc, fl, celda_rango(n, 'r%d%s' % (seed, lid.replace('-', ''))), pts, g, pj - g, forma, UL, 'filter:brightness(0)' if lum(ink) < .3 else '')
    sello = ''
    nombre = ("<div class='v6-nom' style='font-size:%.1fpx;--sx:%s'><b class='o'>%s</b><b class='m'>%s</b><b class='f'>%s</b></div>"
              % (fsz, sx, n.upper(), n.upper(), n.upper()))
    extras = ''
    if nivel == 'n1':
        extras = CORONA_AEROSOL   # sin la estrella (Dlx, 27/10/2026: «quizás quitar esa estrella… que se vea el avatar»)
    elif nivel == 'pod':
        extras = "<span class='v6-cinta-pod'>PODIO</span>"
    solapas = ("<svg class='v6-solapa a' viewBox='0 0 40 40' aria-hidden='true'><defs><linearGradient id='sg%d' x1='0' y1='0' x2='1' y2='1'>"
               "<stop offset='0' stop-color='#BDB5A0'/><stop offset='.6' stop-color='#E9E3D2'/><stop offset='1' stop-color='#FFFFFF'/></linearGradient></defs>"
               "<path d='M0 0 L34 0 L28 6 L22 9 L12 14 L6 24 L0 32 Z' fill='url(#sg%d)'/></svg>") % (seed, seed)
    return ("<div class='v6 %s' style='--c:%s;--ink:%s;--s:%.4f'><div class='v6-esc'>"
            "<div class='v6-sil'>%s<div class='v6-papel'>%s%s</div>%s%s</div>"
            "%s%s%s<span class='v6-cinta a'></span><span class='v6-cinta b'></span></div></div>") % (
        nivel + ' ' + est, col, ink, s, detras, papel, tinta_html, franja, nombre, sello, extras, solapas)


CSS = r'''
:root{--fondo:#ECECE8;--tinta:#111}
*{box-sizing:border-box}
body{margin:0;background:var(--fondo);color:var(--tinta);font:15px/1.5 Archivo,system-ui,sans-serif}
.pg{max-width:1260px;margin:0 auto;padding:28px 16px 60px}
.etq{font:700 13px/1 "Barlow Condensed",sans-serif;letter-spacing:.14em;color:#D0106A;text-transform:uppercase}
h1{margin:6px 0 10px;font:900 34px/1 Archivo,sans-serif;font-stretch:115%;text-transform:uppercase}
h2{margin:40px 0 6px;font:900 22px/1.1 Archivo,sans-serif;text-transform:uppercase}
h2 small{display:block;margin-top:4px;font:500 14px/1.4 Archivo,sans-serif;text-transform:none;color:#555}
.cab p,.cab li{max-width:88ch}
.esc{display:flex;gap:26px;flex-wrap:wrap;align-items:flex-end;padding:30px 24px;background:#0B0B0D;border-radius:4px}
.esc figure{margin:0;display:grid;gap:10px;justify-items:center}
.esc figcaption{font:700 12px/1 "Barlow Condensed",sans-serif;letter-spacing:.1em;color:#A5A5A0;text-transform:uppercase}
.hoy img{height:300px;width:auto;display:block}
.mkl{position:relative;display:block;line-height:0}
.mkl-img,.mkl-bri{position:absolute;inset:0;display:block}
/* adentro del marco la carta va sin su sombra difusa: el filtro la engordaría y el anillo saldría borroso abajo */
.mkl .v6-sil{filter:drop-shadow(4px 0 0 #F6F6F6) drop-shadow(-4px 0 0 #F6F6F6) drop-shadow(0 4px 0 #F6F6F6) drop-shadow(0 -4px 0 #F6F6F6) drop-shadow(4px 0 0 #F6F6F6) drop-shadow(-4px 0 0 #F6F6F6) drop-shadow(0 4px 0 #F6F6F6) drop-shadow(0 -4px 0 #F6F6F6)}
.mkl .v6.pod .v6-sil{filter:drop-shadow(5px 0 0 #F6F6F6) drop-shadow(-5px 0 0 #F6F6F6) drop-shadow(0 5px 0 #F6F6F6) drop-shadow(0 -5px 0 #F6F6F6) drop-shadow(5px 0 0 #F6F6F6) drop-shadow(-5px 0 0 #F6F6F6) drop-shadow(0 5px 0 #F6F6F6) drop-shadow(0 -5px 0 #F6F6F6)}
.mkl .v6.n1 .v6-sil{filter:drop-shadow(3px 0 0 #030304) drop-shadow(-3px 0 0 #030304) drop-shadow(0 3px 0 #030304) drop-shadow(0 -3px 0 #030304) drop-shadow(5px 0 0 NEON) drop-shadow(-5px 0 0 NEON) drop-shadow(0 5px 0 NEON) drop-shadow(0 -5px 0 NEON)}
.mkl-defs{position:absolute;width:0;height:0;overflow:hidden}
.mkl-p{position:absolute;overflow:visible;pointer-events:none;z-index:3}
/* las chinches: arriba, en las dos puntas del papel (la de la derecha antes de la pestaña de la franja) */
.mkl-chi{width:2.3em;height:2.3em;top:.9em}
.mkl-chi.a{left:1.6em}.mkl-chi.b{left:14.2em}
.mkl.chica .mkl-chi{width:2.6em;height:2.6em}
/* la pegatina de tu liga, en la esquina de abajo, mordiendo el borde */
.mkl-peg{width:4.6em;height:4.6em;left:-.4em;top:25.6em;transform:rotate(-12deg)}
/* la corona, arriba al centro del papel */
.mkl-cor{width:5.2em;left:8.87em;top:-1.4em}
.mkl.chica .mkl-cor{width:5em;top:-.6em}
/* el brillo del Oro: la misma franja dura que las otras cuatro */
.mkl-bri{pointer-events:none;-webkit-mask-image:linear-gradient(110deg,transparent 0 44%,#000 44% 50%,transparent 50% 100%);
  mask-image:linear-gradient(110deg,transparent 0 44%,#000 44% 50%,transparent 50% 100%);-webkit-mask-size:320% 100%;mask-size:320% 100%;
  animation:mk-barre 5.5s cubic-bezier(.5,0,.3,1) infinite}
@keyframes mk-barre{0%{-webkit-mask-position:120% 0;mask-position:120% 0}55%,100%{-webkit-mask-position:-20% 0;mask-position:-20% 0}}
.mkl-des{width:1.4em;height:1.4em;opacity:0;animation:mk-brilla 2.4s ease-in-out infinite;z-index:4}
.mkl-des.d0{left:5em;top:-.6em}.mkl-des.d1{left:17em;top:.2em;animation-delay:.8s}.mkl-des.d2{left:-.6em;top:22em;animation-delay:1.6s}
@keyframes mk-brilla{0%,100%{opacity:0;transform:scale(.3)}45%{opacity:1;transform:scale(1)}70%{opacity:0;transform:scale(.4)}}
@media (prefers-reduced-motion: reduce){.mkl-bri,.mkl-des{animation:none!important}.mkl-des{opacity:.9}}
.mks{display:flex;gap:34px;flex-wrap:wrap;align-items:flex-end;padding:44px 24px 30px;background:#0B0B0D;border-radius:4px}
.mks figure{margin:0;display:grid;gap:14px;justify-items:center}
.mks figcaption{font:700 12px/1.3 "Barlow Condensed",sans-serif;letter-spacing:.1em;color:#A5A5A0;text-transform:uppercase;text-align:center;line-height:1.3}
.mks figcaption b{display:block;color:#F6F6F6;font-size:14px}
.tovs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:18px}
.tov{overflow-x:auto}
.tov h3{margin:0 0 6px;font:900 15px/1.2 Archivo,sans-serif;text-transform:uppercase}
.tov table{width:100%;border-collapse:collapse;font:500 14px/1.3 Archivo,sans-serif;font-variant-numeric:tabular-nums}
.tov th{text-align:left;padding:6px 8px;font:700 12px/1 "Barlow Condensed",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#555;border-bottom:2px solid #111}
.tov td{padding:5px 8px;border-bottom:1px solid #D6D6D0}
.tov td:last-child b{font:900 16px/1 Archivo,sans-serif}
.tov tr.dif td{background:#F4F7B8}
.esc,.discord{overflow-x:clip}
@media (max-width:520px){.esc{padding:24px 8px}}
.discord{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;padding:18px;background:#313338;border-radius:4px}

/* ── el escenario y la silueta ─────────────────────────────────────────── */
.v6{position:relative;width:calc(340px * var(--s));height:calc(470px * var(--s))}
.v6-esc{position:absolute;left:0;top:0;width:340px;height:470px;transform:scale(var(--s)) rotate(-1.2deg);transform-origin:0 0}
/* el sticker: un borde blanco de 8 px que abraza la unión del papel, la pestaña y el nombre, con su sombra */
/* ⚠️ SIN LA SOMBRA DIFUSA (CLAUDE.md, «Exportar PNG»: se apaga antes de capturar): sobre transparencia no tiene con qué
   fundirse, y el marco del Pase (feMorphology) la engordaba en un anillo borroso */
.v6-sil{position:absolute;inset:0;filter:drop-shadow(4px 0 0 #F6F6F6) drop-shadow(-4px 0 0 #F6F6F6) drop-shadow(0 4px 0 #F6F6F6) drop-shadow(0 -4px 0 #F6F6F6)
  drop-shadow(4px 0 0 #F6F6F6) drop-shadow(-4px 0 0 #F6F6F6) drop-shadow(0 4px 0 #F6F6F6) drop-shadow(0 -4px 0 #F6F6F6)}
.v6.pod .v6-sil{filter:drop-shadow(5px 0 0 #F6F6F6) drop-shadow(-5px 0 0 #F6F6F6) drop-shadow(0 5px 0 #F6F6F6) drop-shadow(0 -5px 0 #F6F6F6)
  drop-shadow(5px 0 0 #F6F6F6) drop-shadow(-5px 0 0 #F6F6F6) drop-shadow(0 5px 0 #F6F6F6) drop-shadow(0 -5px 0 #F6F6F6)}
.v6.n1 .v6-sil{filter:drop-shadow(3px 0 0 #030304) drop-shadow(-3px 0 0 #030304) drop-shadow(0 3px 0 #030304) drop-shadow(0 -3px 0 #030304)
  drop-shadow(5px 0 0 NEON) drop-shadow(-5px 0 0 NEON) drop-shadow(0 5px 0 NEON) drop-shadow(0 -5px 0 NEON)}
.v6-detras{position:absolute;left:22px;top:30px;width:300px;height:420px;background:var(--h);clip-path:path("AFUERA");
  transform:translate(var(--x),var(--y)) rotate(var(--r))}
.v6-papel{position:absolute;left:22px;top:30px;width:300px;height:420px}
.v6-hoja{position:absolute;inset:0;width:100%;height:100%}
.v6-tinta{position:absolute;inset:0;background:#121214;overflow:hidden}
.v6-tinta>*{position:absolute}
.v6-capa{inset:0;width:100%;height:100%}
.v6-arruga{mix-blend-mode:soft-light;opacity:.55}
.v6-pin{left:-6px;width:250px;top:150px;height:150px;transform:rotate(-9deg)}
.v6-pin svg{width:100%;height:100%}
.v6-gigante{left:-6px;top:-30px;font:900 400px/1 "Big Shoulders Stencil Display",Anton,sans-serif;color:NEON;opacity:.11}
/* la foto impresa: duotono, corrimiento de registro y trama gruesa */
.v6-foto{left:14px;top:44px;width:220px;height:268px;
  -webkit-mask:url("MASCARA") center / 100% 100% no-repeat;mask:url("MASCARA") center / 100% 100% no-repeat}
.v6-foto img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.v6-foto img.a{filter:contrast(1.2)}
.v6-foto img.reg{mix-blend-mode:screen;opacity:.1;transform:translate(3px,1px)}
.v6-foto.sin img{inset:auto;left:50%;bottom:0;height:86%;width:auto;max-width:none;object-fit:initial;transform:translateX(-50%)}
.v6-foto.sin img.reg{transform:translate(calc(-50% + 3px),1px)}
.v6-trama{position:absolute;inset:0;background:radial-gradient(circle,#0E0E10 1px,transparent 1.6px) 0 0 / 5px 5px;mix-blend-mode:multiply;opacity:.16}
/* LA GRILLA (papel 300 × 420): el contenido va de 16 a 226; la franja empieza en 234.
   arriba la etiqueta (16–40) · el PTB (50–104) · la foto (46–294) · el nombre apoyado en 322 · la fila de abajo (346–372) */
/* LA ETIQUETA DE ARRIBA: la misma tira de papel que el TAG, de punta a punta. Arriba y abajo, las dos tiras cierran
   el afiche como un rótulo; adentro, el logo de la liga, su nombre y a la derecha cuándo (T1 · J5) */
.v6-jor{left:32px;top:16px;width:max-content;max-width:196px;height:27px;display:flex;align-items:center;gap:6px;padding:0 7px 0 9px;
  background:#EFE9DA linear-gradient(180deg,rgba(255,255,255,.35),transparent 45%,rgba(0,0,0,.06));color:#030304;
  font:400 12.5px/1 Anton,sans-serif;letter-spacing:.03em;white-space:nowrap;transform:rotate(-1deg)}
.v6-jor img,.v6-jor svg{flex:none;width:16px;height:16px;object-fit:contain}
.v6-jor b{flex:1;min-width:0;font-weight:400;overflow:hidden;text-overflow:ellipsis}
.v6-jor small{flex:none;padding:3px 5px;background:#030304;color:#F6F6F6;font:700 11px/1 "Barlow Condensed",sans-serif;letter-spacing:.06em}
/* LA GRILLA (papel 300 × 420). El contenido va de 14 a 222; la franja empieza en 234.
   arriba la etiqueta (14–40) · el OVR (48–122) · la foto (46–294) · el nombre hasta 312 · la tira del TAG (326–358) */

/* EL OVR: pintado igual que el nombre (contorno negro, el color de la liga en el medio y la tinta con grano), así el
   número y el nombre se leen como una pareja. Debajo, en cinta negra, la sigla y el PTB promedio de donde sale */
.v6-ovr{left:12px;top:56px;transform:rotate(-5deg);transform-origin:left top}
.v6-ovr .n{display:block;position:relative}
.v6-ovr b{white-space:nowrap}
.v6-ovr .n b{font:400 54px/.9 Anton,sans-serif;letter-spacing:.01em}
.v6-ovr .o,.v6-ovr .m{position:absolute;left:0;top:0}
.v6-ovr .f{position:relative;display:block}
.v6-ovr .o{color:#030304;-webkit-text-stroke:10px #030304;text-shadow:5px 5px 0 #030304}
.v6-ovr .m{color:var(--c);-webkit-text-stroke:5px var(--c)}
.v6-ovr .f{color:#F6F6F6;-webkit-mask:url("GRANO_T") 0 0 / 180px 180px;mask:url("GRANO_T") 0 0 / 180px 180px}
.v6.n1 .v6-ovr .f{color:NEON}
.v6-ovr small{display:inline-flex;align-items:center;gap:6px;margin:7px 0 0 4px;padding:3px 8px 3px 4px;background:#030304;color:#D9D9D4;
  font:700 11px/1 "Barlow Condensed",sans-serif;letter-spacing:.12em;box-shadow:2px 2px 0 var(--c)}
.v6-ovr small b{padding:2px 5px;background:var(--c);color:var(--ink);font:400 12px/1 Anton,sans-serif;letter-spacing:.14em}
.v6.n1 .v6-ovr small{box-shadow:2px 2px 0 NEON}.v6.n1 .v6-ovr small b{background:NEON;color:#030304}

/* EL TAG: una tira del MISMO papel del afiche, arrancada arriba y abajo y pegada con cinta. Crema para todos; el color
   de la liga para los de nivel 2 y el fluorescente para los de nivel 1. Cruza todo el ancho, como un rótulo pegado */
.v6-fila{left:10px;width:206px;top:326px;height:34px;filter:drop-shadow(0 2px 0 rgba(0,0,0,.55))}
.v6-tag{position:absolute;inset:0;display:grid;place-items:center;transform:rotate(-2.5deg);
  background:#EFE9DA linear-gradient(180deg,rgba(255,255,255,.35),transparent 40%,rgba(0,0,0,.06));color:#030304;
  font:400 17px/1 Anton,sans-serif;letter-spacing:.16em;white-space:nowrap;overflow:hidden;padding:0 18px}
.v6-tag::after{content:'';position:absolute;inset:0;background:url("GRANO_T") 0 0 / 120px 120px;opacity:.07;mix-blend-mode:multiply}
.v6-tag.t1{background-color:NEON}
.v6-tag.t2{background-color:var(--c);color:var(--ink)}
.v6-cinta.c{left:-12px;top:6px;width:52px;height:20px;transform:rotate(72deg)}

.v6-pliegue{left:-40px;top:120px;width:420px;height:2px;transform:rotate(28deg);
  background:linear-gradient(#FFFFFF33,#FFFFFF33) 0 0 / 100% 1px no-repeat,linear-gradient(#0000004D,#0000004D) 0 1px / 100% 1px no-repeat}
.v6-luz{inset:0;background:linear-gradient(118deg,transparent 28%,rgba(255,255,255,.16) 40%,rgba(255,255,255,.05) 47%,transparent 58%);mix-blend-mode:screen}
.v6-vin{inset:0;background:radial-gradient(ellipse at 45% 38%,transparent 52%,rgba(0,0,0,.5));mix-blend-mode:multiply}

/* la franja: pestaña que sobresale 18 px por arriba; la tinta es la que contrasta con el color de la liga */
.v6-fr{position:absolute;left:256px;top:12px;width:66px;height:394px;background:var(--c);color:var(--ink);
  clip-path:polygon(0 3%,8% 0,92% 0,100% 3%,100% 97%,88% 100%,70% 98.6%,48% 100%,26% 98.4%,8% 100%,0 97%);
  display:flex;flex-direction:column;align-items:center;padding-top:22px;overflow:hidden}
.v6-fr>*{position:relative;z-index:1}
.v6-fr small{font:800 10px/1 "Barlow Condensed",sans-serif;letter-spacing:.16em}
.v6-num{font:400 84px/.86 Anton,sans-serif;margin:4px 0 2px;letter-spacing:-.01em;
  text-shadow:0 0 5px color-mix(in srgb,var(--ink) 45%,transparent),0 0 1px var(--ink)}
.v6-fr em{font:800 13px/1 "Barlow Condensed",sans-serif;font-style:normal;padding:3px 6px;background:#030304;color:#F6F6F6}
.v6-fr em.sube{color:#3FE0B8}.v6-fr em.baja{color:#FF6B70}.v6-fr em.nuevo{color:#7FC0FF}
.v6-dt{display:grid;justify-items:center;gap:3px;width:48px;padding:6px 0 5px;margin-top:6px;border-top:2px solid color-mix(in srgb,var(--ink) 60%,transparent)}
.v6-dt+.v6-dt{margin-top:0}
/* el rango: placa negra con la figura y la letra en el color del rango, como la pastilla de las otras cartas */
.v6-rg .pl{display:flex;align-items:center;justify-content:center;gap:3px;min-width:50px;height:24px;padding:0 5px;background:#030304;
  box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--rc,#888) 55%,transparent)}
.v6-rg .pl svg{flex:none;width:17px;height:17px}
.v6-rg .pl b{font:400 17px/1 Anton,sans-serif;color:var(--rc);letter-spacing:.02em}
.v6-rg .pl.falta{gap:2px;box-shadow:none;background:color-mix(in srgb,#030304 82%,transparent)}
.v6-rg .pl.falta b{font:400 14px/1 Anton,sans-serif;color:#C9C9C4}
.v6-rg .pl.falta i{font:700 9px/1 "Barlow Condensed",sans-serif;font-style:normal;letter-spacing:.1em;color:#8E8E88;align-self:flex-end;margin-bottom:5px}
.v6-dt b{font:400 24px/1 Anton,sans-serif;white-space:nowrap}
/* las últimas: cinco cuadritos, G de la tinta y P hueca, la más nueva abajo a la derecha */
.v6-u5>span{display:flex;gap:2px}
.v6-u5 i{width:8px;height:12px;font-size:0;background:var(--ink)}
.v6-u5 i.p{background:transparent;box-shadow:inset 0 0 0 1.5px var(--ink);opacity:.7}
/* el logo de la liga, nítido y sin círculo: al pie de la franja */
.v6-logo{margin-top:auto;margin-bottom:18px;display:grid;place-items:center;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))}
.v6-logo img{width:42px;height:32px;object-fit:contain}
.v6-vert-viejo{flex:1;min-height:0;margin:8px 0 10px;text-align:center;writing-mode:vertical-rl;transform:rotate(180deg);
  font-family:Anton,sans-serif;font-weight:400;line-height:1;letter-spacing:.06em;white-space:nowrap;opacity:.78;overflow:hidden}
/* el brillo iridiscente (21st «Iridescent Foil»), quieto: sólo podio y 1.º */
.v6-foil{position:absolute!important;inset:0;z-index:0!important;display:none;mix-blend-mode:soft-light;
  background:linear-gradient(112deg,transparent 18%,rgba(0,220,255,.55) 28%,rgba(80,255,190,.45) 36%,rgba(255,230,70,.4) 46%,rgba(255,70,180,.5) 58%,rgba(150,90,255,.5) 68%,transparent 80%),
  radial-gradient(ellipse at 30% 20%,rgba(255,255,255,.7),transparent 45%),linear-gradient(160deg,rgba(255,255,255,.35),transparent 40%,rgba(255,255,255,.25) 70%,transparent)}
.v6.pod .v6-foil{display:block;bottom:auto;height:140px}
.v6.n1 .v6-foil{display:block}

/* el nombre: rompe el borde izquierdo; doble contorno (negro afuera, color de la liga en el medio) y sombra dura */
.v6-nom{position:absolute;left:4px;top:318px;width:250px;height:1px;transform:rotate(-5deg);transform-origin:left bottom}
.v6-nom b{position:absolute;left:0;bottom:0;font-family:Anton,sans-serif;font-weight:400;line-height:.9;white-space:nowrap;letter-spacing:.01em;
  transform:scaleX(var(--sx));transform-origin:left bottom}
.v6-nom .o{color:#030304;-webkit-text-stroke:13px #030304;text-shadow:7px 7px 0 #030304}
.v6-nom .m{color:var(--c);-webkit-text-stroke:7px var(--c)}
.v6-nom .f{color:#F6F6F6;-webkit-mask:url("GRANO_T") 0 0 / 180px 180px;mask:url("GRANO_T") 0 0 / 180px 180px}
.v6.n1 .v6-nom .f{color:NEON}

/* la cinta: con transparencia, arrugas y los cortes en zigzag */
.v6-cinta{position:absolute;height:24px;background:rgba(238,232,212,.74);box-shadow:0 1px 1px rgba(0,0,0,.25);
  clip-path:polygon(0 10%,5% 0,10% 12%,15% 0,85% 0,90% 12%,95% 0,100% 10%,100% 90%,95% 100%,90% 88%,85% 100%,15% 100%,10% 88%,5% 100%,0 90%);
  background-image:linear-gradient(90deg,transparent 30%,rgba(255,255,255,.35) 32%,transparent 36%,transparent 62%,rgba(0,0,0,.08) 64%,transparent 68%)}
.v6-cinta.a{left:226px;top:2px;width:84px;transform:rotate(14deg)}
.v6-cinta.b{left:150px;top:438px;width:66px;transform:rotate(-7deg)}
.v6-cinta-pod{position:absolute;left:44px;top:404px;padding:4px 22px;background:#F6F6F6;color:#030304;font:400 16px/1 Anton,sans-serif;letter-spacing:.2em;
  transform:rotate(-4deg);box-shadow:0 2px 0 #030304}
.v6-corona{position:absolute;left:262px;top:-30px;width:90px;transform:rotate(9deg)}
.v6.n1 .v6-cinta.a{display:none}
/* la estrella del 1.º: pegada al lado del OVR, como una calcomanía sobre la foto */
.v6-estrella{position:absolute;left:126px;top:90px;width:56px;transform:rotate(14deg);filter:drop-shadow(2px 3px 0 rgba(0,0,0,.55))}
.v6-num.sin{font-size:40px;margin:18px 0 14px}
.v6-num.dos{font-size:64px;letter-spacing:-.02em;margin:12px 0 8px}
.v6-solapa{position:absolute;width:30px;height:30px;filter:drop-shadow(2px 3px 2px rgba(0,0,0,.45))}
.v6-solapa.a{left:24px;top:34px}
.v6.n1 .v6-solapa.a{width:40px;height:40px}
'''


def armar_css():
    return (CSS.replace('MASCARA', AF.MASCARA).replace('AFUERA', AFUERA).replace('NEON', NEON)
            .replace('GRANO_T', "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'>"
                     "<feTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='2' seed='11'/><feColorMatrix type='luminanceToAlpha'/>"
                     "<feComponentTransfer><feFuncA type='discrete' tableValues='1 1 1 1 0 1 1'/></feComponentTransfer></filter>"
                     "<rect width='100%' height='100%' filter='url(%23n)'/></svg>"))
