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
    return {'nombre': d.get('nombre') or sv, 'guild': str(d.get('guild_id') or ''), 'color': col or '#26045B',
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
COLORES_LADO = ('#E41373', '#FFD24A', '#29B298', '#58A6FF', '#F6F6F6')


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


def html_vs_grupos(v, d):
    """🖼️ EL VS DE LOS OTROS FORMATOS: 2v2, 1v3, 8v1 del Multiverse y los «todos contra todos» (1v1v1). `v['grupos']`
    son los lados, cada uno una lista de `{n, fl, ovr, sc, rg, carta}`.

    🧩 LA SEGUNDA VUELTA (19/10/2026, Dlx sobre el 3 contra 1 de LA REDENCIÓN VOL.6: «¿puedes usar 21st para ver qué
    diseños podemos usar para mejorar esto? Recuerda pueden haber en casos extremos 8vs1… y necesitamos ahí la
    información, como quién es más probable que gane»). La primera ponía todas las tarjetas en una fila del mismo
    tamaño —con ocho, de 100 px— y el nombre otra vez debajo de cada una. Ahora, en 1200×675:
      · con DOS lados, cada uno en su mitad, y sus tarjetas se acomodan solas (`acomodar()`): una grande, dos al lado,
        desde tres superpuestas como una mano de cartas y, si conviene, en dos filas. El VS en el medio;
      · con TRES O MÁS, una columna por lado con un VS chico entre cada una;
      · debajo de cada lado, su pronóstico grande en su color, su OVR promedio y cuántos son;
      · abajo de todo, la barra partida en un tramo por lado (la idea de «Partition Bar» de 21st), con `prob_lados()`;
      · el nombre ya no se repite debajo de las tarjetas: la tarjeta lo trae. Sólo quien no tiene tarjeta lleva el
        suyo, adentro de su silueta."""
    from comun import sin_foto as SF
    from comun.rangos import ACENTO
    grupos = [[y for y in (g or []) if y] for g in (v.get('grupos') or [])]
    grupos = [g for g in grupos if g][:5]
    S = len(grupos)
    cols = [COLORES_LADO[i % len(COLORES_LADO)] for i in range(S)]

    def bandera(fl):
        cps = [ord(c) - 0x1F1E6 for c in str(fl or '')]
        if len(cps) != 2 or not all(0 <= c < 26 for c in cps):
            return ''
        try:
            from comun import banderas as BA
            src = BA.src(''.join(chr(97 + c) for c in cps))
        except Exception:                                # noqa: BLE001
            src = ''
        return ' <img class="fl" src="%s" alt="">' % src if src else ''

    def sil(n):
        return 'data:image/svg+xml;base64,' + base64.b64encode(
            SF.svg(SF.cual(n)).replace('#0a0a0d', '#F6F6F6').encode('utf-8')).decode()

    # ── dónde va cada lado ──
    hay_tit = bool(v.get('titulo'))
    y0, H = 160, 352
    if S == 2:
        zonas = [(40, 470), (690, 470)]
    else:
        vsw = 56
        W = (1120 - (S - 1) * vsw) / max(1, S)
        zonas = [(40 + i * (W + vsw), W) for i in range(S)]

    def tira(y, w):
        """🧾 debajo de cada carta, como en el mano a mano (Dlx, 19/10/2026: «más algo de info como los de 1v1»): su
        letra con su color, los últimos 5 duelos —verde ganó, magenta perdió— y la racha si es de 2 o más. Del tamaño
        de la carta: con ocho por lado es chica. Alineada a la izquierda, que es lo que se ve cuando se superponen"""
        partes = []
        rg = str(y.get('rg') or '')
        fs = max(11, min(22, int(w / 9)))
        if rg:
            col = ACENTO.get(rg.rstrip('+-−'), '#F6F6F6')
            partes.append('<b class="rg" style="color:%s;border-color:%s;font-size:%dpx">%s</b>' % (col, col, fs, _e(rg)))
        forma = re.sub(r'[^GP]', '', str(y.get('forma') or ''))[-5:]
        if forma:
            q = max(6, min(15, int(w / 15)))
            partes.append('<span class="fm">%s</span>' % ''.join(
                '<i class="%s" style="width:%dpx;height:%dpx"></i>' % ('g' if c == 'G' else 'p', q, q) for c in forma))
        if int(y.get('racha') or 0) >= 2:
            partes.append('<span class="rc" style="font-size:%dpx">🔥%d</span>' % (fs, int(y['racha'])))
        return '<div class="gt">%s</div>' % ''.join(partes) if partes else ''

    def lado(g, x0, W):
        # cada uno ocupa su carta MÁS la tira de abajo: la proporción de la caja entera, para que `acomodar()` los
        # haga entrar igual que antes
        filas, c, h, w, paso = acomodar(len(g), W, H, ratio=0.685 / (1 + TIRA))
        alto_carta = w / 0.685
        alto_total = filas * h + (filas - 1) * 12
        out = []
        for i, y in enumerate(g):
            fila, col = divmod(i, c)
            en_fila = min(c, len(g) - fila * c)
            ancho_fila = w + (en_fila - 1) * paso
            left = x0 + (W - ancho_fila) / 2 + col * paso
            top = y0 + (H - alto_total) / 2 + fila * (h + 12)
            # la mano de cartas: un poco giradas y en arco, sólo cuando se superponen
            gira = ''
            if paso < w:
                off = col - (en_fila - 1) / 2
                gira = 'transform:translateY(%.1fpx) rotate(%.1fdeg);' % (abs(off) * 5, max(-7, min(7, off * 3)))
            caja = 'left:%.1fpx;top:%.1fpx;width:%.1fpx;height:%.1fpx;z-index:%d;%s' % (left, top, w, h, 10 + i, gira)
            if y.get('carta'):
                carta = '<img class="gc" style="height:%.1fpx" src="%s" alt="">' % (alto_carta, _e(y['carta']))
            else:
                fs = max(13, min(30, int(w / 8)))
                ovr = '<span class="ovr" style="font-size:%dpx">OVR %d</span>' % (fs, y['ovr']) if y.get('ovr') else ''
                carta = ('<div class="gs" style="height:%.1fpx"><img class="sil" src="%s" alt=""><b style="font-size:%dpx">%s%s</b>%s</div>'
                         % (alto_carta, sil(y.get('n')), fs, _e(y.get('n') or '¿?'), bandera(y.get('fl')), ovr))
            out.append('<div class="gi" style="%s">%s%s</div>' % (caja, carta, tira(y, w)))
        return ''.join(out)

    pr = prob_lados(grupos)

    # debajo de cada lado, el MISMO número con el que se hizo la cuenta: si el pronóstico salió por Score, el Score
    campo, etiqueta = ('sc', 'Score') if pr and pr[1].startswith('Score') else ('ovr', 'OVR')

    def prom(g):
        xs = [float(y.get(campo) or 0) for y in g if float(y.get(campo) or 0) > 0]
        return int(round(sum(xs) / len(xs))) if xs else 0

    def pie(i, g, x0, W):
        o = prom(g)
        # 🔴 EL PROMEDIO ESCONDÍA A LOS QUE NO TIENEN DATOS (02/11/2026): en un 2 vs 1 con uno solo conocido, «OVR prom.
        # 78 · 2 raperos» hacía creer que los dos promediaban 78. Ahora dice cuántos de ellos cuentan
        con = sum(1 for y in g if float(y.get(campo) or 0) > 0)
        quien = (('%d raperos' % len(g)) if con in (0, len(g)) else ('%d de %d con datos' % (con, len(g)))) if len(g) > 1 else ''
        dato = ' · '.join(x for x in (('%s %d' % (etiqueta, o) if len(g) == 1 else '%s prom. %d' % (etiqueta, o)) if o
                                       else 'Sin datos en la Liga', quien) if x)
        pct = ('%d%%' % pr[0][i]) if pr else '??'
        return ('<div class="pie%s" style="left:%.1fpx;width:%.1fpx"><b style="color:%s">%s</b><span>%s</span></div>'
                % ('' if S == 2 else ' col', x0, W, cols[i] if pr else '#8A8A90', pct, _e(dato)))

    partes = []
    for i, (g, (x0, W)) in enumerate(zip(grupos, zonas)):
        partes.append(lado(g, x0, W))
        partes.append(pie(i, g, x0, W))
        if S > 2 and i:
            partes.append('<div class="vs chico" style="left:%.1fpx">VS</div>' % (x0 - 56 / 2 - 22))
    if S == 2:
        partes.append('<div class="vs" style="left:%dpx">VS</div>' % (600 - 55))

    if pr:
        barra = ''.join('<i style="width:%d%%;background:%s"></i>' % (p, c) for p, c in zip(pr[0], cols))
        pron = '<div class="pr"><div class="pr-b">%s</div><span class="et">Pronóstico · por %s</span></div>' % (barra, pr[1])
    else:
        pron = '<div class="pr nada"><div class="pr-b"></div><span class="et">Pronóstico: sin datos de un lado</span></div>'

    formato = ' VS '.join(str(len(g)) for g in grupos) if S == 2 else ''
    chips = ''.join(x for x in (
        '<span class="fmt">%s</span>' % _e(formato) if formato else '',
        '<span class="et tit">%s</span>' % _e(v.get('titulo')) if hay_tit else '',
        '<small>%s</small>' % _e(v.get('sub')) if v.get('sub') else '') if x)
    ev = re.sub(r'[_*~`#>]+', ' ', str(v.get('ev') or '')).strip()
    css = """
#c{width:1200px;height:675px;position:relative;overflow:hidden;background:#0a0a0d}
#c .mitad{position:absolute;inset:0;background:%(fondo)s;clip-path:polygon(0 0,58%% 0,42%% 100%%,0 100%%)}
#c .cab{position:absolute;left:44px;top:28px;right:44px;display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
#c .cab b{display:block;font-weight:900;font-size:34px;line-height:1;text-transform:uppercase;font-stretch:112%%;max-width:760px}
#c .cab .et{display:block;margin-top:6px;font-size:22px;opacity:.85}
#c .cab .marca img{width:62px;height:62px;border-radius:50%%;object-fit:cover}
#c .chips{position:absolute;left:44px;right:44px;top:108px;display:flex;align-items:center;gap:12px;white-space:nowrap;overflow:hidden}
#c .chips .fmt{font-weight:900;font-size:24px;line-height:1;padding:6px 12px;border:3px solid #fff;font-style:italic}
#c .chips .tit{display:inline-block;background:#FFD24A;color:#0a0a0d;font-size:22px;padding:6px 12px}
#c .chips small{font-size:18px;opacity:.9;overflow:hidden;text-overflow:ellipsis}
#c .gi{position:absolute;display:flex;flex-direction:column;align-items:stretch;transform-origin:50%% 100%%}
#c .gc{display:block;width:100%%;object-fit:contain;filter:drop-shadow(0 10px 18px rgba(0,0,0,.6))}
#c .gs{border:3px solid rgba(255,255,255,.3);border-radius:12px;background:#17171C;display:flex;flex-direction:column;
  align-items:center;justify-content:flex-end;gap:6px;padding:10px 8px 14px;text-align:center;box-shadow:0 10px 18px rgba(0,0,0,.5)}
#c .gt{flex:1 1 auto;display:flex;align-items:center;justify-content:flex-start;gap:6px;margin-top:5px;padding:0 6px;
  background:rgba(10,10,13,.82);border-radius:6px;overflow:hidden;white-space:nowrap}
#c .gt .rg{font-weight:900;line-height:1;padding:1px 4px;border:2px solid;border-radius:3px}
#c .gt .fm{display:flex;gap:3px}
#c .gt .fm i{display:block;border:1.5px solid #fff}
#c .gt .fm i.g{background:#29B298}
#c .gt .fm i.p{background:#E41373}
#c .gt .rc{font-weight:900;line-height:1;color:#FFD24A}
#c .gs .sil{width:68%%;height:auto;opacity:.9;margin-bottom:auto;margin-top:12%%}
#c .gs b{font-weight:900;line-height:1.05;text-transform:uppercase;overflow-wrap:anywhere}
#c .gs .ovr{font-weight:900;color:#FFD24A}
#c .fl{height:.75em;width:auto;vertical-align:.04em;margin-left:6px;border-radius:2px}
#c .vs{position:absolute;top:%(vs_y)dpx;width:110px;height:110px;border-radius:50%%;background:#E41373;border:6px solid #fff;
  display:grid;place-items:center;font-weight:900;font-size:46px;font-style:italic;box-shadow:0 10px 30px rgba(0,0,0,.5);z-index:40}
#c .vs.chico{width:44px;height:44px;top:%(vs_c)dpx;border-width:3px;font-size:18px}
#c .pie{position:absolute;top:%(pie_y)dpx;display:flex;align-items:baseline;justify-content:center;gap:12px;text-align:center}
#c .pie b{font-weight:900;font-size:40px;line-height:1}
#c .pie span{font-weight:800;font-size:19px;opacity:.9;text-transform:uppercase;letter-spacing:.02em}
#c .pie.col{flex-direction:column;align-items:center;gap:4px;top:%(pie_c)dpx}
#c .pie.col b{font-size:34px}
#c .pie.col span{font-size:15px;line-height:1.1}
#c .pr{position:absolute;left:44px;right:44px;top:%(pr_y)dpx}
#c .pr-b{display:flex;height:16px;border:2px solid #fff;background:#3A3A3E}
#c .pr-b i{display:block;height:100%%;border-right:3px solid #0a0a0d}
#c .pr-b i:last-child{border-right:0}
#c .pr .et{display:block;margin-top:8px;font-size:16px;opacity:.85;text-align:center}
""" % {'fondo': _e(d['color']), 'vs_y': y0 + H // 2 - 55, 'vs_c': y0 + H // 2 - 22, 'pie_y': y0 + H + 14, 'pie_c': y0 + H + 6, 'pr_y': y0 + H + 72}
    return ("""<!doctype html><html><head><meta charset="utf-8"><style>%s%s%s</style></head><body><div id="c" class="f">
<div class="mitad"></div>
<div class="cab"><div><b>%s</b><span class="et">%s · %s</span></div><div class="marca">%s</div></div>
<div class="chips">%s</div>
%s
%s
</div></body></html>""" % (_fuentes(), _BASE_CSS, css, _e(ev[:60] or 'Liga Global'), _e(v.get('ronda') or ''), _e(d['nombre']),
                            ('<img src="%s" alt="">' % d['logo']) if d['logo'] else '', chips, ''.join(partes), pron))


def html_vs(v, d):
    """🖼️ EL VS (Dlx, 12/10/2026: «hacerlo más visual para mostrar las imágenes cuando sea un vs, o sea las tarjetas»; a
    las dos formas, «B»: una imagen armada). `v` es lo que guardó el objeto (`vsEncolar()` en avisos.js): `{ev, ronda,
    titulo, sub, h2h, gano, a, b}`, cada lado `{n, fl, ovr, sc, rg, forma, racha, carta, noche}`. ⚠️ Quien no tiene tarjeta
    sale con la silueta, su nombre, su bandera y su OVR: la imagen nunca queda con un lado vacío.

    🥊 LA PANTALLA DE PELEA (02/11/2026, el remake del VS; Dlx eligió la «B» del lienzo: «mainly the one with VS», y
    «exclude whats already in the card»). El fondo se parte en dos con el color de la letra de cada uno, separado por una
    costura en diagonal; arriba el pronóstico, como la barra de la «Prediction Market Card» de 21st (dos colores con el
    corte en diagonal); las cartas inclinadas hacia la costura; un VS grande; en el medio la historia del cruce (su título,
    el cara a cara en grande y una línea); abajo de cada carta, sus últimos 5 duelos (en segmentos, como el «Energy Meter»)
    y lo que hizo esta noche (`nocheVs()`). ⚠️ NADA DE LO QUE LA CARTA YA DICE: ni la letra, ni el OVR, ni la bandera,
    ni la racha de eventos —eso estaba en la tira de antes—. Sólo el que NO tiene carta lleva su nombre, bandera y OVR.

    🏁 CON `gano` ('a' o 'b') ES LA IMAGEN DEL RESULTADO (`vsResultado()`): arriba «X PASA», el que perdió en gris y el
    cara a cara ya sumado. Reemplaza a la de antes en el mismo mensaje."""
    # 🧩 los otros formatos (2v2, 1v3, 1v1v1…): su propio armado, con todas las tarjetas
    if v.get('grupos'):
        return html_vs_grupos(v, d)
    from comun import sin_foto as SF
    from comun.rangos import ACENTO

    def bandera(fl):
        cps = [ord(c) - 0x1F1E6 for c in str(fl or '')]
        if len(cps) != 2 or not all(0 <= c < 26 for c in cps):
            return ''
        try:
            from comun import banderas as BA
            src = BA.src(''.join(chr(97 + c) for c in cps))
        except Exception:                                # noqa: BLE001
            src = ''
        return ' <img class="fl" src="%s" alt="">' % src if src else ''

    def sil(n):
        return 'data:image/svg+xml;base64,' + base64.b64encode(
            SF.svg(SF.cual(n)).replace('#0a0a0d', '#F6F6F6').encode('utf-8')).decode()

    def color(y, otro):
        rg = str((y or {}).get('rg') or '').rstrip('+-−')
        return ACENTO.get(rg, otro)

    def oscuro(hx, f=0.24):
        """El fondo de cada mitad: el color de su letra, oscurecido (plano, sin degradé)."""
        hx = str(hx or '#808080').lstrip('#')
        try:
            r, g, b = (int(hx[i:i + 2], 16) for i in (0, 2, 4))
        except ValueError:
            r, g, b = 128, 128, 128
        return '#%02x%02x%02x' % (round(r * f), round(g * f), round(b * f))

    ca, cb = color(v.get('a'), '#E41373'), color(v.get('b'), '#F6F6F6')
    # la misma letra los dos: el segundo en blanco, o la barra y el fondo serían de un solo color
    if cb == ca:
        cb = '#F6F6F6'
    gano = v.get('gano') if v.get('gano') in ('a', 'b') else ''

    def tamano(txt, grande, chico, cabe):
        """🔤 el tamaño de un texto para que entre en una línea: `grande` hasta `cabe` letras, y baja hasta `chico`."""
        n = max(1, len(str(txt or '')))
        return max(chico, min(grande, int(grande * cabe / n)))

    def lado(y, cls):
        y = y or {}
        perdio = ' perdio' if gano and gano != cls else ''
        # ⚠️ sin banda «PASA» sobre la carta del que ganó: tapaba sus números y repetía el «X PASA» de arriba
        pasa = ''
        if y.get('carta'):
            return '<div class="ld %s%s"><img class="carta" src="%s" alt="">%s</div>' % (cls, perdio, _e(y['carta']), pasa)
        n = str(y.get('n') or '¿?')
        ovr = '<span class="ovr">OVR %d</span>' % y['ovr'] if y.get('ovr') else ''
        # 🔤 por el ancho de la caja (260 px útiles; una mayúscula de Archivo 900 ocupa ~0,9 de su tamaño, medido con
        # «PUBLICENEMYNUMEROUNO»): un nombre largo sin espacios se achica en vez de partirse a la mitad
        px = max(13, min(34, int(260 / (0.9 * max(1, len(n) + (2 if y.get('fl') else 0))))))
        return ('<div class="ld %s%s"><div class="sin"><img class="sil" src="%s" alt=""><b style="font-size:%dpx">%s%s</b>%s</div>%s</div>'
                % (cls, perdio, sil(n), px, _e(n), bandera(y.get('fl')), ovr, pasa))

    def pie(y, cls):
        """🧾 debajo de cada carta: sus últimos 5 duelos —verde ganó, vacío perdió, del más viejo al más nuevo— y lo que
        hizo esta noche. Sin nada de eso, no hay pie"""
        y = y or {}
        forma = re.sub(r'[^GP]', '', str(y.get('forma') or ''))[-5:]
        filas = []
        if forma:
            filas.append('<div class="fm"><span class="segs">%s</span><span class="et">Últimos %d duelos</span></div>'
                         % (''.join('<i class="%s"></i>' % ('g' if c == 'G' else 'p') for c in forma), len(forma)))
        if y.get('noche'):
            filas.append('<span class="noche">%s</span>' % _e(str(y['noche'])[:60]))
        return '<div class="pie %s">%s</div>' % (cls, ''.join(filas)) if filas else ''

    def arriba():
        if gano:
            n = str(((v.get(gano) or {}).get('n')) or '')
            txt = ('%s pasa' % n) if n else 'Pasa'
            return '<div class="gana"><b style="font-size:%dpx">%s</b></div>' % (tamano(txt, 46, 28, 22), _e(txt))
        pr = prob_vs(v.get('a'), v.get('b'))
        if not pr:
            return ('<div class="pr nada"><b>??</b><div class="pr-b"><span class="et">Sin datos de uno</span></div><b>??</b></div>')
        return ('<div class="pr"><b style="color:%s">%d%%</b><div class="pr-b"><i class="l" style="width:%d%%;background:%s"></i>'
                '<i class="r" style="width:calc(%d%% - 6px);background:%s"></i><span class="et" style="left:%d%%">Pronóstico · por %s</span>'
                '</div><b style="color:%s">%d%%</b></div>' % (ca, pr[0], pr[0], ca, pr[1], cb, pr[0], pr[2], cb, pr[1]))

    def historia():
        """El cuento del cruce, en el medio: su título, el cara a cara en grande y una línea"""
        partes = []
        if v.get('titulo'):
            partes.append('<span class="tt">%s</span>' % _e(v['titulo']))
        h = v.get('h2h')
        if isinstance(h, (list, tuple)) and len(h) == 2:
            if h[0] or h[1]:
                partes.append('<b class="hh"><u style="color:%s">%d</u><i>–</i><u style="color:%s">%d</u></b><span class="et">En el cara a cara</span>'
                              % (ca, int(h[0]), cb, int(h[1])))
            else:
                partes.append('<span class="et primero">Primer cruce</span>')
        if v.get('sub'):
            partes.append('<small>%s</small>' % _e(v['sub']))
        return '<div class="historia">%s</div>' % ''.join(partes) if partes else ''

    ev = re.sub(r'[_*~`#>]+', ' ', str(v.get('ev') or '')).strip()
    ev = (ev[:33].rstrip() + '…') if len(ev) > 34 else ev
    css = """
#c{width:1200px;height:675px;position:relative;overflow:hidden;background:#030304}
#c .mitad{position:absolute;inset:0}
#c .mitad.a{background:%(fa)s;clip-path:polygon(0 0,55.5%% 0,44.5%% 100%%,0 100%%)}
#c .mitad.b{background:%(fb)s;clip-path:polygon(55.5%% 0,100%% 0,100%% 100%%,44.5%% 100%%)}
#c .costura{position:absolute;inset:0;background:#E41373;clip-path:polygon(54.7%% 0,56.3%% 0,45.3%% 100%%,43.7%% 100%%)}
#c .costura.blanca{background:#F6F6F6;clip-path:polygon(55.2%% 0,55.8%% 0,44.8%% 100%%,44.2%% 100%%)}
#c .pr{position:absolute;left:40px;right:40px;top:26px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:18px;align-items:center}
#c .pr>b{font-weight:900;font-size:44px;line-height:1}
#c .pr-b{position:relative;height:22px}
#c .pr-b i{position:absolute;top:0;bottom:0}
#c .pr-b i.l{left:0;clip-path:polygon(0 0,100%% 0,calc(100%% - 14px) 100%%,0 100%%)}
#c .pr-b i.r{right:0;clip-path:polygon(14px 0,100%% 0,100%% 100%%,0 100%%)}
#c .pr-b .et{position:absolute;top:30px;transform:translateX(-50%%);white-space:nowrap;font-size:17px;letter-spacing:.12em}
#c .pr.nada .pr-b{background:#3A3A3E}
#c .pr.nada .pr-b .et{left:50%%}
#c .gana{position:absolute;left:40px;right:40px;top:20px;display:flex;justify-content:center}
#c .gana b{font-weight:900;font-style:italic;line-height:1;text-transform:uppercase;background:#F6F6F6;color:#030304;padding:8px 18px 6px;
  max-width:1100px;white-space:nowrap;overflow:hidden}
#c .ld{position:absolute;top:104px;height:456px;width:312px;display:grid;place-items:center}
#c .ld.a{left:118px;transform:rotate(-3deg)}
#c .ld.b{right:118px;transform:rotate(3deg)}
#c .ld.perdio{filter:grayscale(1);opacity:.45}
#c .carta{height:456px;width:auto;display:block}
#c .sin{width:300px;height:438px;border:3px solid rgba(255,255,255,.3);border-radius:4px;background:#121214;display:flex;flex-direction:column;
  align-items:center;justify-content:flex-end;gap:10px;padding:24px 18px 30px;text-align:center}
#c .sin .sil{width:220px;height:220px;opacity:.9}
#c .sin b{font-weight:900;line-height:1.05;text-transform:uppercase;max-width:100%%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#c .sin .ovr{font-weight:900;font-size:24px;color:#FFD24A}
#c .fl{height:.75em;width:auto;vertical-align:.04em;margin-left:8px}
#c .pasa{position:absolute;left:-16px;right:-16px;bottom:78px;background:#29B298;color:#030304;font-weight:900;font-style:italic;
  font-size:32px;line-height:1;text-align:center;padding:10px 0 8px;transform:rotate(-6deg)}
#c .vs-fondo{position:absolute;left:50%%;top:214px;width:250px;height:132px;transform:translateX(-50%%) skewX(-12deg);background:#E41373}
#c .vs{position:absolute;left:50%%;top:196px;transform:translateX(-50%%);font-weight:900;font-style:italic;font-size:172px;line-height:1;
  letter-spacing:-.05em;color:#F6F6F6}
#c .historia{position:absolute;left:50%%;top:380px;width:270px;transform:translateX(-50%%);background:#030304;display:flex;flex-direction:column;
  align-items:center;gap:4px;padding:14px 14px 14px;text-align:center}
#c .historia .tt{font-weight:900;font-size:22px;line-height:1.1;letter-spacing:.02em}
#c .historia .hh{font-weight:900;font-size:52px;line-height:1.05}
#c .historia .hh u{text-decoration:none}
#c .historia .hh i{font-style:normal;color:#6E6E6A;margin:0 10px}
#c .historia .et{font-size:18px;letter-spacing:.06em;color:#A5A5A0}
#c .historia .primero{color:#F6F6F6;font-size:20px}
#c .historia small{font-size:16px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#c .pie{position:absolute;top:584px;width:340px;display:flex;flex-direction:column;gap:7px}
#c .pie.a{left:92px;align-items:flex-start}
#c .pie.b{right:92px;align-items:flex-end;text-align:right}
#c .fm{display:flex;align-items:center;gap:10px}
#c .pie.b .fm{flex-direction:row-reverse}
#c .segs{display:flex;gap:4px}
#c .segs i{display:block;width:30px;height:16px;box-shadow:inset 0 0 0 2px #A5A5A0}
#c .segs i.g{background:#29B298;box-shadow:none}
#c .fm .et{font-size:18px;letter-spacing:.06em}
#c .noche{font-weight:600;font-size:18px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px}
#c .evento{position:absolute;left:50%%;bottom:18px;transform:translateX(-50%%);display:flex;align-items:center;gap:10px;background:#030304;
  padding:6px 14px 6px 8px;white-space:nowrap}
#c .evento img{width:32px;height:32px;border-radius:50%%;object-fit:cover}
#c .evento .et{font-size:18px;letter-spacing:.1em}
#c .et{text-transform:uppercase}
""" % {'fa': oscuro(ca), 'fb': oscuro(cb)}
    return ("""<!doctype html><html><head><meta charset="utf-8"><style>%s%s%s</style></head><body><div id="c" class="f">
<div class="mitad a"></div><div class="mitad b"></div><div class="costura"></div><div class="costura blanca"></div>
%s%s%s
<div class="vs-fondo"></div><div class="vs">VS</div>
%s%s%s
<div class="evento">%s<span class="et">%s</span></div>
</div></body></html>""" % (_fuentes(), _BASE_CSS, css, arriba(), lado(v.get('a'), 'a'), lado(v.get('b'), 'b'),
                            historia(), pie(v.get('a'), 'a'), pie(v.get('b'), 'b'),
                            ('<img src="%s" alt="">' % d['logo']) if d.get('logo') else '',
                            _e(' · '.join(x for x in (ev or d.get('nombre') or 'Liga Global', v.get('ronda') or '') if x))))


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
         and 'OVR 90' not in html_vs({'a': {'n': 'A', 'ovr': 90, 'carta': 'https://pub-a.r2.dev/a.webp'}, 'b': {'n': 'B', 'ovr': 80}}, d)
         and 'OVR 80' in html_vs({'a': {'n': 'A', 'ovr': 90, 'carta': 'https://pub-a.r2.dev/a.webp'}, 'b': {'n': 'B', 'ovr': 80}}, d)
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
