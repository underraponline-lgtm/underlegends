# -*- coding: utf-8 -*-
"""🧰 EL KIT DEL ORGANIZADOR: /afiche y /llave dibujan la imagen y se la contestan a quien la pidió.

    python bot/kit.py --tipo afiche --sv FFA              dibuja y guarda en salida/kit_*.png, sin subir nada
    python bot/kit.py --tipo llave --sv FFA --id <id>     dibuja, sube a R2 y le avisa al objeto (la tarea kit.yml)
    python bot/kit.py --tipo vs --sv FFA --id <id>        los vs que esperan su imagen (el bot en vivo, `vsEncolar()`)
    python bot/kit.py --tipo vs --sv FFA --muestra a b    un vs de muestra con dos de la tabla, en salida/, sin subir
    python bot/kit.py --auto                              el self-check

Dlx, 12/10/2026, a la vista previa del kit en FFA: *«eso de la llave y el evento está genial la verdad, crear un comando
ÚNICAMENTE para aquellos que tienen rol de staff u organizador en cada servidor»*.

CÓMO VIAJA
  1. El Worker recibe /afiche o /llave, mira que sea staff u organizador, contesta «lo estoy armando» (diferido) y
     guarda el permiso para contestar ESE mensaje en el objeto, con un id al azar (`/kit` en avisos.js).
  2. Prende `.github/workflows/kit.yml` con el tipo, el servidor y el id. ⚠️ EL PERMISO NO VIAJA: el repo es público y
     lo que se le pasa a una tarea se ve desde afuera; con el permiso, cualquiera podría escribir como ULAYA.
  3. Esto lee lo más nuevo de Discord (no lo del repo: un anuncio de hace dos minutos todavía no está en `datos/`),
     dibuja, sube la imagen a R2 y le pasa la URL al objeto (`/avisos/kit-listo`, con la clave del ciclo), que edita
     la respuesta con la imagen.
"""
import base64
import datetime as dt
import html
import io
import json
import os
import re
import sys
import clave_ciclo as CC  # noqa: E402  la clave del ciclo, en un solo lugar

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path[:0] = [SCR, os.path.join(BASE, 'sheet'), BASE]

#: hasta qué antigüedad un anuncio o una llave cuentan como «el de ahora»
HORAS = 48
SALIDA = os.path.join(BASE, 'salida')


def _e(s):
    return html.escape(str(s or ''), quote=True)


