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

    def lado(g, x0, W):
        filas, c, h, w, paso = acomodar(len(g), W, H)
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
                out.append('<img class="gc" style="%s" src="%s" alt="">' % (caja, _e(y['carta'])))
                continue
            fs = max(13, min(30, int(w / 8)))
            ovr = '<span class="ovr" style="font-size:%dpx">OVR %d</span>' % (fs, y['ovr']) if y.get('ovr') else ''
            out.append('<div class="gs" style="%s"><img class="sil" src="%s" alt=""><b style="font-size:%dpx">%s%s</b>%s</div>'
                       % (caja, sil(y.get('n')), fs, _e(y.get('n') or '¿?'), bandera(y.get('fl')), ovr))
        return ''.join(out)

    pr = prob_lados(grupos)

    # debajo de cada lado, el MISMO número con el que se hizo la cuenta: si el pronóstico salió por Score, el Score
    campo, etiqueta = ('sc', 'Score') if pr and pr[1].startswith('Score') else ('ovr', 'OVR')

    def prom(g):
        xs = [float(y.get(campo) or 0) for y in g if float(y.get(campo) or 0) > 0]
        return int(round(sum(xs) / len(xs))) if xs else 0

    def pie(i, g, x0, W):
        o = prom(g)
        quien = ('%d raperos' % len(g)) if len(g) > 1 else ''
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
#c .gc{position:absolute;object-fit:contain;filter:drop-shadow(0 10px 18px rgba(0,0,0,.6));transform-origin:50%% 100%%}
#c .gs{position:absolute;border:3px solid rgba(255,255,255,.3);border-radius:12px;background:#17171C;display:flex;flex-direction:column;
  align-items:center;justify-content:flex-end;gap:6px;padding:10px 8px 14px;text-align:center;box-shadow:0 10px 18px rgba(0,0,0,.5);
  transform-origin:50%% 100%%}
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
    titulo, sub, h2h, a, b}`, cada lado `{n, fl, ovr, sc, rg, forma, racha, carta}`. ⚠️ Quien no tiene tarjeta sale con la
    silueta, su nombre y su OVR: la imagen nunca queda con un lado vacío (en la COMPE de FFA del 12/10, 13 de 27 tenían
    tarjeta).

    🧩 ORDENADA EN ZONAS (13/10/2026, Dlx a la primera con todo: «me gusta pero asegurate que todo esté organizado, se ve
    muy apretado… puede ser más personalizable»). Tenía paneles de 120 px a los costados y siete cosas apiladas en los
    240 px del medio. Ahora, en 1200×675: arriba el evento; a los lados las dos tarjetas y, DEBAJO de cada una, una sola
    tira con su letra, sus últimos 5 y su racha; en el medio, en una columna que reparte el aire sola —y se acomoda si
    falta algo—, el título del cruce, el cara a cara, el VS y el pronóstico. Personalizada a los dos: la barra y la tira
    de cada uno llevan el color de SU letra (`comun.rangos.ACENTO`); sin letra, el magenta y el blanco de la Liga."""
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

    ca, cb = color(v.get('a'), '#E41373'), color(v.get('b'), '#F6F6F6')
    # la misma letra los dos: el segundo en blanco, o la barra sería de un solo color
    if cb == ca:
        cb = '#F6F6F6'

    def lado(y, cls):
        y = y or {}
        if y.get('carta'):
            return '<div class="ld %s"><img class="carta" src="%s" alt=""></div>' % (cls, _e(y['carta']))
        ovr = '<span class="et ovr">OVR %d</span>' % y['ovr'] if y.get('ovr') else ''
        return ('<div class="ld %s"><div class="sin"><img class="sil" src="%s" alt=""><b>%s%s</b>%s</div></div>'
                % (cls, sil(y.get('n')), _e(y.get('n') or '¿?'), bandera(y.get('fl')), ovr))

    def tira(y, cls, col):
        """🧾 debajo de cada tarjeta, en una fila: su letra con su color, los últimos 5 duelos —verde ganó, magenta perdió,
        del más viejo al más nuevo— y la racha si es de 2 o más. Sin nada de eso, no hay tira"""
        y = y or {}
        partes = []
        rg = str(y.get('rg') or '')
        if rg:
            partes.append('<b class="rg" style="color:%s;border-color:%s">%s</b>' % (col, col, _e(rg)))
        forma = re.sub(r'[^GP]', '', str(y.get('forma') or ''))[-5:]
        if forma:
            partes.append('<span class="fm" title="los últimos %d">%s</span>'
                          % (len(forma), ''.join('<i class="%s"></i>' % ('g' if c == 'G' else 'p') for c in forma)))
        if int(y.get('racha') or 0) >= 2:
            partes.append('<span class="rc"><span class="et">Racha</span><b>%d</b></span>' % int(y['racha']))
        return '<div class="ti %s" style="border-color:%s">%s</div>' % (cls, col, ''.join(partes)) if partes else ''

    def cara_a_cara():
        h = v.get('h2h')
        if not isinstance(h, (list, tuple)) or len(h) != 2:
            return ''
        if not (h[0] or h[1]):
            return '<div class="hh"><span class="et">Primer cruce</span></div>'
        return ('<div class="hh"><span class="et">Cara a cara</span><b><u style="color:%s">%d</u><i>–</i><u style="color:%s">%d</u></b></div>'
                % (ca, int(h[0]), cb, int(h[1])))

    def barra():
        pr = prob_vs(v.get('a'), v.get('b'))
        if not pr:
            return ('<div class="pr nada"><div class="pr-n"><b>??</b><b>??</b></div><div class="pr-b"></div>'
                    '<span class="et">Sin datos de uno</span></div>')
        return ('<div class="pr"><div class="pr-n"><b style="color:%s">%d%%</b><b style="color:%s">%d%%</b></div>'
                '<div class="pr-b" style="background:%s"><i style="width:%d%%;background:%s"></i></div>'
                '<span class="et">Pronóstico · por %s</span></div>' % (ca, pr[0], cb, pr[1], cb, pr[0], ca, pr[2]))

    tit = ('<div class="tt"><span class="et">%s</span>%s</div>' % (_e(v.get('titulo')), ('<small>%s</small>' % _e(v.get('sub')))
                                                                    if v.get('sub') else '')) if v.get('titulo') else ''
    ev = re.sub(r'[_*~`#>]+', ' ', str(v.get('ev') or '')).strip()
    css = """
#c{width:1200px;height:675px;position:relative;overflow:hidden;background:#0a0a0d}
#c .mitad{position:absolute;inset:0;background:%(fondo)s;clip-path:polygon(0 0,58%% 0,42%% 100%%,0 100%%)}
#c .cab{position:absolute;left:44px;top:30px;right:44px;display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
#c .cab b{display:block;font-weight:900;font-size:34px;line-height:1;text-transform:uppercase;font-stretch:112%%;max-width:760px}
#c .cab .et{display:block;margin-top:6px;font-size:22px;opacity:.85}
#c .cab .marca img{width:62px;height:62px;border-radius:50%%;object-fit:cover}
#c .ld{position:absolute;top:122px;width:300px;height:430px;display:grid;place-items:center}
#c .ld.a{left:130px}
#c .ld.b{right:130px}
#c .carta{height:430px;width:auto;filter:drop-shadow(0 14px 24px rgba(0,0,0,.55))}
#c .sin{width:294px;height:430px;border:3px solid rgba(255,255,255,.28);border-radius:16px;background:rgba(255,255,255,.06);
  display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:10px;padding:24px 18px 30px;text-align:center}
#c .sin .sil{width:220px;height:220px;opacity:.9}
#c .sin b{font-weight:900;font-size:30px;line-height:1.05;text-transform:uppercase;overflow-wrap:anywhere}
#c .sin .ovr{font-size:24px;color:#FFD24A}
#c .fl{height:.75em;width:auto;vertical-align:.04em;margin-left:8px;border-radius:2px}
#c .ti{position:absolute;top:572px;width:300px;height:58px;display:flex;align-items:center;justify-content:center;gap:18px;
  background:rgba(10,10,13,.78);border:2px solid;border-radius:12px}
#c .ti.a{left:130px}
#c .ti.b{right:130px}
#c .ti .rg{font-weight:900;font-size:28px;line-height:1;padding:3px 9px;border:3px solid;border-radius:4px}
#c .fm{display:flex;gap:5px}
#c .fm i{display:block;width:18px;height:18px;border:2px solid #fff}
#c .fm i.g{background:#29B298}
#c .fm i.p{background:#E41373}
#c .rc{display:flex;align-items:baseline;gap:6px}
#c .rc .et{font-size:16px;opacity:.85}
#c .rc b{font-weight:900;font-size:28px;line-height:1;color:#FFD24A}
#c .centro{position:absolute;left:50%%;top:118px;bottom:40px;transform:translateX(-50%%);width:290px;display:flex;
  flex-direction:column;align-items:center;justify-content:space-evenly;text-align:center}
#c .tt{max-width:290px;padding:10px 12px 12px;background:rgba(10,10,13,.72);border-radius:12px}
#c .tt .et{display:inline-block;background:#FFD24A;color:#0a0a0d;font-size:26px;padding:6px 14px}
#c .tt small{display:block;margin-top:8px;font-size:18px;line-height:1.25;opacity:.9}
#c .hh{padding:8px 18px 10px;background:rgba(10,10,13,.72);border-radius:12px}
#c .hh .et{font-size:18px;opacity:.9}
#c .hh b{display:block;margin-top:2px;font-weight:900;font-size:50px;line-height:1}
#c .hh u{text-decoration:none}
#c .hh i{font-style:normal;opacity:.5;margin:0 12px}
#c .vs{width:118px;height:118px;flex:none;border-radius:50%%;background:#E41373;border:6px solid #fff;display:grid;place-items:center;
  font-weight:900;font-size:50px;font-style:italic;box-shadow:0 10px 30px rgba(0,0,0,.5)}
#c .pr{width:250px;padding:10px 12px 12px;background:rgba(10,10,13,.72);border-radius:12px}
#c .pr-n{display:flex;justify-content:space-between;font-weight:900;font-size:32px;line-height:1}
#c .pr-b{display:flex;height:14px;margin-top:8px;border:2px solid #fff}
#c .pr-b i{display:block;height:100%%;border-right:3px solid #0a0a0d}
#c .pr.nada .pr-b{background:#3A3A3E}
#c .pr .et{display:block;margin-top:8px;font-size:16px;opacity:.85}
#c .liga{position:absolute;left:0;right:0;bottom:0}
""" % {'fondo': _e(d['color'])}
    return ("""<!doctype html><html><head><meta charset="utf-8"><style>%s%s%s</style></head><body><div id="c" class="f">
<div class="mitad"></div>
<div class="cab"><div><b>%s</b><span class="et">%s · %s</span></div><div class="marca">%s</div></div>
%s%s%s%s
<div class="centro">%s%s<div class="vs">VS</div>%s</div>
<div class="liga"></div>
</div></body></html>""" % (_fuentes(), _BASE_CSS, css, _e(ev[:60] or 'Liga Global'), _e(v.get('ronda') or ''), _e(d['nombre']),
                            ('<img src="%s" alt="">' % d['logo']) if d['logo'] else '',
                            lado(v.get('a'), 'a'), lado(v.get('b'), 'b'), tira(v.get('a'), 'a', ca), tira(v.get('b'), 'b', cb),
                            tit, cara_a_cara(), barra()))


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
            texto = '🧰 La llave de **%s**, como la leyó el bot. Si algo salió mal, es que se leyó mal: avisá.' % ll[0]
    except LookupError as e:
        print('   ⚠️ %s' % e)
        if id_:
            avisar(id_, error=str(e))
        return 0
    except Exception as e:                               # noqa: BLE001
        print('   🔴 %s' % e)
        if id_:
            avisar(id_, error='No pude armarla esta vez. Probá de nuevo en un rato.')
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
        v['a'].update(forma='GGPGG', racha=3); v['b'].update(forma='PGGPG', racha=0); v['h2h'] = [2, 1]
        os.makedirs(SALIDA, exist_ok=True)
        ruta = os.path.join(SALIDA, 'vs_muestra_%s_%s.jpg' % tuple(ks))
        foto(html_vs(v, _sv_datos(sv)), ruta, jpeg=True)
        print(ruta)
        sys.exit(0)
    if tipo == 'vs':
        sys.exit(correr_vs(sv))
    sys.exit(correr(tipo, sv, arg('--id')))
