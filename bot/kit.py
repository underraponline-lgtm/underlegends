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


def html_vs_grupos(v, d):
    """🖼️ EL VS DE LOS OTROS FORMATOS (19/10/2026, Dlx: «hacer algo para que muestre sus tarjetas en estos formatos
    distintos»): 2v2, 1v3, 8v1 del Multiverse y los «todos contra todos» (1v1v1). `v['grupos']` son los lados, cada uno
    una lista de `{n, fl, ovr, carta}`; cada lado con sus tarjetas, separados por VS. El tamaño de las tarjetas sale de
    cuántas hay —todas entran en los 1200 de ancho—, y quien no tiene tarjeta sale con la silueta y su nombre, como en
    el mano a mano. Sin barra de pronóstico ni cara a cara: son de dos personas."""
    from comun import sin_foto as SF
    grupos = [[y for y in (g or []) if y] for g in (v.get('grupos') or [])]
    grupos = [g for g in grupos if g][:5]
    total = sum(len(g) for g in grupos) or 1
    vss = max(0, len(grupos) - 1)
    # el ancho: 1120 útiles, 92 por cada VS y 14 entre tarjetas del mismo lado; una tarjeta mide 0,7 de su alto
    alto = int(min(400, (1120 - vss * 92 - (total - len(grupos)) * 14) / (total * 0.7)))
    ancho = int(alto * 0.7)

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

    def uno(y):
        nom = '<span class="gn">%s%s</span>' % (_e(y.get('n') or '¿?'), bandera(y.get('fl')))
        if y.get('carta'):
            return '<div class="gc"><img class="carta" src="%s" alt="">%s</div>' % (_e(y['carta']), nom)
        ovr = '<span class="ovr">OVR %d</span>' % y['ovr'] if y.get('ovr') else ''
        return '<div class="gc"><div class="sin"><img class="sil" src="%s" alt="">%s</div>%s</div>' % (sil(y.get('n')), ovr, nom)

    partes = []
    for i, g in enumerate(grupos):
        if i:
            partes.append('<div class="vs">VS</div>')
        partes.append('<div class="gr">%s</div>' % ''.join(uno(y) for y in g))
    tit = ('<div class="tt"><span class="et">%s</span>%s</div>' % (_e(v.get('titulo')), (' <small>%s</small>' % _e(v.get('sub')))
                                                                    if v.get('sub') else '')) if v.get('titulo') else ''
    ev = re.sub(r'[_*~`#>]+', ' ', str(v.get('ev') or '')).strip()
    css = """
#c{width:1200px;height:675px;position:relative;overflow:hidden;background:#0a0a0d}
#c .mitad{position:absolute;inset:0;background:%(fondo)s;clip-path:polygon(0 0,58%% 0,42%% 100%%,0 100%%)}
#c .cab{position:absolute;left:44px;top:30px;right:44px;display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
#c .cab b{display:block;font-weight:900;font-size:34px;line-height:1;text-transform:uppercase;font-stretch:112%%;max-width:760px}
#c .cab .et{display:block;margin-top:6px;font-size:22px;opacity:.85}
#c .cab .marca img{width:62px;height:62px;border-radius:50%%;object-fit:cover}
#c .tt{position:absolute;left:44px;top:118px;display:flex;align-items:baseline;gap:12px;max-width:1100px}
#c .tt .et{display:inline-block;background:#FFD24A;color:#0a0a0d;font-size:24px;padding:5px 12px}
#c .tt small{font-size:18px;opacity:.9}
#c .fila{position:absolute;left:40px;right:40px;top:%(top)dpx;bottom:34px;display:flex;align-items:center;justify-content:center;gap:0}
#c .gr{display:flex;align-items:flex-start;gap:14px}
#c .gc{display:flex;flex-direction:column;align-items:center;gap:8px;width:%(ancho)dpx}
#c .carta{height:%(alto)dpx;width:auto;max-width:%(ancho)dpx;filter:drop-shadow(0 12px 20px rgba(0,0,0,.55))}
#c .sin{width:%(ancho)dpx;height:%(alto)dpx;border:3px solid rgba(255,255,255,.28);border-radius:14px;background:rgba(255,255,255,.06);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}
#c .sin .sil{width:70%%;height:auto;opacity:.9}
#c .ovr{font-weight:900;font-size:%(fs)dpx;color:#FFD24A}
#c .gn{max-width:%(ancho)dpx;font-weight:900;font-size:%(fs)dpx;line-height:1.05;text-transform:uppercase;text-align:center;overflow-wrap:anywhere}
#c .fl{height:.75em;width:auto;vertical-align:.04em;margin-left:6px;border-radius:2px}
#c .vs{flex:none;width:72px;height:72px;margin:0 10px;border-radius:50%%;background:#E41373;border:5px solid #fff;display:grid;place-items:center;
  font-weight:900;font-size:30px;font-style:italic;box-shadow:0 10px 30px rgba(0,0,0,.5);align-self:center}
""" % {'fondo': _e(d['color']), 'alto': alto, 'ancho': ancho, 'top': 168 if tit else 122,
       'fs': max(14, min(26, int(ancho / 9)))}
    return ("""<!doctype html><html><head><meta charset="utf-8"><style>%s%s%s</style></head><body><div id="c" class="f">
<div class="mitad"></div>
<div class="cab"><div><b>%s</b><span class="et">%s · %s</span></div><div class="marca">%s</div></div>
%s
<div class="fila">%s</div>
</div></body></html>""" % (_fuentes(), _BASE_CSS, css, _e(ev[:60] or 'Liga Global'), _e(v.get('ronda') or ''), _e(d['nombre']),
                            ('<img src="%s" alt="">' % d['logo']) if d['logo'] else '', tit, ''.join(partes)))


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
        ('los otros formatos (2v2, 1v3, todos contra todos): cada lado con sus tarjetas y un VS entre lados, la silueta para '
         'quien no tiene, y todo entra en los 1200 de ancho',
         html_vs({'grupos': [[{'n': 'A', 'carta': 'https://pub-x.r2.dev/a.webp'}], [{'n': 'B', 'ovr': 70}, {'n': 'C'}, {'n': 'D'}]]}, d)
         .count('class="gr"') == 2
         and html_vs({'grupos': [[{'n': 'A'}], [{'n': 'B'}], [{'n': 'C'}]]}, d).count('class="vs"') == 2
         and 'class="sil"' in html_vs({'grupos': [[{'n': 'A'}], [{'n': 'B'}]]}, d)
         and '<b>x' not in html_vs({'grupos': [[{'n': '<b>x</b>'}], [{'n': 'B'}]]}, d)),
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