def _sv_datos(sv):
    d = json.load(io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8'))['servidores'].get(sv) or {}
    try:
        col = (json.load(io.open(os.path.join(BASE, 'datos', 'colores_sv_marca.json'), encoding='utf-8')).get('usar')
               or {}).get(sv)
    except (OSError, ValueError):
        col = None
    logo = ''
    p = os.path.join(BASE, 'bot', 'paginas', 'logos', sv.lower() + '.webp')
    if os.path.exists(p):
        logo = 'data:image/webp;base64,' + base64.b64encode(open(p, 'rb').read()).decode()
    return {'sv': sv, 'nombre': d.get('nombre') or sv, 'guild': str(d.get('guild_id') or ''), 'color': col or '#26045B',
            'logo': logo}


_BANDERA = re.compile('[\U0001F1E6-\U0001F1FF]{2}')


def _nombre(x):
    """Un nombre de la llave con su bandera como imagen (la del repo, `comun/banderas.py`): el emoji sale en letras."""
    x = str(x or '')
    fl = _BANDERA.findall(x)
    nom = _e(re.sub(r'\s+', ' ', _BANDERA.sub(' ', x)).strip())
    if not fl:
        return nom
    try:
        from comun import banderas as BA
        cc = ''.join(chr(ord(c) - 0x1F1E6 + 97) for c in fl[0])
        src = BA.src(cc)
    except Exception:                                    # noqa: BLE001
        src = ''
    return nom + (' <img class="fl" src="%s" alt="">' % src if src else '')


def _fuentes():
    try:
        return io.open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8').read()
    except OSError:
        return ''


# ── lo más nuevo de Discord ──────────────────────────────────────────────────────────────────────────────────────────
def anuncio_de(sv, ahora=None):
    """El anuncio más nuevo de ese servidor, de las últimas `HORAS`, o `None`."""
    import anuncios as AN
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    s = AN._sesion()
    anuncios, _ins = AN.leer(s)
    cands = []
    for a in anuncios or []:
        if (a.get('servidor') or '') != sv:
            continue
        try:
            t = dt.datetime.fromisoformat(str(a.get('cuando') or '').replace('Z', '+00:00'))
            if t.tzinfo is None:
                t = t.replace(tzinfo=dt.timezone.utc)
        except ValueError:
            continue
        if (ahora - t).total_seconds() <= HORAS * 3600:
            cands.append((t, a))
    return max(cands, key=lambda x: x[0])[1] if cands else None


def llave_de(sv, guild, ahora=None):
    """La llave más nueva de ese servidor, de las últimas `HORAS`: `(título, [(ronda, [lados], ganador)])` o `None`."""
    import escuchar as E
    import llaves_a_entrada as L
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    s = E.sesion()
    can = {cid: x for cid, x in ((E.conocidos() or {}).get('canales') or {}).items()
           if str((x or {}).get('guild') or '') == guild}
    if not can:
        return None
    ll, _n, _m = E.barrer(s, por_canal=15, solo=can)
    cands = []
    for h in ll or []:
        try:
            t = dt.datetime.fromisoformat(str(h.get('cuando') or '').replace('Z', '+00:00'))
        except ValueError:
            continue
        if (ahora - t).total_seconds() <= HORAS * 3600:
            cands.append((t, h))
    if not cands:
        return None
    h = max(cands, key=lambda x: x[0])[1]
    rondas = [(r, comps, gan) for r, comps, gan, _por in E.resolver(h.get('texto') or '')]
    return (L.titulo(h.get('texto') or '') or 'La llave').strip(' _*~'), rondas


# ── el dibujo ────────────────────────────────────────────────────────────────────────────────────────────────────────
_BASE_CSS = """
*{box-sizing:border-box;margin:0}
body{background:transparent}
.f{font-family:'Archivo',sans-serif;color:#fff}
.et{font-family:'Barlow Condensed','Archivo',sans-serif;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.liga{height:8px;background:linear-gradient(90deg,#29B298 50%,#E41373 50%)}
"""


def html_afiche(a, sv, d):
    """El afiche cuadrado (1080) de un anuncio."""
    try:
        import cuando as C
        t = C.momento(a)
        t = dt.datetime.fromisoformat(t.replace('Z', '+00:00')) if t else None
    except Exception:                                    # noqa: BLE001
        t = None
    dias = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']
    cuando = ('%s %s' % (dias[(t - dt.timedelta(hours=4)).weekday()], (t - dt.timedelta(hours=4)).strftime('%d/%m'))
              if t else (a.get('fecha') or 'HOY'))
    hora = a.get('horario') or ''
    # ⚠️ «EN 1 HORA» es la hora relativa del momento del anuncio: el afiche se pide después y ya no es cierta
    if not re.search(r'\d{1,2}\s*(?::\d{2})?\s*(?:am|pm|hs|h\b)|\d{1,2}:\d{2}', hora, re.I) and t:
        et_ = t - dt.timedelta(hours=4)
        hora = et_.strftime('%I:%M %p').lstrip('0') + ' ET'
    cupos = a.get('cupo_total') or a.get('cupos_texto') or ''
    nom = re.sub(r'[_*~`#>]+', ' ', a.get('nombre') or 'Evento').strip()
    datos = [('Cuándo', cuando), ('Hora', hora[:22]), ('Modalidad', (a.get('modalidad') or '')[:18]), ('Cupos', str(cupos)[:12])]
    datos = [x for x in datos if x[1]][:3]
    celdas = ''.join('<div><span class="et">%s</span><b>%s</b></div>' % (_e(k), _e(v)) for k, v in datos)
    return """<!doctype html><html><head><meta charset="utf-8"><style>%s%s
#c{width:1080px;height:1080px;position:relative;overflow:hidden;background:%s;padding:84px;display:flex;flex-direction:column;justify-content:space-between}
#c:before{content:"";position:absolute;right:-220px;bottom:-320px;width:860px;height:860px;border-radius:50%%;background:rgba(255,255,255,.10)}
#c>*{position:relative}
.cab{display:flex;justify-content:space-between;align-items:center}
.cab img{width:220px;height:220px;border-radius:50%%;object-fit:cover;box-shadow:0 0 0 8px #fff}
.cab .et{font-size:30px;text-align:right;line-height:1.3}
.cab .liga{margin-top:12px}
.nom{font-weight:900;font-size:%dpx;line-height:.92;text-transform:uppercase;font-stretch:118%%;letter-spacing:-.01em}
.datos{display:grid;grid-template-columns:repeat(%d,1fr);gap:28px}
.datos div{border-top:4px solid rgba(255,255,255,.75);padding-top:14px}
.datos span{display:block;font-size:24px;opacity:.8}
.datos b{font-weight:800;font-size:40px;line-height:1.1}
.pie{display:flex;justify-content:space-between;font-size:26px}
</style></head><body><div id="c" class="f">
<div class="cab"><img src="%s" alt=""><div class="et">Liga Global<br>suma al ranking<div class="liga"></div></div></div>
<div class="nom">%s</div>
<div class="datos">%s</div>
<div class="pie et"><span>%s</span><span>underlegends.pages.dev</span></div>
</div></body></html>""" % (_fuentes(), _BASE_CSS, _e(d['color']), 150 if len(nom) <= 18 else 112 if len(nom) <= 34 else 84,
                             max(1, len(datos)), d['logo'], _e(nom), celdas, _e(d['nombre']))


def html_llave(titulo, bats, sv, d):
    """La llave como cuadro. `bats` = `[(ronda, [lados], ganador)]`, una por BATALLA (lo que da `escuchar.resolver()`):
    una columna por ronda, en el orden en que aparecen, el que pasó en negrita y el campeón abajo."""
    orden, por = [], {}
    for r, comps, gan in bats:
        if r not in por:
            orden.append(r)
            por[r] = []
        por[r].append((list(comps or []), gan))
    cols, camp = [], None
    for r in orden:
        cajas = ''.join('<div class="bat">%s</div>' % ''.join(
            '<div class="%s">%s</div>' % ('g' if gan and str(x) == str(gan) else '', _nombre(x)) for x in comps)
            for comps, gan in por[r])
        cols.append('<div class="ronda"><h4 class="et">%s</h4><div class="bs">%s</div></div>' % (_e(str(r).title()), cajas))
        if str(r).upper().replace(' ', '') in ('FINAL', 'GRANFINAL') and por[r][-1][1]:
            camp = por[r][-1][1]
    return """<!doctype html><html><head><meta charset="utf-8"><style>%s%s
#c{width:%dpx;background:%s;padding:44px;display:flex;flex-direction:column;gap:26px}
.cab{display:flex;align-items:center;gap:22px}
.cab img{width:96px;height:96px;border-radius:50%%;object-fit:cover}
.cab b{display:block;font-weight:900;font-size:44px;text-transform:uppercase;line-height:1}
.cab .et{font-size:22px;opacity:.8}
.cuadro{display:flex;gap:22px;align-items:stretch}
.ronda{flex:1;min-width:0;display:flex;flex-direction:column;gap:12px}
.ronda h4{font-size:22px;opacity:.85}
.ronda .bs{flex:1;display:flex;flex-direction:column;justify-content:space-around;gap:12px}
.fl{height:.8em;width:auto;vertical-align:.02em;margin-left:6px;border-radius:2px}
.bat{background:rgba(0,0,0,.28);border-left:5px solid rgba(255,255,255,.3);padding:9px 12px;font-size:23px;font-weight:500}
.bat div{opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bat div.g{opacity:1;font-weight:800}
.camp{display:flex;gap:16px;align-items:baseline;font-weight:900;font-size:40px;text-transform:uppercase}
.camp .et{font-size:22px;color:#FFD24A}
</style></head><body><div id="c" class="f">
<div class="liga"></div>
<div class="cab"><img src="%s" alt=""><div><b>%s</b><span class="et">%s · Liga Global</span></div></div>
<div class="cuadro">%s</div>
%s
</div></body></html>""" % (_fuentes(), _BASE_CSS, max(1080, 300 * len(cols) + 88), _e(d['color']), d['logo'],
                            _e(titulo[:60]), _e(d['nombre']), ''.join(cols),
                            '<div class="camp"><span class="et">Campeón</span>%s</div>' % _nombre(camp) if camp else '')


#: 📊 la curva de la barra de quién gana: con esta diferencia, el de arriba tiene 10 a 1 (la misma forma que el Elo)
PROB_SCORE = 30
PROB_OVR = 40


def prob_vs(a, b):
    """📊 QUIÉN GANA, PARA LA BARRA DEL VS (Dlx, 13/10/2026: «agregar una barra diciendo con el porcentaje de ganar para
    cada uno, incluyendo uno ?? para los que no se pueda hacer»). `(pa, pb, por)` en enteros que suman 100, o `None`.

    Con el Score competitivo de los dos —la calidad, que es lo que mide—; si no, con el OVR de la temporada; si a uno
    le falta, no se inventa: `None`, y la imagen dice «??». La forma es la del Elo: con 10 puntos de OVR de diferencia el
    de arriba queda en ~64 %, con 20 en ~76 %. Nunca 0 ni 100: entre 3 y 97, porque una batalla nunca está ganada."""
    a, b = a or {}, b or {}
    for campo, escala, por in (('sc', PROB_SCORE, 'Score'), ('ovr', PROB_OVR, 'OVR')):
        try:
            xa, xb = float(a.get(campo) or 0), float(b.get(campo) or 0)
        except (TypeError, ValueError):
            continue
        if xa > 0 and xb > 0:
            p = 1 / (1 + 10 ** ((xb - xa) / escala))
            pa = min(97, max(3, int(round(p * 100))))
            return pa, 100 - pa, por
    return None


#: 🧾 el alto de la tira de debajo de cada carta (la letra, los últimos 5 y la racha), contra el alto de la carta
TIRA = 0.13
#: 🎨 el color de cada lado en los otros formatos: el magenta de la Liga, el dorado, el verde, el celeste y el blanco
COLORES_LADO = ('#E41373', '#FFD24A', '#29B298', '#58A6FF', '#FF7A1A', '#B26BFF')


def prob_lados(grupos):
    """📊 QUIÉN GANA CON MÁS DE UNO POR LADO O MÁS DE DOS LADOS (19/10/2026, Dlx: «necesitamos ahí la información aún, o
    sea la data como quién es más probable que gane»). La fuerza de cada lado es el PROMEDIO de los suyos —con el Score si
    lo tienen todos, si no con el OVR (al menos uno por lado)— y la cuenta es la de `prob_vs()` llevada a N lados: con dos
    da lo mismo. `(ps, por)` con enteros que suman 100, o `None` si de un lado no se sabe nada: la imagen dice «??».

    ⚠️ PROMEDIO Y NO SUMA: con la suma, ocho contra uno lo ganarían siempre los ocho, y la barra diría cuántos son, no
    qué tan buenos. Nunca 0 ni 100, como en el mano a mano."""
    lados = [[y for y in (g or []) if y] for g in (grupos or [])]
    lados = [g for g in lados if g]
    if len(lados) < 2:
        return None
    for campo, escala, por in (('sc', PROB_SCORE, 'Score promedio'), ('ovr', PROB_OVR, 'OVR promedio')):
        vals = []
        for g in lados:
            xs = []
            for y in g:
                try:
                    x = float(y.get(campo) or 0)
                except (TypeError, ValueError):
                    x = 0.0
                if x > 0:
                    xs.append(x)
            if not xs or (campo == 'sc' and len(xs) != len(g)):
                vals = None
                break
            vals.append(sum(xs) / len(xs))
        if not vals:
            continue
        if len(vals) == 2:
            p = 1 / (1 + 10 ** ((vals[1] - vals[0]) / escala))
            pa = min(97, max(3, int(round(p * 100))))
            return [pa, 100 - pa], por
        pesos = [10 ** ((x - max(vals)) / escala) for x in vals]
        crudo = [100 * w / sum(pesos) for w in pesos]
        ps = [int(x) for x in crudo]
        for i in sorted(range(len(ps)), key=lambda i: crudo[i] - ps[i], reverse=True)[:100 - sum(ps)]:
            ps[i] += 1
        # nadie en 0: el que quedó abajo de 2 se lleva de lo del primero
        for i in range(len(ps)):
            if ps[i] < 2:
                j = ps.index(max(ps))
                ps[j] -= 2 - ps[i]
                ps[i] = 2
        return ps, por
    return None


def acomodar(n, ancho, alto, gap=12, solapa=0.2, ratio=0.685):
    """El tamaño de las tarjetas de un lado: en una fila o en dos, y desde tres superpuestas un poco, como una mano de
    cartas (la idea de «Card Hand Gallery» de 21st), lo que las deje más grandes. Así un 8 contra 1 sigue leyéndose:
    los ocho en dos filas de cuatro y el uno, grande. `(filas, por_fila, alto, ancho, paso)`."""
    mejor = None
    for filas in (1, 2):
        if filas > n:
            break
        c = -(-n // filas)
        h_fila = (alto - (filas - 1) * gap) / filas
        o = solapa if c >= 3 else 0
        w_max = (ancho - (0 if o else (c - 1) * gap)) / (c - (c - 1) * o)
        h = min(h_fila, w_max / ratio)
        w = h * ratio
        paso = w * (1 - o) if o else w + gap
        if mejor is None or h > mejor[2] + 1:
            mejor = (filas, c, h, w, paso)
    return mejor


_DEFS = None
VS_GESTO = 400          # el ancho al que se repite un dibujo de la camiseta en el VS


def _defs_camisetas():
    """👕 Las camisetas de los servidores: `defs()` de `03_Servidor/disenos/los_nueve.py`, la misma definición de su tarjeta
    (un solo lugar: si una cambia, cambia acá). Sin ese módulo o sin sus texturas, `{}`: el VS cae al color del servidor."""
    global _DEFS
    if _DEFS is None:
        try:
            ruta = os.path.join(BASE, '03_Servidor', 'disenos')
            if ruta not in sys.path:
                sys.path.insert(0, ruta)
            import los_nueve
            _DEFS = los_nueve.defs()
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ sin las camisetas de los servidores: %s' % str(e)[:100])
            _DEFS = {}
    return _DEFS


def _rgb(hx):
    hx = str(hx or '').lstrip('#')
    try:
        return tuple(int(hx[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return (128, 128, 128)


def _luz(hx):
    """La luminancia relativa de un color (0 negro, 1 blanco), para decidir contra qué se lee."""
    def canal(c):
        c /= 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = _rgb(hx)
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)


def _mezcla(hx, otro, f):
    a, b = _rgb(hx), _rgb(otro)
    return '#%02x%02x%02x' % tuple(int(round(x + (y - x) * f)) for x, y in zip(a, b))


def _fondo_vs(sv):
    """🌆 EL FONDO ORIGINAL DEL VS DE UN SERVIDOR (Dlx, 04/11/2026: «the background of each server should be original and
    not the same as the card»): una escena propia en `bot/vs_fondos/<sv>.jpg`, que no sale de su tarjeta. `url(...)` o `''`."""
    p = os.path.join(BASE, 'bot', 'vs_fondos', '%s.jpg' % str(sv or '').lower())
    if not sv or not os.path.exists(p):
        return ''
    with open(p, 'rb') as f:
        return 'url(data:image/jpeg;base64,%s) center/cover no-repeat' % base64.b64encode(f.read()).decode('ascii')


def camiseta(d):
    """👕 CÓMO SE VISTE UN VS DE ESE SERVIDOR (Dlx, 04/11/2026: «me gustaría que sea relacionada a cada servidor más»). Antes el
    fondo salía del color de la letra de cada uno, así que un mismo servidor se veía distinto en cada cruce y el servidor
    era un logo chiquito abajo. Ahora el fondo es SU CAMISETA —el mármol y el templo de la Academia, la pared de Urban, la
    galaxia de DDF, el laurel de FVS—, y la costura y el VS llevan SU color. `{fondo, capa, placa, sobre_placa, costura,
    a, b}`, donde `a` y `b` son los colores de los dos lados: siempre uno de cada lado que se distingan y se lean sobre
    negro. Un servidor sin camiseta (FDS, LKR) va con unas bandas hechas de su color."""
    sv = str(d.get('sv') or '')
    base_sv = d.get('color') or '#26045B'
    de = _defs_camisetas().get(sv) if sv else None
    if de:
        acento, base, fondo, capa = de[0], de[1], de[2], de[3]
        # 🧱 lo que está dibujado para una carta de 300 de ancho (la pared de Urban, el templo de la Academia, el laurel de
        # FVS) se repite a lo ancho y apoyado abajo: un SVG conserva su proporción, y estirado quedaba como un bloque en el medio
        fondo = re.sub(r'0 0/\s*300px\s+(\d+)px\s+no-repeat',
                       lambda m: '0 100%%/%dpx %dpx repeat-x' % (VS_GESTO, round(int(m.group(1)) * VS_GESTO / 300)), fondo)
    else:
        base = _mezcla(base_sv, '#030304', 0.45)
        acento = base_sv
        fondo = ('linear-gradient(146deg,%s 0 54%%,%s 54%% 58%%,%s 58%% 100%%)'
                 % (_mezcla(base_sv, '#030304', 0.35), _mezcla(base_sv, '#FFFFFF', 0.25), _mezcla(base_sv, '#030304', 0.72)))
        capa = ''
    # 🎨 el color de la placa del VS y la costura: su acento; si es casi blanco, su color de base (el blanco no dice de quién es)
    placa = acento if _luz(acento) < 0.72 or _luz(base) < 0.03 else base
    # los dos lados: el acento (o, si es muy oscuro para leerse sobre negro, aclarado) y el blanco
    a = acento if _luz(acento) >= 0.18 else _mezcla(acento, '#FFFFFF', 0.55)
    if _luz(a) > 0.72:
        a = _mezcla(base_sv if _luz(base_sv) < 0.72 else base, '#FFFFFF', 0.25)
        if _luz(a) < 0.18:
            a = _mezcla(a, '#FFFFFF', 0.45)
    escena = _fondo_vs(sv)
    if escena:
        fondo, capa = escena, ''
    if sum((x - y) ** 2 for x, y in zip(_rgb(a), _rgb('#F6F6F6'))) ** 0.5 < 90:
        a = _mezcla(a, '#030304', 0.35)          # un acento casi blanco (FVS) no se distingue del lado blanco
    return {'fondo': fondo, 'capa': capa, 'placa': placa, 'sombra': 0 if escena else 0.34,
            'luz': placa, 'luz_m': _mezcla(placa, '#030304', 0.6), 'luz_f': _mezcla(placa, '#030304', 0.86),
            'sobre_placa': '#030304' if _luz(placa) > 0.30 else '#F6F6F6',
            'costura': '#030304' if _luz(placa) > 0.62 else '#F6F6F6',
            'a': a, 'b': '#F6F6F6'}


def _css_suelo(ca):
    """El CSS de lo que comparten los dos armados del VS: el suelo con la camiseta, el pronóstico, el escudo y el evento."""
    return """
#c{width:1200px;height:675px;position:relative;overflow:hidden;background:#030304;color:#F6F6F6}
#c .cami,#c .cami-capa,#c .sombra,#c .costura{position:absolute;inset:0}
#c .cami{background:%(fondo)s}
#c .cami-capa{%(capa)s}
#c .sombra{background:rgba(3,3,4,%(sombra)s);clip-path:polygon(55.5%% 0,100%% 0,100%% 100%%,44.5%% 100%%)}
#c .costura{background:%(placa)s;clip-path:polygon(54.7%% 0,56.3%% 0,45.3%% 100%%,43.7%% 100%%)}
#c .costura.dentro{background:%(costura)s;clip-path:polygon(55.2%% 0,55.8%% 0,44.8%% 100%%,44.2%% 100%%)}
#c .et{text-transform:uppercase}
#c .pr{position:absolute;left:32px;right:32px;top:20px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:center}
#c .pr>b{font-weight:900;font-size:40px;line-height:1;background:#030304;padding:5px 10px 4px;min-width:62px;text-align:center}
#c .pr-b{position:relative;height:22px;background:#030304}
#c .pr-b i{position:absolute;top:0;bottom:0}
#c .pr-b i.l{left:0;clip-path:polygon(0 0,100%% 0,calc(100%% - 14px) 100%%,0 100%%)}
#c .pr-b i.r{right:0;clip-path:polygon(14px 0,100%% 0,100%% 100%%,0 100%%)}
#c .pr-b .et{position:absolute;top:26px;transform:translateX(-50%%);white-space:nowrap;font-size:16px;letter-spacing:.1em;background:#030304;padding:3px 8px 2px}
#c .fav{position:absolute;top:66px;font-weight:900;font-style:italic;font-size:17px;line-height:1;letter-spacing:.03em;text-transform:uppercase;
  background:%(placa)s;color:%(sobre_placa)s;padding:5px 11px 4px;z-index:31}
#c .fav.izq{left:32px}
#c .fav.der{right:32px}
#c .pie.col span.fav{position:static;background:%(placa)s;color:%(sobre_placa)s;font-size:12px;padding:3px 8px 2px;margin-top:3px}
#c .pr.nada .pr-b{background:#3A3A3E}
#c .pr.nada>b{color:#A5A5A0}
#c .pr.nada .pr-b .et{left:50%%}
#c .pr.varios{grid-template-columns:minmax(0,1fr)}
#c .pr.varios .pr-b{display:flex;gap:4px;background:none}
#c .pr.varios .pr-b i{position:static;display:block;height:100%%}
#c .gana{position:absolute;left:32px;right:32px;top:18px;display:flex;justify-content:center;z-index:50}
#c .gana b{font-weight:900;font-style:italic;line-height:1;text-transform:uppercase;background:#F6F6F6;color:#030304;padding:8px 18px 6px;
  max-width:1100px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#c .escudo{position:absolute;left:50%%;transform:translateX(-50%%);border-radius:50%%;background:#030304;object-fit:cover;box-sizing:border-box;
  border:4px solid %(placa)s;box-shadow:0 0 0 3px #030304;z-index:32}
#c .sigla{display:grid;place-items:center;font-weight:900;color:#F6F6F6}
#c .evento{position:absolute;left:50%%;bottom:10px;transform:translateX(-50%%);max-width:336px;box-sizing:border-box;background:#030304;padding:6px 14px 6px;text-align:center;z-index:30}
#c .evento b{display:block;font-weight:800;font-size:17px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase}
#c .evento span{display:block;font-size:15px;line-height:1.15;letter-spacing:.1em;color:#A5A5A0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#c .sin,#c .gs{position:relative;width:300px;height:440px;flex:none}
#c .sc-marco,#c .sc-in{position:absolute;left:0;top:30px;width:300px;height:405px}
#c .sc-marco{background:%(placa)s}
#c .sc-in{transform:scale(.97);background:radial-gradient(ellipse 72%% 52%% at 50%% 40%%,%(luz)s 0%%,%(luz_m)s 52%%,%(luz_f)s 100%%);overflow:hidden}
#c .sc-rayos{position:absolute;inset:0;background:repeating-conic-gradient(from 0deg at 50%% 40%%,rgba(255,255,255,.09) 0 7deg,transparent 7deg 17deg)}
#c .sil{position:absolute;left:18px;width:264px;object-fit:contain;object-position:50%% 100%%}
#c .sc-fila{display:flex;align-items:center;gap:8px}
#c .sc-stats{display:flex;gap:16px}
#c .sc-stats span{display:flex;flex-direction:column;align-items:center;font-weight:800;font-size:10px;letter-spacing:.08em;line-height:1.1;text-transform:uppercase;color:#A5A5A0}
#c .sc-stats b{font-weight:900;font-size:17px;letter-spacing:0;color:#F6F6F6;line-height:1.05;text-transform:none}
#c .ov{display:flex;align-items:baseline;gap:4px;color:#A5A5A0;border:1.5px solid #4a4a4e;padding:1px 9px 0;font-weight:800;font-size:12px;letter-spacing:.08em;line-height:21px}
#c .ov b{font-weight:900;font-size:17px;color:#F6F6F6;letter-spacing:0}
#c .sc-pie{position:absolute;left:0;right:0;top:270px;bottom:0;background:#08080b;border-top:4px solid %(placa)s;display:flex;flex-direction:column;align-items:center;gap:7px;padding-top:10px}
#c .sc-pie b{font-weight:900;line-height:1.05;text-transform:uppercase;max-width:262px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#F6F6F6}
#c .sc-tag{font-weight:800;font-size:13px;letter-spacing:.14em;line-height:21px;text-transform:uppercase;color:#A5A5A0;border:1.5px solid #4a4a4e;padding:1px 10px 0}
#c .ul-m{position:absolute;right:22px;bottom:16px;height:36px;width:auto;z-index:30;filter:drop-shadow(0 1px 3px #000)}
#c .t-m{position:absolute;left:24px;bottom:16px;font-weight:900;font-style:italic;font-size:32px;line-height:36px;color:#F6F6F6;z-index:30;text-shadow:0 1px 4px #000}
#c .sc-esc{position:absolute;left:50%%;top:0;width:60px;height:60px;transform:translateX(-50%%);border-radius:50%%;object-fit:cover;background:#030304;
  border:3px solid %(placa)s;box-shadow:0 0 0 2px #030304}
#c .fl{height:.75em;width:auto;vertical-align:.04em;margin-left:6px}
#c .perdio{filter:grayscale(1) brightness(.92);opacity:.78}
""" % ca


def _linea_html(p1, p2, ancho=10, adentro=3.5, horizontal=False):
    """Una línea entre dos puntos, de borde a borde: la banda del color del servidor y su núcleo. En píxeles, como la imagen."""
    def banda(m):
        if horizontal:
            return 'polygon(0 %.1fpx,1200px %.1fpx,1200px %.1fpx,0 %.1fpx)' % (p1 - m, p2 - m, p2 + m, p1 + m)
        return 'polygon(%.1fpx 0,%.1fpx 0,%.1fpx 675px,%.1fpx 675px)' % (p1 - m, p1 + m, p2 + m, p2 - m)
    return ('<div class="costura" style="clip-path:%s"></div><div class="costura dentro" style="clip-path:%s"></div>' % (banda(ancho), banda(adentro)))


def colores_lados(ca, S):
    """🎨 Un color por lado, sin dos parecidos (Dlx, 04/11/2026: en la Academia el amarillo del 1.º se confundía con el fijo del
    4.º). Los dos primeros son los del servidor; los demás, de `COLORES_LADO`, el que más se separe de los que ya están."""
    def dist(p, q):
        return sum((x - y) ** 2 for x, y in zip(_rgb(p), _rgb(q))) ** 0.5
    cols = [ca['a'], ca['b']]
    while len(cols) < S:
        cols.append(max((c for c in COLORES_LADO if c not in cols), key=lambda c: min(dist(c, o) for o in cols)))
    return cols


def _suelo_html(lineas='', sombras=None):
    """El fondo y las líneas. Sin nada, la costura del mano a mano. Con `lineas`, ésas: una línea por cada frontera entre lados.
    `sombras` son los `clip-path` de los lados que van más oscuros, para los servidores sin escena propia."""
    if not lineas:
        return '<div class="cami"></div><div class="cami-capa"></div><div class="sombra"></div><div class="costura"></div><div class="costura dentro"></div>'
    somb = ''.join('<div class="sombra" style="clip-path:%s"></div>' % c for c in (sombras or []))
    return '<div class="cami"></div><div class="cami-capa"></div>%s%s' % (somb, lineas)


def _escudo_html(d, tam, top):
    estilo = 'width:%dpx;height:%dpx;top:%dpx' % (tam, tam, top)
    if d.get('logo'):
        return '<img class="escudo" style="%s" src="%s" alt="">' % (estilo, d['logo'])
    # un servidor sin logo: su sigla en el mismo círculo
    return '<div class="escudo sigla" style="%s;font-size:%dpx">%s</div>' % (estilo, tam // 3, _e(str(d.get('sv') or d.get('nombre') or '')[:4]))


_UL_VS = None


def _esquinas_html():
    """🏷️ El logo de Under Legends en blanco en una esquina de abajo y la temporada en la otra (Dlx, 04/11/2026). La temporada
    sale de `comun/temporada.py`, el único lugar: cuando arranque la T2 cambia sola."""
    global _UL_VS
    if _UL_VS is None:
        try:
            with open(os.path.join(BASE, '01_Temporada', 'ul_blanco.png'), 'rb') as f:
                _UL_VS = 'data:image/png;base64,' + base64.b64encode(f.read()).decode('ascii')
        except OSError:
            _UL_VS = ''
    from comun.temporada import SELLO
    ul = '<img class="ul-m" src="%s" alt="">' % _UL_VS if _UL_VS else ''
    return '%s<span class="t-m">%s</span>' % (ul, _e(SELLO))


def _evento_html(v, d):
    ev = re.sub(r'[_*~`#>]+', ' ', str(v.get('ev') or '')).strip() or str(d.get('nombre') or 'Liga Global')
    if len(ev) > 34:
        ev = ev[:33].rstrip() + '…'
    return ('<div class="evento"><b style="font-size:%dpx">%s</b><span class="et">%s</span></div>'
            % (_px_nombre(ev, 400, 17, 12), _e(ev), _e(str(v.get('ronda') or d.get('nombre') or '')[:30])))


def _bandera_vs(fl):
    cps = [ord(c) - 0x1F1E6 for c in str(fl or '')]
    if len(cps) != 2 or not all(0 <= c < 26 for c in cps):
        return ''
    try:
        from comun import banderas as BA
        src = BA.src(''.join(chr(97 + c) for c in cps))
    except Exception:                                    # noqa: BLE001
        src = ''
    return ' <img class="fl" src="%s" alt="">' % src if src else ''


_SILS = {}
#: 📏 `figura: (alto, cuánto se hunde en el panel)`. Los cuatro dibujos no tienen la misma escala: uno es un primer plano y otro
#: el cuerpo entero, así que con el mismo alto el primero parecía el doble. Los bustos se hunden para esconder su corte recto;
#: el de cuerpo entero apoya los pies justo sobre el panel. Medido con su tinta en `_self_check()`.
SIL_ALTO = {0: (222, 10), 1: (190, 10), 2: (222, 0), 3: (222, 10)}
SIL_PANEL = 270


def _sil_vs(n):
    """🕴️ LA FIGURA SIN CARTA, CENTRADA POR SU CUERPO. Los cuatro dibujos de `comun/sin_foto.py` traen márgenes distintos y
    uno con el brazo estirado: centrados por su caja, cada cuerpo quedaba para otro lado y flotando (Dlx, 04/11/2026: «fix
    the position of the persons»). Acá se recorta a la tinta y se centra en el medio de su masa, con el pie abajo de todo:
    así apoyan sobre el panel, y a los bustos no se les ve el corte. Negra, como en las tarjetas."""
    from comun import sin_foto as SF
    i = SF.cual(n)
    if i not in _SILS:
        d = SF.FIGURAS[i][1]
        puntos = []
        for sub in d.split('M'):
            xs = [float(x) for x in re.findall(r'-?\d+\.?\d*', sub)]
            if len(xs) >= 6:
                puntos.append(list(zip(xs[0::2], xs[1::2])))
        # el centro de masa del contorno más grande (fórmula del polígono)
        grande = max(puntos, key=len)
        a = cx = 0.0
        for (x0, y0), (x1, y1) in zip(grande, grande[1:] + grande[:1]):
            t = x0 * y1 - x1 * y0
            a += t
            cx += (x0 + x1) * t
        cx = cx / (3 * a) if a else 0.0
        todos = [p for q in puntos for p in q]
        x_min, x_max = min(p[0] for p in todos), max(p[0] for p in todos)
        y_min, y_max = min(p[1] for p in todos), max(p[1] for p in todos)
        medio = max(cx - x_min, x_max - cx)
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%.1f %.1f %.1f %.1f" preserveAspectRatio="xMidYMax meet">'
               '<path fill="#050507" fill-rule="evenodd" d="%s"/></svg>' % (cx - medio, y_min, 2 * medio, y_max - y_min, d))
        _SILS[i] = 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode('utf-8')).decode()
    return _SILS[i]


def _carta_sin(y, d, clase, k=1.0):
    """🃏 LA CARTA DE QUIEN NO TIENE CARTA (Dlx, 04/11/2026: «we could improve that card»). Antes era una caja negra con una
    figura blanca: se leía como un error. Ahora es un retador misterioso con la forma de la carta de Servidor (`siluetas.PICO`):
    la figura negra a contraluz, los rayos y el marco del color del servidor, y abajo su nombre. Lleva su número sólo si lo tiene.
    `k` escala la carta entera, así se ve igual en un mano a mano que en un 8 contra 1."""
    from comun import siluetas as SIL
    from comun import sin_foto as SF
    n = str(y.get('n') or '¿?')
    ovr = '<span class="ov"><b>%d</b>OVR</span>' % y['ovr'] if y.get('ovr') else ''
    esc = '<img class="sc-esc" src="%s" alt="">' % d['logo'] if d.get('logo') else ''
    # 📊 lo que se sabe de quien todavía no tiene carta: lo que no sabe, no se dibuja (`sin dato no hay pieza`)
    stats = ''.join('<span><b>%s</b>%s</span>' % (v, t) for v, t in (
        (int(y.get('ev') or 0), 'Eventos'),
        ('%d/%d' % (int(y.get('dg') or 0), int(y.get('dt') or 0)), 'Duelos') if y.get('dt') else (0, ''),
        (int(y.get('pod') or 0), 'Podios')) if v and t)
    stats = '<div class="sc-stats">%s</div>' % stats if stats else ''
    alto, hunde = SIL_ALTO.get(SF.cual(n), (222, 10))
    lugar = 'top:%dpx;height:%dpx' % (SIL_PANEL + hunde - alto, alto)
    forma = "clip-path:path('%s')" % SIL.PICO.d
    return ('<div class="%s" style="zoom:%.3f"><div class="sc-marco" style="%s"></div><div class="sc-in" style="%s">'
            '<i class="sc-rayos"></i><img class="sil" style="%s" src="%s" alt=""><div class="sc-pie"><b style="font-size:%dpx">%s%s</b>'
            '<div class="sc-fila"><span class="sc-tag">Sin tarjeta</span>%s</div>%s</div></div>%s</div>'
            % (clase, k, forma, forma, lugar, _sil_vs(n), _px_nombre(n, 260, 34, 13, bool(y.get('fl'))), _e(n), _bandera_vs(y.get('fl')), ovr, stats, esc))


def _por_txt(por):
    """🧮 con qué se hizo la cuenta, en la imagen. ⚠️ EL OVR DEL PRONÓSTICO ES EL DE TEMPORADA y la carta que se ve puede ser la
    de ese servidor, con OTRO número: «por OVR» al lado de un 76 hace creer que es ése."""
    return 'OVR de temporada' if str(por).startswith('OVR') else 'Score'


def favorito(ps):
    """⭐ QUIÉN VA DE FAVORITO, DEL MISMO PRONÓSTICO DE LA BARRA (Dlx, 04/11/2026: «señalar si uno es favorito o no»).
    `(índice del lado, texto)` o `None` si están parejos: con menos de 12 puntos de diferencia (56 a 44) no hay favorito, y
    decir que lo hay sería inventarlo. Con 50 puntos (75 a 25) es «GRAN FAVORITO». Sirve para dos lados o para más: se mide
    al primero contra el segundo."""
    if not ps or len(ps) < 2:
        return None
    orden = sorted(range(len(ps)), key=lambda i: -ps[i])
    dif = ps[orden[0]] - ps[orden[1]]
    if dif < 12:
        return None
    return orden[0], ('Gran favorito' if dif >= 50 else 'Favorito')


def _favorito_html(ps):
    f = favorito(ps)
    if not f:
        return ''
    return '<span class="fav %s">%s</span>' % ('izq' if f[0] == 0 else 'der', f[1])


def _px_nombre(n, ancho, tope, piso=11, fl=False):
    """🔤 el tamaño para que un nombre entre en UNA línea de ese ancho: una mayúscula de Archivo 900 ocupa ~0,9 de su tamaño
    (medido con «PUBLICENEMYNUMEROUNO»). Se achica en vez de partirse a la mitad."""
    return max(piso, min(tope, int(ancho / (0.9 * max(1, len(str(n or '')) + (2 if fl else 0))))))


def _pasan_txt(nombres):
    """«Oasis pasa», «Ana y Beto pasan», «Ana, Beto y 2 más pasan»."""
    ns = [str(x) for x in nombres if x]
    if not ns:
        return 'Pasa'
    if len(ns) == 1:
        return '%s pasa' % ns[0]
    if len(ns) == 2:
        return '%s y %s pasan' % (ns[0], ns[1])
    return '%s, %s y %d más pasan' % (ns[0], ns[1], len(ns) - 2)


def html_vs_grupos(v, d):
    """🖼️ EL VS DE LOS OTROS FORMATOS: 2v2, 1v3, 8v1 del Multiverse y los «todos contra todos» (1v1v1). `v['grupos']`
    son los lados, cada uno una lista de `{n, fl, ovr, sc, rg, forma, carta}`; `v['gano']`, si ya se decidió, los lados
    que pasaron (pueden pasar varios, de a uno).

    🧩 LA TERCERA VUELTA (04/11/2026, Dlx: «adaptado para todo tipo de situaciones»): las mismas piezas y en los mismos
    lugares que el mano a mano —la camiseta del servidor (`camiseta()`), el pronóstico arriba, el evento abajo—, y fuera lo
    que la carta ya dice (la letra). Con dos lados, cada uno en su mitad, con su escudo y el VS en el medio; con tres o más,
    una columna por lado con un VS chico entre cada una y el % al pie. Las cartas se acomodan solas (`acomodar()`): con
    tres apenas se superponen, para no taparles el número. Quien no tiene carta lleva nombre, bandera y OVR en su silueta.

    ✂️ UNA LÍNEA POR FRONTERA (Dlx, 04/11/2026: «si hay 3 equipos deberían haber 2 líneas… si son 4 podríamos hacer 2 líneas y
    poner cada uno en un cuadrante»). Con 3 y 5 lados, una línea entre cada columna, con su VS encima. Con 4, dos líneas que
    se cruzan y un lado en cada cuadrante, con el escudo y el VS en el cruce: cada lado lleva su dato al lado de sus cartas,
    porque en un cuadrante no hay alto para ponerlo abajo."""
    grupos = [[y for y in (g or []) if y] for g in (v.get('grupos') or [])]
    grupos = [g for g in grupos if g][:5]
    S = len(grupos)
    ca = camiseta(d)
    cols = colores_lados(ca, max(S, 2))
    gano = [i for i in (v.get('gano') if isinstance(v.get('gano'), list) else []) if isinstance(i, int) and 0 <= i < S]

    # 📐 las cartas y su pie van juntos y centrados en el alto que queda: con el pie fijo abajo, un 3 vs 3 dejaba un hueco
    # grande entre las cartas y su dato. Lo que manda es el lado más alto, para que los dos pies queden a la misma altura
    TECHO, PISO = (92, 612) if S == 2 else (116, 612)
    H = 466 if S == 2 else 374
    PIE_ALTO = 42 if S == 2 else 106
    ys = pies = None
    if S == 2:
        zonas = [(28, 470), (702, 470)]
    elif S == 4:
        # en orden: arriba a la izquierda, arriba a la derecha, abajo a la izquierda, abajo a la derecha. Las cartas por afuera,
        # el dato hacia el cruce, y los costados libres para el logo de UL y la temporada
        H = 252 if gano else 268
        arriba_y = 72 if gano else 50
        zonas = [(70, 320), (810, 320), (70, 320), (810, 320)]
        pies = [(396, 144), (660, 144), (396, 144), (660, 144)]
        ys = [arriba_y, arriba_y, 360, 360]
    else:
        vsw = 48
        W = (1136 - (S - 1) * vsw) / max(1, S)
        zonas = [(32 + i * (W + vsw), W) for i in range(S)]

    def medida(g, W):
        con_tira = len(g) <= 2 and S == 2
        return con_tira, acomodar(len(g), W, H, ratio=0.685 / (1 + TIRA) if con_tira else 0.685, solapa=0.08 if len(g) == 3 else 0.2)

    def alto_lado(g, W):
        filas, _c, h, _w, _p = medida(g, W)[1]
        return filas * h + (filas - 1) * 12

    hmax = H if S == 4 else max(alto_lado(g, z[1]) for g, z in zip(grupos, zonas))
    y0 = TECHO + max(0, (PISO - TECHO - hmax - PIE_ALTO) / 2)
    pie_y = y0 + hmax + 8

    def tira(y, w):
        """🧾 debajo de la carta, sólo con uno o dos por lado (con más no entra): sus últimos 5 duelos"""
        forma = re.sub(r'[^GP]', '', str(y.get('forma') or ''))[-5:]
        if not forma:
            return ''
        q = max(8, min(22, int((w - 12) / 6)))
        return '<div class="gt">%s</div>' % ''.join('<i class="%s" style="width:%dpx"></i>' % ('g' if c == 'G' else 'p', q) for c in forma)

    def lado(gi, g, x0, W, yb=None):
        yb = y0 if yb is None else yb
        con_tira, (filas, c, h, w, paso) = medida(g, W)
        alto_carta = w / 0.685
        alto_total = filas * h + (filas - 1) * 12
        perdio = ' perdio' if gano and gi not in gano else ''
        out = []
        for i, y in enumerate(g):
            fila, col = divmod(i, c)
            en_fila = min(c, len(g) - fila * c)
            ancho_fila = w + (en_fila - 1) * paso
            left = x0 + (W - ancho_fila) / 2 + col * paso
            top = yb + (hmax - alto_total) / 2 + fila * (h + 12)
            gira = ''
            if paso < w:
                off = col - (en_fila - 1) / 2
                gira = 'transform:translateY(%.1fpx) rotate(%.1fdeg);' % (abs(off) * 5, max(-7, min(7, off * 3)))
            caja = 'left:%.1fpx;top:%.1fpx;width:%.1fpx;height:%.1fpx;z-index:%d;%s' % (left, top, w, h, 10 + i, gira)
            if y.get('carta'):
                carta = '<img class="gc" style="height:%.1fpx" src="%s" alt="">' % (alto_carta, _e(y['carta']))
            else:
                carta = '<div class="gh" style="height:%.1fpx">%s</div>' % (alto_carta, _carta_sin(y, d, 'gs', min(w / 300, alto_carta / 440)))
            out.append('<div class="gi%s" style="%s">%s%s</div>' % (perdio, caja, carta, tira(y, w) if con_tira else ''))
        return ''.join(out)

    pr = prob_lados(grupos)
    # debajo de cada lado, el MISMO número con el que se hizo la cuenta: si el pronóstico salió por Score, el Score
    campo, etiqueta = ('sc', 'Score') if pr and pr[1].startswith('Score') else ('ovr', 'OVR temp.')

    def prom(g):
        xs = [float(y.get(campo) or 0) for y in g if float(y.get(campo) or 0) > 0]
        return int(round(sum(xs) / len(xs))) if xs else 0

    def pie(i, g, x0, W, tope=None):
        tope = pie_y if tope is None else tope
        o = prom(g)
        # 🔴 EL PROMEDIO ESCONDÍA A LOS QUE NO TIENEN DATOS (02/11/2026): en un 2 vs 1 con uno solo conocido, «OVR prom.
        # 78 · 2 raperos» hacía creer que los dos promediaban 78. Ahora dice cuántos de ellos cuentan
        con = sum(1 for y in g if float(y.get(campo) or 0) > 0)
        quien = (('%d raperos' % len(g)) if con in (0, len(g)) else ('%d de %d con datos' % (con, len(g)))) if len(g) > 1 else ''
        dato = ' · '.join(x for x in (('%s %d' % (etiqueta, o) if len(g) == 1 else '%s prom. %d' % (etiqueta, o)) if o
                                       else 'Sin datos en la Liga', quien) if x)
        if S == 2:
            return '<div class="pie" style="left:%.1fpx;width:%.1fpx;top:%.1fpx"><span>%s</span></div>' % (x0, W, pie_y, _e(dato))
        pct = ('%d%%' % pr[0][i]) if pr else '??'
        if gano:
            pct = 'PASA' if i in gano else '—'
        f = favorito(pr[0]) if pr and not gano else None
        fav = '<span class="fav">%s</span>' % f[1] if f and f[0] == i else ''
        # 🧾 los últimos duelos, si el lado es una persona (la carta no los dice): los de un equipo no serían de nadie
        cuadros = tira(g[0], 110) if len(g) == 1 else ''
        # el favorito va abajo: arriba corría su % y los de cada columna dejaban de quedar a la misma altura
        return ('<div class="pie col" style="left:%.1fpx;width:%.1fpx;top:%.1fpx"><b style="color:%s">%s</b><span>%s</span>%s%s</div>'
                % (x0, W, tope, cols[i % len(cols)] if pr or (gano and i in gano) else '#A5A5A0', pct, _e(dato), cuadros, fav))

    partes = []
    lineas, sombras = '', None
    if S == 4:
        for i, (g, (x0, W)) in enumerate(zip(grupos, zonas)):
            partes.append(lado(i, g, x0, W, ys[i]))
            partes.append(pie(i, g, pies[i][0], pies[i][1], ys[i] + H / 2 - 54))
        # dos líneas que se cruzan en el medio: la de arriba a abajo, con la misma inclinación que la del mano a mano
        lineas = _linea_html(640, 560) + _linea_html(362, 322, horizontal=True)
        sombras = ['polygon(640px 0,1200px 0,1200px 322px,600px 342px)', 'polygon(0 362px,600px 342px,560px 675px,0 675px)']
    else:
        CAIDA = 30                               # cuánto se inclinan: menos que en el mano a mano, para pasar entre las cartas
        cy = y0 + hmax / 2
        bordes = []
        for i, (g, (x0, W)) in enumerate(zip(grupos, zonas)):
            partes.append(lado(i, g, x0, W))
            partes.append(pie(i, g, x0, W))
            if S > 2 and i:
                xc = x0 - 24
                bordes.append(xc)
                lineas += _linea_html(xc + CAIDA, xc - CAIDA, ancho=7, adentro=2.5)
                # el VS, sobre su línea a la altura de las cartas
                partes.append('<div class="vs chico" style="left:%.1fpx;top:%.1fpx">VS</div>' % (xc + CAIDA - 2 * CAIDA * cy / 675 - 20, cy - 20))
        if S > 2:
            cortes = [(-99, -99)] + [(b + CAIDA, b - CAIDA) for b in bordes] + [(1300, 1300)]
            sombras = ['polygon(%dpx 0,%dpx 0,%dpx 675px,%dpx 675px)' % (cortes[i][0], cortes[i + 1][0], cortes[i + 1][1], cortes[i][1])
                       for i in range(1, len(cortes) - 1, 2)]

    # ── arriba: el pronóstico o quién pasó ──
    if gano:
        ns = [y.get('n') for i in gano for y in grupos[i]]
        txt = _pasan_txt(ns)
        arriba = '<div class="gana"><b style="font-size:%dpx">%s</b></div>' % (_px_nombre(txt, 1040, 44 if S == 2 else 34, 22), _e(txt))
    elif S == 2 and pr:
        arriba = ('<div class="pr"><b style="color:%s">%d%%</b><div class="pr-b"><i class="l" style="width:%d%%;background:%s"></i>'
                  '<i class="r" style="width:calc(%d%% - 6px);background:%s"></i><span class="et" style="left:%d%%">Pronóstico · por %s</span>'
                  '</div><b style="color:%s">%d%%</b></div>%s' % (cols[0], pr[0][0], pr[0][0], cols[0], pr[0][1], cols[1],
                                                                   min(84, max(16, pr[0][0])), _por_txt(pr[1]), cols[1], pr[0][1], _favorito_html(pr[0])))
    elif S == 2:
        arriba = '<div class="pr nada"><b>??</b><div class="pr-b"><span class="et">Pronóstico: sin datos de un lado</span></div><b>??</b></div>'
    elif pr:
        arriba = ('<div class="pr varios"><div class="pr-b">%s</div></div>'
                  % ''.join('<i style="flex:%d 1 0;background:%s"></i>' % (p, cols[i % len(cols)]) for i, p in enumerate(pr[0])))
    else:
        arriba = '<div class="pr varios nada"><div class="pr-b"><span class="et">Pronóstico: sin datos de un lado</span></div></div>'

    # ── el medio: el escudo, el VS y la historia. Con tres o más lados, una fila arriba y el escudo en la esquina ──
    formato = ' VS '.join(str(len(g)) for g in grupos) if S == 2 else ''
    chips = ''.join(x for x in (
        '<span class="fmt">%s</span>' % _e(formato) if formato else '',
        '<span class="tit">%s</span>' % _e(v.get('titulo')) if v.get('titulo') else '',
        '<small>%s</small>' % _e(v.get('sub')) if v.get('sub') else '') if x)
    if S == 2:
        medio = ('%s<div class="vs-fondo chico2"></div><div class="vs" style="left:600px">VS</div>%s'
                 % (_escudo_html(d, 72, 176), '<div class="historia g2">%s</div>' % chips if chips else ''))
    elif S == 4:
        # 🎯 el escudo y el VS en el cruce de las dos líneas, y el título arriba, entre las cartas de los dos cuadrantes
        medio = ('%s<div class="vs chico cruce">VS</div>%s'
                 % (_escudo_html(d, 76, 300), '<div class="cab cuatro" style="top:%dpx">%s</div>' % (72 if gano else 52, '<div class="historia g3">%s</div>' % chips) if chips else ''))
    else:
        medio = '<div class="cab">%s%s</div>' % (_escudo_html(d, 44, 0), '<div class="historia g3">%s</div>' % chips if chips else '')

    css = _css_suelo(ca) + """
#c .gi{position:absolute;display:flex;flex-direction:column;align-items:stretch;transform-origin:50%% 100%%}
#c .gc{display:block;width:100%%;object-fit:contain}
#c .gh{display:flex;align-items:center;justify-content:center}
#c .pie.col .gt{margin-top:3px}
#c .gt{display:flex;gap:3px;justify-content:center;align-self:center;height:14px;margin-top:6px;background:#030304;padding:3px 6px;box-sizing:content-box}
#c .gt i{display:block;box-shadow:inset 0 0 0 2px #A5A5A0}
#c .gt i.g{background:%(a)s;box-shadow:none}
#c .vs-fondo{position:absolute;background:%(placa)s;transform:translateX(-50%%) skewX(-12deg);z-index:28}
#c .vs-fondo.chico2{left:600px;top:104px;width:150px;height:84px}
#c .vs{position:absolute;font-weight:900;font-style:italic;color:%(sobre_placa)s;letter-spacing:-.05em;z-index:29;transform:translateX(-50%%);
  top:92px;font-size:104px;line-height:1}
#c .vs.chico{width:40px;height:40px;transform:skewX(-10deg);background:%(placa)s;display:grid;place-items:center;font-size:18px;letter-spacing:-.02em;z-index:40}
#c .historia{position:absolute;background:#030304;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 10px;text-align:center;z-index:29}
#c .historia.g2{left:600px;top:212px;width:176px;padding-top:42px;transform:translateX(-50%%);box-sizing:border-box}
#c .vs.chico.cruce{left:578px;top:370px;width:44px;height:36px;font-size:19px}
#c .cab.cuatro{max-width:410px}
#c .cab.cuatro .historia.g3{flex-direction:column;gap:2px;max-width:410px;white-space:normal}
#c .cab{position:absolute;left:50%%;top:68px;transform:translateX(-50%%);display:flex;align-items:center;gap:12px;z-index:30;max-width:1000px}
#c .cab .escudo{position:static;transform:none;flex:none;border-width:3px}
#c .historia.g3{position:static;flex-direction:row;gap:12px;padding:6px 12px;white-space:nowrap;max-width:900px;overflow:hidden}
#c .historia .fmt{font-weight:900;font-style:italic;font-size:24px;line-height:1}
#c .historia .tit{font-weight:900;font-size:17px;line-height:1.1}
#c .historia small{font-size:14px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
#c .historia.g3 small{-webkit-line-clamp:1;display:block;overflow:hidden;text-overflow:ellipsis}
#c .pie{position:absolute;display:flex;justify-content:center;text-align:center}
#c .pie span{font-weight:800;font-size:18px;line-height:1.1;text-transform:uppercase;letter-spacing:.02em;background:rgba(3,3,4,.78);padding:6px 12px}
#c .pie.col{flex-direction:column;align-items:center;gap:2px}
#c .pie.col b{font-weight:900;font-size:30px;line-height:1;background:rgba(3,3,4,.78);padding:3px 10px}
#c .pie.col span{font-size:13px;padding:4px 8px}
""" % ca
    return ("""<!doctype html><html><head><meta charset="utf-8"><style>%s%s%s</style></head><body><div id="c" class="f">
%s
%s
%s
%s
%s
%s
</div></body></html>""" % (_fuentes(), _BASE_CSS, css, _suelo_html(lineas, sombras), arriba, ''.join(partes), medio, _evento_html(v, d), _esquinas_html()))


def html_vs(v, d):
    """🖼️ EL VS (Dlx, 12/10/2026: «hacerlo más visual para mostrar las imágenes cuando sea un vs, o sea las tarjetas»; a
    las dos formas, «B»: una imagen armada). `v` es lo que guardó el objeto (`vsEncolar()` en avisos.js): `{ev, ronda,
    titulo, sub, h2h, gano, a, b}`, cada lado `{n, fl, ovr, sc, forma, carta, noche}`. ⚠️ Quien no tiene tarjeta sale con la
    silueta, su nombre, su bandera y su OVR: la imagen nunca queda con un lado vacío.

    🥊 LA PANTALLA DE PELEA (02/11/2026; Dlx: «mainly the one with VS», «exclude whats already in the card»): arriba el
    pronóstico con el corte en diagonal («Prediction Market Card» de 21st), las cartas inclinadas hacia la costura, un VS
    grande, en el medio la historia del cruce y, abajo de cada carta, sus últimos 5 duelos en segmentos («Energy Meter») y
    lo que hizo esta noche (`nocheVs()`). NADA de lo que la carta ya dice. Las posiciones son las que Dlx aprobó.

    👕 Y VESTIDA DE SU SERVIDOR (04/11/2026, Dlx: «que sea relacionada a cada servidor más»): `camiseta()` y su escudo
    grande arriba del VS; cada uno, con su carta de ese servidor (`cartaDe(k, sv)` en avisos.js).

    🏁 CON `gano` ('a' o 'b') ES LA IMAGEN DEL RESULTADO (`vsResultado()`): arriba «X PASA», el que perdió en gris y el
    cara a cara ya sumado. Reemplaza a la de antes en el mismo mensaje."""
    # 🧩 los otros formatos (2v2, 1v3, 1v1v1…): su propio armado, con todas las tarjetas
    if v.get('grupos'):
        return html_vs_grupos(v, d)
    ca = camiseta(d)
    a_col, b_col = ca['a'], ca['b']
    gano = v.get('gano') if v.get('gano') in ('a', 'b') else ''

    def lado(y, cls):
        y = y or {}
        perdio = ' perdio' if gano and gano != cls else ''
        if y.get('carta'):
            return '<div class="ld %s%s"><img class="carta" src="%s" alt=""></div>' % (cls, perdio, _e(y['carta']))
        return '<div class="ld %s%s">%s</div>' % (cls, perdio, _carta_sin(y, d, 'sin', 1.036))

    def pie(y, cls):
        """🧾 debajo de cada carta: sus últimos 5 duelos —verde ganó, vacío perdió, del más viejo al más nuevo— y lo que
        hizo esta noche. Sin nada de eso, no hay pie"""
        y = y or {}
        forma = re.sub(r'[^GP]', '', str(y.get('forma') or ''))[-5:]
        filas = []
        if forma:
            cuantos = 'Último duelo' if len(forma) == 1 else 'Últimos %d duelos' % len(forma)
            filas.append('<div class="fm"><span class="segs">%s</span><span class="et">%s</span></div>'
                         % (''.join('<i class="%s"></i>' % ('g' if c == 'G' else 'p') for c in forma), cuantos))
        if y.get('noche'):
            filas.append('<span class="noche">%s</span>' % _e(str(y['noche'])[:60]))
        return '<div class="pie %s">%s</div>' % (cls, ''.join(filas)) if filas else ''

    def arriba():
        if gano:
            txt = _pasan_txt([(v.get(gano) or {}).get('n')])
            return '<div class="gana"><b style="font-size:%dpx">%s</b></div>' % (_px_nombre(txt, 1040, 46, 22), _e(txt))
        pr = prob_vs(v.get('a'), v.get('b'))
        if not pr:
            hay = [y for y in (v.get('a'), v.get('b')) if y and (y.get('sc') or y.get('ovr'))]
            return ('<div class="pr nada"><b>??</b><div class="pr-b"><span class="et">%s</span></div><b>??</b></div>'
                    % ('Sin datos de uno' if hay else 'Sin datos todavía'))
        return ('<div class="pr"><b style="color:%s">%d%%</b><div class="pr-b"><i class="l" style="width:%d%%;background:%s"></i>'
                '<i class="r" style="width:calc(%d%% - 6px);background:%s"></i><span class="et" style="left:%d%%">Pronóstico · por %s</span>'
                '</div><b style="color:%s">%d%%</b></div>%s' % (a_col, pr[0], pr[0], a_col, pr[1], b_col, min(84, max(16, pr[0])), _por_txt(pr[2]), b_col, pr[1],
                                                                 _favorito_html(pr[:2])))

    def historia():
        """El cuento del cruce, en el medio: su título, el cara a cara en grande y una línea"""
        partes = []
        if v.get('titulo'):
            partes.append('<span class="tt">%s</span>' % _e(v['titulo']))
        h = v.get('h2h')
        if isinstance(h, (list, tuple)) and len(h) == 2:
            if h[0] or h[1]:
                partes.append('<b class="hh"><u style="color:%s">%d</u><i>–</i><u style="color:%s">%d</u></b><span class="et">En el cara a cara</span>'
                              % (a_col, int(h[0]), b_col, int(h[1])))
            else:
                partes.append('<span class="et primero">Primer cruce</span>')
        if v.get('sub'):
            partes.append('<small>%s</small>' % _e(v['sub']))
        return '<div class="historia">%s</div>' % ''.join(partes) if partes else ''

    css = _css_suelo(ca) + """
#c .ld{position:absolute;top:104px;height:456px;width:312px;display:grid;place-items:center}
#c .ld.a{left:118px;transform:rotate(-3deg)}
#c .ld.b{right:118px;transform:rotate(3deg)}
#c .carta{max-height:456px;max-width:312px;width:auto;height:456px;object-fit:contain;display:block}
#c .vs-fondo{position:absolute;left:50%%;top:104px;width:214px;height:112px;transform:translateX(-50%%) skewX(-12deg);background:%(placa)s;z-index:20}
#c .vs{position:absolute;left:50%%;top:86px;transform:translateX(-50%%);font-weight:900;font-style:italic;font-size:146px;line-height:1;
  letter-spacing:-.05em;color:%(sobre_placa)s;z-index:21}
#c .historia{position:absolute;left:50%%;top:244px;width:256px;transform:translateX(-50%%);box-sizing:border-box;background:#030304;display:flex;flex-direction:column;
  align-items:center;gap:4px;padding:46px 12px 12px;text-align:center;z-index:22}
#c .historia .tt{font-weight:900;font-size:21px;line-height:1.1;letter-spacing:.02em}
#c .historia .hh{font-weight:900;font-size:52px;line-height:1.05}
#c .historia .hh u{text-decoration:none}
#c .historia .hh i{font-style:normal;color:#6E6E6A;margin:0 10px}
#c .historia .et{font-size:17px;letter-spacing:.06em;color:#A5A5A0}
#c .historia .primero{color:#F6F6F6;font-size:20px}
#c .historia small{font-size:15px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
#c .pie{position:absolute;top:574px;width:max-content;max-width:312px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;text-align:center;
  gap:6px;background:rgba(3,3,4,.78);padding:8px 12px;transform:translateX(-50%%)}
#c .pie.a{left:274px}
#c .pie.b{left:926px}
#c .fm{display:flex;align-items:center;gap:10px}
#c .segs{display:flex;gap:4px}
#c .segs i{display:block;width:28px;height:16px;box-shadow:inset 0 0 0 2px #A5A5A0}
#c .segs i.g{background:%(a)s;box-shadow:none}
#c .fm .et{font-size:17px;letter-spacing:.05em;white-space:nowrap}
#c .noche{font-weight:600;font-size:17px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:288px}
""" % ca
    return ("""<!doctype html><html><head><meta charset="utf-8"><style>%s%s%s</style></head><body><div id="c" class="f">
%s
%s%s%s
%s
<div class="vs-fondo"></div><div class="vs">VS</div>
%s%s%s
%s
%s
</div></body></html>""" % (_fuentes(), _BASE_CSS, css, _suelo_html(), arriba(), lado(v.get('a'), 'a'), lado(v.get('b'), 'b'),
                            _escudo_html(d, 80, 204), historia(), pie(v.get('a'), 'a'), pie(v.get('b'), 'b'), _evento_html(v, d), _esquinas_html()))


def foto(htm, ruta, jpeg=False):
    """El PNG (o JPG, más liviano para el chat) del `#c` de ese HTML."""
    import navegador
    navegador.hace_falta()
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 1200, 'height': 1200}, device_scale_factor=1)
        pg.set_content(htm)
        pg.wait_for_timeout(400)
        if jpeg:
            pg.locator('#c').screenshot(path=ruta, type='jpeg', quality=88)
        else:
            pg.locator('#c').screenshot(path=ruta)
        b.close()
    return ruta


# ── a quien lo pidió ─────────────────────────────────────────────────────────────────────────────────────────────────
def subir(ruta, clave, tipo='image/png'):
    import subir_cartas as SC
    s = SC.sesion()
    datos = open(ruta, 'rb').read()
    r = s.put('%s/objects/%s' % (SC.API, clave), data=datos, headers={'Content-Type': tipo}, timeout=60)
    if SC._ok(r, clave) is None:
        raise RuntimeError('R2 no la aceptó')
    return '%s/%s' % (SC.PUBLICA, clave)


def _clave():
    """La clave del ciclo, para las rutas del objeto que sólo el ciclo y sus tareas pueden usar."""
    import avisar as AV
    t = AV._token() if hasattr(AV, '_token') else None
    if not t:
        import escuchar as E
        t = E._env('DISCORD_TOKEN')
    return CC.clave(t)


def avisar(id_, url=None, error=None, texto=''):
    import requests
    import avisar as AV
    r = requests.post(AV.WORKER + '/avisos/kit-listo', headers={'x-lg-ciclo': _clave()}, timeout=20,
                      json={'id': id_, 'url': url, 'error': error, 'texto': texto})
    print('   el objeto: %d %s' % (r.status_code, r.text[:120]))


def correr_vs(sv):
    """🖼️ Los vs de ese servidor que esperan su imagen (`/avisos/vs-cola`): los dibuja, los sube y se los devuelve al objeto
    (`/avisos/vs-listo`), que se la agrega a cada mensaje. Uno que falla no frena a los demás."""
    import requests
    import avisar as AV
    d = _sv_datos(sv)
    r = requests.get(AV.WORKER + '/avisos/vs-cola', params={'sv': sv}, headers={'x-lg-ciclo': _clave()}, timeout=20)
    vs = ((r.json() or {}).get('vs') or []) if r.ok else []
    print('   🖼️ %d vs de %s' % (len(vs), sv))
    os.makedirs(SALIDA, exist_ok=True)
    mal = 0
    for v in vs:
        vid = re.sub(r'[^a-z0-9]', '', str(v.get('id') or '').lower())[:24]
        if not vid:
            continue
        ruta = os.path.join(SALIDA, 'vs_%s.jpg' % vid)
        try:
            foto(html_vs(v, d), ruta, jpeg=True)
            url = subir(ruta, 'vs/%s-%s.jpg' % (sv.lower(), vid), 'image/jpeg')
            rr = requests.post(AV.WORKER + '/avisos/vs-listo', headers={'x-lg-ciclo': _clave()}, timeout=20,
                               json={'id': v.get('id'), 'url': url})
            quienes = [' + '.join(str(y.get('n')) for y in g) for g in v['grupos']] if v.get('grupos')                 else [(v.get('a') or {}).get('n'), (v.get('b') or {}).get('n')]
            print('   ✅ %s · %s' % (' vs '.join(str(q) for q in quienes), rr.text[:80]))
        except Exception as e:                           # noqa: BLE001
            mal += 1
            print('   🔴 %s: %s' % (vid, str(e)[:120]))
    return 1 if mal and mal == len(vs) else 0


def correr(tipo, sv, id_=None):
    d = _sv_datos(sv)
    os.makedirs(SALIDA, exist_ok=True)
    ruta = os.path.join(SALIDA, 'kit_%s_%s.png' % (tipo, sv.lower()))
    try:
        if tipo == 'afiche':
            a = anuncio_de(sv)
            if not a:
                raise LookupError('No encontré un anuncio de %s de las últimas %d horas.' % (sv, HORAS))
            foto(html_afiche(a, sv, d), ruta)
            texto = '🧰 El afiche de **%s**, del anuncio de %s.' % (re.sub(r'[_*~`]+', '', a.get('nombre') or '').strip(), sv)
        else:
            ll = llave_de(sv, d['guild'])
            if not ll or not ll[1]:
                raise LookupError('No encontré una llave de %s de las últimas %d horas.' % (sv, HORAS))
            foto(html_llave(ll[0], ll[1], sv, d), ruta)
            texto = '🧰 La llave de **%s**, como la leyó el bot. Si algo salió mal, es que se leyó mal: avisa.' % ll[0]
    except LookupError as e:
        print('   ⚠️ %s' % e)
        if id_:
            avisar(id_, error=str(e))
        return 0
    except Exception as e:                               # noqa: BLE001
        print('   🔴 %s' % e)
        if id_:
            avisar(id_, error='No pude armarla esta vez. Prueba de nuevo en un rato.')
        return 1
    print('   ✅ %s' % ruta)
    if id_:
        clave = 'kit/%s-%s-%s.png' % (tipo, sv.lower(), re.sub(r'[^a-z0-9]', '', str(id_).lower())[:16])
        url = subir(ruta, clave)
        avisar(id_, url=url, texto=texto)
    return 0


def _self_check():
    mal = 0
    d = {'nombre': 'Freestyle For All', 'guild': '1', 'color': '#26045B', 'logo': ''}
    a = {'nombre': '__ DESGRACIAS EN TOKYO VOL 27 __', 'horario': '9PM ARG', 'modalidad': '1VS1', 'cupo_total': 16,
         'cuando': '2026-10-12T20:00:00+00:00'}
    h = html_afiche(a, 'FFA', d)
    vs = html_vs({'ev': '__ COPA <b>X</b> __', 'ronda': 'Cuartos', 'titulo': 'EL CLÁSICO', 'sub': 'se cruzaron 3 veces',
                  'a': {'n': 'Snow', 'fl': '🇨🇴', 'ovr': 92, 'carta': 'https://pub-a.r2.dev/snow/temporada.webp'},
                  'b': {'n': 'Pepe <i>', 'fl': '', 'ovr': 0, 'carta': ''}}, d)
    ll = html_llave('DESGRACIAS EN TOKYO VOL 27', [('SEMIFINALES', ['Ana', 'Beto'], 'Ana'),
                                                   ('SEMIFINALES', ['Caro', 'Dani'], 'Caro'),
                                                   ('FINAL', ['Ana', 'Caro'], 'Ana')], 'FFA', d)
    casos = [
        ('el afiche: el nombre sin los guiones bajos de Discord, la hora y la modalidad',
         'DESGRACIAS EN TOKYO VOL 27' in h and '9PM ARG' in h and '1VS1' in h and '__' not in h.split('<div class="nom">')[1][:40]),
        ('la llave: una columna por ronda y el campeón', ll.count('class="ronda"') == 2 and 'Campeón' in ll and '>Ana<' in ll),
        ('el vs: la tarjeta de uno, la silueta y el nombre del otro, el VS y el título',
         'snow/temporada.webp' in vs and 'Pepe &lt;i&gt;' in vs and '>VS<' in vs and 'EL CLÁSICO' in vs
         and 'class="sil"' in vs and '<b>X</b>' not in vs),
        ('la barra de quién gana: por Score si lo tienen los dos, si no por OVR, «??» si a uno le falta, nunca 0 ni 100',
         prob_vs({'ovr': 92, 'sc': 60}, {'ovr': 70, 'sc': 60})[:2] == (50, 50) and prob_vs({'ovr': 92}, {'ovr': 82})[2] == 'OVR'
         and prob_vs({'ovr': 92}, {'ovr': 0}) is None and prob_vs({'ovr': 99, 'sc': 95}, {'ovr': 40, 'sc': 5})[0] == 97
         and '??' in vs and 'Sin datos de uno' in vs
         and 'width:64%' in html_vs({'a': {'n': 'A', 'ovr': 92}, 'b': {'n': 'B', 'ovr': 82}}, d)),
        ('los otros formatos (2v2, 1v3, 8v1, todos contra todos): cada lado con sus tarjetas, un VS entre lados (uno grande '
         'con dos, uno chico entre cada uno con más), la silueta para quien no tiene, y su pronóstico debajo',
         html_vs({'grupos': [[{'n': 'A', 'carta': 'https://pub-x.r2.dev/a.webp'}], [{'n': 'B', 'ovr': 70}, {'n': 'C'}, {'n': 'D'}]]}, d)
         .count('class="gs"') == 3
         and html_vs({'grupos': [[{'n': 'A'}], [{'n': 'B'}], [{'n': 'C'}]]}, d).count('class="vs chico"') == 2
         and 'class="sil"' in html_vs({'grupos': [[{'n': 'A'}], [{'n': 'B'}]]}, d)
         and '<b>x' not in html_vs({'grupos': [[{'n': '<b>x</b>'}], [{'n': 'B'}]]}, d)
         and '>3 VS 1<' in html_vs({'grupos': [[{'n': 'A'}, {'n': 'B'}, {'n': 'C'}], [{'n': 'D'}]]}, d)),
        ('la camiseta del servidor: su fondo y su color, sin definición cae a su color, y las letras se leen sobre la placa',
         camiseta({'color': '#662EAC'})['placa'] == '#662EAC' and camiseta({'color': '#662EAC'})['sobre_placa'] == '#F6F6F6'
         and all((max(_luz(c['placa']), _luz(c['sobre_placa'])) + 0.05) / (min(_luz(c['placa']), _luz(c['sobre_placa'])) + 0.05) >= 2.7
                 for c in [camiseta({'color': x}) for x in ('#FFE066', '#FFFFFF', '#000000', '#1A5FFF')]
                 + [camiseta({'sv': x}) for x in _defs_camisetas()])
         and _luz(camiseta({'color': '#111111'})['a']) >= 0.18 and camiseta({'color': '#662EAC'})['a'] != camiseta({'color': '#662EAC'})['b']
         and '#662EAC'.lower() in html_vs({'a': {'n': 'A'}, 'b': {'n': 'B'}}, dict(d, color='#662EAC')).lower()),
        ('el dibujo de la camiseta se repite a lo ancho y sale de su definición (sin definiciones, no se puede medir)',
         not _defs_camisetas().get('FVS')
         or ('repeat-x' in camiseta({'sv': 'FVS'})['fondo'] and '300px' not in camiseta({'sv': 'FVS'})['fondo'])),
        ('el fondo original de cada servidor: su escena de `bot/vs_fondos/`, sin la sombra de la mitad, y sin escena, el de su tarjeta',
         camiseta({'sv': 'FRZ', 'color': '#26B3A6'})['fondo'].startswith('url(data:image/jpeg') and camiseta({'sv': 'FRZ', 'color': '#26B3A6'})['sombra'] == 0
         and all(_fondo_vs(x) for x in ('FFA', 'DRA', 'SR', 'URBF', 'FFS', 'DDF', 'FDS', 'LKR', 'ACAD', 'FRZ')) and not _fondo_vs('NADA') and not _fondo_vs('')),
        ('el escudo del servidor: su logo y, sin logo, su sigla, en los dos armados',
         'class="escudo" ' in html_vs({'a': {'n': 'A'}, 'b': {'n': 'B'}}, dict(d, logo='data:image/png;base64,AA'))
         and 'escudo sigla' in html_vs({'a': {'n': 'A'}, 'b': {'n': 'B'}}, dict(d, sv='XX'))
         and 'class="cab"' in html_vs({'grupos': [[{'n': 'A'}], [{'n': 'B'}], [{'n': 'C'}]]}, d)),
        ('el logo de UL y la temporada en las esquinas, y los cuadrados de los duelos con el color del servidor, en los dos armados',
         all('class="t-m"' in x and 'class="ul-m"' in x and 'i.g{background:#29B298' not in x
             for x in (html_vs({'a': {'n': 'A'}, 'b': {'n': 'B'}}, d), html_vs({'grupos': [[{'n': 'A'}], [{'n': 'B'}]]}, d)))),
        ('el favorito sale del pronóstico: con 12 puntos o más; parejos o en el resultado no hay, y con 50 es gran favorito',
         favorito([56, 44]) == (0, 'Favorito') and favorito([45, 55]) is None and favorito([20, 80]) == (1, 'Gran favorito')
         and favorito([50, 30, 20]) == (0, 'Favorito') and favorito(None) is None
         and 'class="fav izq"' in html_vs({'a': {'n': 'A', 'ovr': 92}, 'b': {'n': 'B', 'ovr': 70}}, d)
         and 'class="fav der"' in html_vs({'a': {'n': 'A', 'ovr': 70}, 'b': {'n': 'B', 'ovr': 92}}, d)
         and 'class="fav' not in html_vs({'a': {'n': 'A', 'ovr': 80}, 'b': {'n': 'B', 'ovr': 80}}, d)
         and 'class="fav' not in html_vs({'a': {'n': 'A', 'ovr': 92}, 'b': {'n': 'B', 'ovr': 70}, 'gano': 'a'}, d)
         and 'class="fav izq"' in html_vs({'grupos': [[{'n': 'A', 'ovr': 92}], [{'n': 'B', 'ovr': 60}]]}, d)
         and 'class="fav' not in html_vs({'grupos': [[{'n': 'A', 'ovr': 92}], [{'n': 'B', 'ovr': 60}]], 'gano': [0]}, d)),
        ('una línea por frontera: 1 con dos lados, 2 con tres, 4 con cinco, y con cuatro dos que se cruzan, con un lado por cuadrante',
         [html_vs({'grupos': [[{'n': str(i)}] for i in range(k)]}, d).count('class="costura"') for k in (2, 3, 4, 5)] == [1, 2, 2, 4]
         and html_vs({'grupos': [[{'n': str(i)}] for i in range(3)]}, d).count('class="vs chico"') == 2
         and html_vs({'grupos': [[{'n': str(i)}] for i in range(4)]}, d).count('vs chico cruce') == 1),
        ('los colores de cada lado no se parecen: con el servidor que sea y hasta cinco lados',
         all(min(sum((x - y) ** 2 for x, y in zip(_rgb(p), _rgb(q))) ** 0.5 for i, p in enumerate(c) for q in c[:i]) >= 75
             for c in [colores_lados(camiseta({'sv': sv, 'color': d['color']}), 5) for sv in _defs_camisetas()] + [colores_lados(camiseta({'color': '#FFE066'}), 5)])
         and '#FFD24A' not in colores_lados({'a': '#EACB0C', 'b': '#F6F6F6'}, 4)),
        ('las stats de quien no tiene carta salen de lo que se sabe, y si no se sabe nada no se dibujan',
         '>12</b>Eventos' in html_vs({'a': {'n': 'A', 'ev': 12, 'dg': 3, 'dt': 5}, 'b': {'n': 'B'}}, d)
         and '>3/5</b>Duelos' in html_vs({'a': {'n': 'A', 'ev': 12, 'dg': 3, 'dt': 5}, 'b': {'n': 'B'}}, d)
         and 'class="sc-stats"' not in html_vs({'a': {'n': 'A'}, 'b': {'n': 'B'}}, d)),
        ('la silueta: los pies o el corte siempre sobre el panel, sin tapar el escudo de arriba',
         all(SIL_PANEL + h - a >= 34 and h >= 0 for a, h in SIL_ALTO.values())),
        ('con grupos, el resultado: quiénes pasan y el resto en gris, sin pronóstico',
         'Ana y Beto pasan' in html_vs({'grupos': [[{'n': 'Ana'}, {'n': 'Beto'}], [{'n': 'C'}]], 'gano': [0]}, d)
         and 'gi perdio' in html_vs({'grupos': [[{'n': 'Ana'}], [{'n': 'C'}]], 'gano': [0]}, d)
         and 'Pronóstico' not in html_vs({'grupos': [[{'n': 'Ana', 'ovr': 80}], [{'n': 'C', 'ovr': 70}]], 'gano': [1]}, d)
         and 'Ana, Beto y 2 más pasan' == _pasan_txt(['Ana', 'Beto', 'C', 'D'])),
        ('el pronóstico dice con qué se hizo: el OVR es el de temporada, no el de la carta de servidor; y sin datos de nadie, no culpa a uno',
         'por OVR de temporada' in html_vs({'a': {'n': 'A', 'ovr': 92}, 'b': {'n': 'B', 'ovr': 82}}, d)
         and 'por Score' in html_vs({'a': {'n': 'A', 'sc': 92}, 'b': {'n': 'B', 'sc': 82}}, d)
         and 'OVR temp. 92' in html_vs({'grupos': [[{'n': 'A', 'ovr': 92}], [{'n': 'B', 'ovr': 82}]]}, d)
         and 'Sin datos todavía' in html_vs({'a': {'n': 'A'}, 'b': {'n': 'B'}}, d)),
        ('el pronóstico con grupos: por el PROMEDIO (ocho flojos no le ganan a uno bueno por ser ocho), con dos lados igual '
         'que el mano a mano, con más suma 100 y nadie en 0, y «??» si de un lado no se sabe nada',
         prob_lados([[{'ovr': 92}], [{'ovr': 82}]]) == ([64, 36], 'OVR promedio')
         and prob_lados([[{'ovr': 60}] * 8, [{'ovr': 95}]])[0][1] > 80
         and prob_lados([[{'ovr': 90, 'sc': 70}], [{'ovr': 60, 'sc': 70}]])[1] == 'Score promedio'
         and prob_lados([[{'ovr': 90, 'sc': 70}], [{'ovr': 60}]])[1] == 'OVR promedio'
         and sum(prob_lados([[{'ovr': 99}], [{'ovr': 40}], [{'ovr': 41}], [{'ovr': 42}]])[0]) == 100
         and min(prob_lados([[{'ovr': 99}], [{'ovr': 40}], [{'ovr': 41}], [{'ovr': 42}]])[0]) >= 2
         and prob_lados([[{'ovr': 80}], [{'n': 'x'}]]) is None
         and '??' in html_vs({'grupos': [[{'n': 'A', 'ovr': 80}], [{'n': 'B'}]]}, d)),
        ('las tarjetas de un lado: una grande; ocho en dos filas de cuatro de 150 px o más, y ninguna más ancha que su lado',
         acomodar(1, 470, 352)[0] == 1 and acomodar(8, 470, 352)[:2] == (2, 4) and acomodar(8, 470, 352)[2] > 150
         and all(acomodar(n, 470, 352)[3] <= 470 for n in range(1, 9))),
        ('el remake (02/11/2026): con carta, nada de lo que la carta ya dice (ni la letra ni el OVR); sí la forma, la '
         'noche y el cara a cara; el nombre largo sin carta se achica en vez de partirse',
         'class="rg"' not in html_vs({'a': {'n': 'A', 'rg': 'S', 'ovr': 90, 'carta': 'https://pub-a.r2.dev/a.webp', 'forma': 'GGP',
                                            'noche': 'Esta noche pasó con Badterne'},
                                      'b': {'n': 'B', 'rg': 'A', 'ovr': 80, 'carta': 'https://pub-a.r2.dev/b.webp'}, 'h2h': [2, 1]}, d)
         and '>90</b>OVR' not in html_vs({'a': {'n': 'A', 'ovr': 90, 'carta': 'https://pub-a.r2.dev/a.webp'}, 'b': {'n': 'B', 'ovr': 80}}, d)
         and '>80</b>OVR' in html_vs({'a': {'n': 'A', 'ovr': 90, 'carta': 'https://pub-a.r2.dev/a.webp'}, 'b': {'n': 'B', 'ovr': 80}}, d)
         and 'pasó con Badterne' in html_vs({'a': {'n': 'A', 'noche': 'Esta noche pasó con Badterne'}, 'b': {'n': 'B'}}, d)
         and '>2</u>' in html_vs({'a': {'n': 'A'}, 'b': {'n': 'B'}, 'h2h': [2, 1]}, d)
         and 'Primer cruce' in html_vs({'a': {'n': 'A'}, 'b': {'n': 'B'}, 'h2h': [0, 0]}, d)
         and 'font-size:14px' in html_vs({'a': {'n': 'PUBLICENEMYNUMEROUNO'}, 'b': {'n': 'B'}}, d)
         and 'font-size:34px' in html_vs({'a': {'n': 'Ana'}, 'b': {'n': 'B'}}, d)),
        ('la imagen del resultado: «X pasa» arriba en vez del pronóstico y el que perdió en gris',
         'Oasis pasa' in html_vs({'a': {'n': 'Oasis', 'ovr': 87}, 'b': {'n': 'Liberia', 'ovr': 76}, 'gano': 'a'}, d)
         and 'ld b perdio' in html_vs({'a': {'n': 'Oasis', 'ovr': 87}, 'b': {'n': 'Liberia', 'ovr': 76}, 'gano': 'a'}, d)
         and 'ld a perdio' not in html_vs({'a': {'n': 'Oasis', 'ovr': 87}, 'b': {'n': 'Liberia', 'ovr': 76}, 'gano': 'a'}, d)
         and 'Pronóstico' not in html_vs({'a': {'n': 'Oasis', 'ovr': 87}, 'b': {'n': 'Liberia', 'ovr': 76}, 'gano': 'a'}, d)),
        ('en equipos, el promedio dice cuántos cuentan: «1 de 2 con datos» y no «2 raperos» como si promediaran los dos',
         '1 de 2 con datos' in html_vs({'grupos': [[{'n': 'A', 'ovr': 78}, {'n': 'B'}], [{'n': 'C', 'ovr': 70}]]}, d)
         and '2 raperos' in html_vs({'grupos': [[{'n': 'A', 'ovr': 78}, {'n': 'B', 'ovr': 70}], [{'n': 'C', 'ovr': 70}]]}, d)),
        ('lo que viene de Discord se escapa: ningún HTML crudo',
         '<b>x' not in html_afiche(dict(a, nombre='<b>x</b>', horario='<i>9</i>'), 'FFA', d)
         and '&lt;i&gt;9' in html_afiche(dict(a, nombre='<b>x</b>', horario='<i>9</i>'), 'FFA', d)),
    ]
    for que, ok in casos:
        mal += not ok
        print('   %s %s' % ('✅' if ok else '🔴', que))
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    arg = lambda k: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else None   # noqa: E731
    tipo, sv = arg('--tipo'), (arg('--sv') or '').upper()
    if tipo not in ('afiche', 'llave', 'vs') or not re.match(r'^[A-Z]{2,5}$', sv) or (arg('--id') and not re.match(r'^[a-f0-9]{16,40}$', arg('--id'))):
        sys.exit('uso: python bot/kit.py --tipo afiche|llave|vs --sv FFA [--id <id>]')
    if tipo == 'vs' and '--muestra' in sys.argv:
        import requests
        i = sys.argv.index('--muestra')
        ks = (sys.argv[i + 1:i + 3] + ['snow', 'makmah'])[:2]
        lob = requests.get('https://underlegends.pages.dev/api/lobby', timeout=30).json()
        T = {f['k']: f for f in lob.get('tabla') or []}

        def _lado(k):
            f = T.get(k) or {'n': k}
            c = next((x for x in ('temporada', 'competitivo', 'servidor') if x in (f.get('c') or [])), '')
            if 'servidor' in (f.get('c') or []) and f.get('sv') == sv:
                c = 'servidor'                   # la misma regla que `cartaDe()` en avisos.js
            j = (lob.get('cartas') or []).index(c) if c else -1
            ver = (f.get('cv') or '').split('.')[j] if c and f.get('cv') else ''
            fl = ''.join(chr(0x1F1E6 + ord(x) - 97) for x in (f.get('cc') or '')) if len(f.get('cc') or '') == 2 else ''
            return {'n': f.get('n'), 'fl': fl, 'ovr': f.get('ovr') or 0, 'sc': f.get('sc') or 0, 'rg': f.get('rg') or '',
                    'carta': ('%s/%s/%s.webp%s' % (lob['r2'], k, c, '?v=' + ver if ver else '')) if c else ''}
        v = {'ev': 'COMPE POR 1.5 DOLARES', 'ronda': 'Cuartos', 'titulo': 'LA REVANCHA',
             'sub': '%s le ganó la última vez' % _lado(ks[0])['n'], 'a': _lado(ks[0]), 'b': _lado(ks[1])}
        # ⚠️ de MUESTRA: los últimos 5, la racha y el cara a cara salen de los perfiles, que el lobby no trae
        v['a'].update(forma='GGPGG', racha=3, noche='Esta noche pasó con Badterne')
        v['b'].update(forma='PGGPG', racha=0, noche='Esta noche le ganó a Drexx')
        v['h2h'] = [2, 1]
        # 🏁 `--gano a|b`: la imagen del resultado (`vsResultado()` en avisos.js)
        if arg('--gano') in ('a', 'b'):
            v['gano'] = arg('--gano')
            v['h2h'] = [3, 1] if v['gano'] == 'a' else [2, 2]
        os.makedirs(SALIDA, exist_ok=True)
        ruta = os.path.join(SALIDA, 'vs_muestra_%s_%s%s.jpg' % (ks[0], ks[1], '_' + v['gano'] if v.get('gano') else ''))
        foto(html_vs(v, _sv_datos(sv)), ruta, jpeg=True)
        print(ruta)
        sys.exit(0)
    if tipo == 'vs':
        sys.exit(correr_vs(sv))
    sys.exit(correr(tipo, sv, arg('--id')))
