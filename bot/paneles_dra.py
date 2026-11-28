# -*- coding: utf-8 -*-
"""LOS PANELES DE DRA: el ranking, Most Wanted y la semana, como imagen con botones (Dlx, 13/10/2026).

    python bot/paneles_dra.py --vista [carpeta]   dibuja los PNG, sin tocar Discord ni R2
    python bot/paneles_dra.py --aplicar            los actualiza en DRA (sólo de 11 AM a 3 AM ET; lo corre el ciclo)
    python bot/paneles_dra.py --aplicar --prender  la primera vez, con el sí de Dlx a la vista previa
    python bot/paneles_dra.py --auto               el self-check, sin red ni navegador

🔑 Dlx: *«acá irían los paneles con el ranking, paneles de most wanted… que DRA sea el centro de la Liga Global»*, y a
«¿texto o imagen?»: *«Imagen con botones»*. Los canales los arma `herramientas/dra_hub.py` (ranking, most-wanted y
esta-semana, en LIGA GLOBAL) y deja sus ids en `datos/dra_hub.json`.

⚠️ UN MENSAJE POR PANEL, QUE SE EDITA. Nunca uno nuevo: una edición no le suena a nadie ni ensucia el canal (como el
aviso de cada evento, [[avisar una vez y editar]]). El id queda en `datos/dra_hub.json` (`paneles`); si lo borraron, se
manda otro. Y sólo se edita si la imagen cambió (`firma`): cada media hora el ciclo lo mira, y casi nunca cambia.
⚠️ LOS BOTONES SON LINKS a la página: no hace falta que el Worker atienda nada. SALVO LOS QUE ACTÚAN AHÍ (28/11/2026, Dlx:
*«No todo debería simplemente llevar a la página. En pase rapero debería ser más interactuable»*): un botón
`(texto, 'cid:<custom_id>', emoji)` lo contesta el Worker con un mensaje que sólo ve quien tocó (`bot/pase_dc.js`). El
link a la página va siempre ÚLTIMO. ⚠️ Esos botones entran a la firma (`firma_de()`), y el Worker que los atiende se
despliega ANTES de que el panel los muestre: si no, el clic da «Esta interacción falló».
🪧 Y DESDE EL 28/11/2026, LOS CARTELES (`CARTELES`): uno por canal de DRA que no decía para qué era (la Guía, Empieza
aquí, Quiénes somos, Tu tarjeta, el Pase, la Tienda, los estilos de juego, Publicaciones, Mejores rimas y las Ligas, que
es un foro: va como publicación fijada), con el estilo del banner de Dlx. Los nuevos salen la primera vez sólo con
`--aplicar --prender` (`PIDEN_SI`); después se editan solos como los demás. Y la semana se mudó a eventos-hoy: el
canal `esta-semana` ya no existe desde el orden del 27/11.
✅ FVS SALE, como cualquier servidor de la Liga (Dlx, 13/10/2026, al ver la vista previa sin él: «FVS debería estar en
esto»). Lo del 12/10 («b») era no anunciar su llegada; no esconderlo. `FUERA` queda vacío por si algún día hace falta.
"""
import base64
import datetime as dt
import hashlib
import html
import io
import json
import os
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (BASE, SCR):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

WEB = 'https://underlegends.pages.dev/freestyle-rap'
HUB = os.path.join(BASE, 'datos', 'dra_hub.json')
GUILD = '841017460341604382'   # DRA
FUERA = set()            # servidores que no salen en el panel de la semana (ver arriba)
MAGENTA, VERDE, AMARILLO = '#E41373', '#29B298', '#F5C542'
#: dónde va la hora de «Actualizado»: se pone al dibujar, así la firma del panel no cambia sólo porque pasó el tiempo
CUANDO = '{{CUANDO}}'


def _e(s):
    return html.escape(str(s or ''), quote=True)


def _json(*ruta):
    try:
        with io.open(os.path.join(BASE, *ruta), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _et(t=None):
    """Ahora (o `t`, un ISO en UTC) en hora del este."""
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo('America/New_York')
    except Exception:                                    # noqa: BLE001
        tz = dt.timezone(dt.timedelta(hours=-4))
    x = dt.datetime.now(dt.timezone.utc) if t is None else dt.datetime.fromisoformat(str(t).replace('Z', '+00:00'))
    return x.astimezone(tz)


DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']


def _cuando(t):
    x = _et(t)
    h = x.strftime('%I:%M %p').lstrip('0').replace(':00', '')
    return '%s %d/%d · %s ET' % (DIAS[x.weekday()], x.day, x.month, h)


def _num(n):
    try:
        n = float(n)
    except (TypeError, ValueError):
        return '0'
    if n >= 100000:
        return '%dK' % round(n / 1000)
    return '{:,}'.format(int(round(n))).replace(',', '.')


def _limpio(n):
    return ' '.join(str(n or '').replace('_', ' ').split())


def _cara(nombre):
    """La foto de esa persona (`comun/respaldo.py`) o su silueta (`comun/sin_foto.py`)."""
    try:
        from comun import respaldo as RE
        a = RE.avatar(nombre)
        if a:
            return a
    except Exception:                                    # noqa: BLE001
        pass
    from comun import sin_foto as SF
    return SF.uri(nombre)


def _bandera(cc):
    try:
        from comun import banderas as BA
        return BA.src(cc) if cc else ''
    except Exception:                                    # noqa: BLE001
        return ''


def _logo(sv):
    p = os.path.join(BASE, 'bot', 'paginas', 'logos', str(sv).lower() + '.webp')
    if os.path.exists(p):
        return 'data:image/webp;base64,' + base64.b64encode(open(p, 'rb').read()).decode()
    return ''


def _fuentes():
    try:
        return io.open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8').read()
    except OSError:
        return ''


# 🖥️ HORIZONTALES DESDE EL 28/11/2026. Dlx: *«¿Por qué haces estos paneles de forma vertical cuando podemos hacerlo
# horizontal?»*. Eran de 1080 de ancho y 1.800 a 2.700 de alto: Discord los mostraba como una tira angosta que había que
# abrir para leer. Ahora los tres son 1920×1080 (16:9), como los carteles: la cabecera arriba de lado a lado, el cuerpo en
# columnas y el pie abajo.
# ⚠️ EL TAMAÑO DE LA LETRA SE PIENSA CONTRA EL CELULAR: el feed de Discord en un teléfono la muestra a ~400 px de ancho
# (×0,21). Lo que tiene que leerse ahí (los ×N, los títulos, los puntos) va a 44 px o más; lo secundario, a 26–30 px.
# ⚠️ Y SI ALGO NO ENTRA, EL PANEL SE ESTIRA, NO SE CORTA (`min-height`): `vista()` avisa si alguno sale más alto que 1080.
ANCHO_PANEL, ALTO_PANEL = 1920, 1080
CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0d}
#c{width:1920px;min-height:1080px;display:flex;flex-direction:column;background:#0a0a0d;color:#F6F6F6;font-family:'Archivo',sans-serif}
.et{font-family:'Barlow Condensed','Archivo',sans-serif;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.cab{display:flex;justify-content:space-between;align-items:center;gap:40px;padding:44px 64px 0}
.cab .tit{flex:1;min-width:0}
.cab h1{font-weight:900;font-size:96px;line-height:.92;text-transform:uppercase;font-stretch:115%;white-space:nowrap}
.cab .sub{font-size:30px;color:#C4C4BE;margin-bottom:12px}
.cab .ul{width:108px;height:108px;flex:none}
.cuerpo{flex:1;display:flex;flex-direction:column;min-height:0;padding:30px 64px 30px}
.pie{display:flex;justify-content:space-between;align-items:center;padding:16px 64px;background:#F6F6F6;color:#030304}
.pie b{font-weight:900;font-size:32px}
.pie span{font-size:26px}
.liga{height:12px;background:linear-gradient(90deg,#29B298 50%,#E41373 50%)}
.fl{height:.8em;width:auto;vertical-align:.02em;margin-left:12px;border-radius:2px}
"""


def _pagina(cuerpo, titulo, sub, extra_css='', cab_extra=''):
    """El panel de datos horizontal: cabecera (`sub` + `titulo`, y `cab_extra` antes del logo), cuerpo y pie."""
    ul = os.path.join(BASE, 'bot', 'paginas', 'ul.png')
    logo = ('data:image/png;base64,' + base64.b64encode(open(ul, 'rb').read()).decode()) if os.path.exists(ul) else ''
    return ('<!doctype html><html><head><meta charset="utf-8"><style>%s%s%s</style></head><body><div id="c">'
            '<div class="cab"><div class="tit"><div class="et sub">%s</div><h1>%s</h1></div>%s%s</div>'
            '<div class="cuerpo">%s</div>'
            '<div class="pie"><b>underlegends.pages.dev</b><span class="et">Actualizado %s</span></div><div class="liga"></div>'
            '</div></body></html>') % (_fuentes(), CSS, extra_css, _e(sub), titulo, cab_extra,
                                       ('<img class="ul" src="%s" alt="">' % logo) if logo else '', cuerpo, CUANDO)


# ── 🏆 el ranking de Temporada ──────────────────────────────────────────────────────────────────────────────────────
def datos_temporada(n=10):
    pool = _json('datos', 'temporada_pool.json') or []
    of = sorted((x for x in pool if x.get('pos') and not x.get('fc') and x.get('raw')), key=lambda x: x['pos'])[:n]
    cartas = _json('datos', 'cartas_r2.json') or {}
    from comun.claves import clave
    return [{'pos': x['pos'], 'n': _limpio(x['raw']), 'cc': x.get('cc') or '', 'ovr': x.get('ovr') or 0, 'pts': x.get('pts') or 0,
             'ev': x.get('ev') or 0, 'carta': ((cartas.get(clave(x['raw'])) or {}).get('temporada') or '')} for x in of]


def html_temporada(filas):
    """🖥️ Horizontal: el podio con las tres cartas a la izquierda y del 4 al 10 en una columna a la derecha."""
    css = """
.cuerpo{flex-direction:row;gap:56px;align-items:stretch}
.podio{flex:none;display:flex;gap:26px;align-items:flex-end}
.pc{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;width:356px}
.pc.p1{width:420px}
.pc img.carta{width:100%;height:auto;filter:drop-shadow(0 16px 26px rgba(0,0,0,.6))}
.pc .sin{width:100%;aspect-ratio:300/438;border:3px solid #3A3A3E;display:grid;place-items:center}
.pc .sin img{width:70%}
.pc b{font-weight:900;font-size:36px;text-transform:uppercase;font-stretch:110%;line-height:1;white-space:nowrap}
.pc .et{font-size:28px;color:#C4C4BE}
.pc .pos{font-family:'Barlow Condensed';font-weight:700;font-size:34px;padding:4px 18px;background:#F5C542;color:#030304}
.pc.p1 .pos{background:#E41373;color:#F6F6F6}
.lista{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between}
.fila{display:grid;grid-template-columns:78px 78px minmax(0,1fr);align-items:center;gap:18px;padding:8px 0;border-top:2px solid #26262B}
.fila:first-child{border-top:0}
.fila .n{font-family:'Barlow Condensed';font-weight:700;font-size:46px;color:#C4C4BE}
.fila img.c{width:78px;height:78px;border-radius:50%;object-fit:cover;background:#1A1A1F}
.fila b{display:block;font-weight:900;font-size:40px;line-height:1.05;text-transform:uppercase;font-stretch:108%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fila small{display:block;font-family:'Barlow Condensed';font-weight:700;font-size:30px;color:#C4C4BE;margin-top:2px}
.fila small i{font-style:normal;color:#F6F6F6}
"""
    if not filas:
        cuerpo = '<p class="et" style="font-size:44px;color:#C4C4BE;padding:40px 0">Todavía no hay nadie en la tabla.</p>'
        return _pagina(cuerpo, 'RANKING DE TEMPORADA', 'Liga Global · T1', css)

    def podio(x, cls):
        if not x:
            return '<div class="pc %s"></div>' % cls
        from comun import sin_foto as SF
        vis = ('<img class="carta" src="%s" alt="">' % _e(x['carta'])) if x['carta'] else \
              '<div class="sin"><img src="%s" alt=""></div>' % SF.uri(x['n'])
        bf = _bandera(x['cc'])
        pos = '' if x['carta'] else '<span class="pos">#%d</span>' % x['pos']
        return ('<div class="pc %s">%s%s<b>%s%s</b><span class="et">OVR %s · %s pts</span></div>'
                % (cls, pos, vis, _e(x['n']), ('<img class="fl" src="%s" alt="">' % bf) if bf else '', x['ovr'], _num(x['pts'])))
    top = {x['pos']: x for x in filas[:3]}
    cuerpo = '<div class="podio">%s%s%s</div><div class="lista">' % (podio(top.get(2), 'p2'), podio(top.get(1), 'p1'),
                                                                     podio(top.get(3), 'p3'))
    for x in filas[3:]:
        bf = _bandera(x['cc'])
        cuerpo += ('<div class="fila"><span class="n">#%d</span><img class="c" src="%s" alt=""><div><b>%s%s</b>'
                   '<small><i>OVR %s</i> · %s pts · %d eventos</small></div></div>'
                   % (x['pos'], _cara(x['n']), _e(x['n']), ('<img class="fl" src="%s" alt="">' % bf) if bf else '',
                      x['ovr'], _num(x['pts']), x['ev']))
    cuerpo += '</div>'
    return _pagina(cuerpo, 'RANKING DE TEMPORADA', 'Liga Global · T1 · los 10 primeros', css)


# ── 💀 Most Wanted ──────────────────────────────────────────────────────────────────────────────────────────────────
def datos_mw():
    a = (_json('datos', 'mw.json') or {}).get('actual') or {}
    return {'fin': a.get('fin') or '', 'b': [{'n': _limpio(b['n']), 'cn': b.get('cn') or '', 'v': b.get('valor') or b.get('base') or 0,
                                              'estado': b.get('estado') or 'suelto', 'motivo': b.get('motivo') or ''}
                                             for b in a.get('buscados') or []]}


def columnas_mw(n):
    """🖥️ Cuántos afiches por fila: en dos filas, y nunca menos de 6 (con pocos, una sola fila de afiches grandes)."""
    return max(6, -(-n // 2))


def html_mw(d):
    """🖥️ Horizontal: el vencimiento en la cabecera y los afiches en dos filas de lado a lado."""
    cols = columnas_mw(len(d['b']))
    css = """
.cab h1{color:#F5C542}
.vence{flex:none;background:#F5C542;color:#030304;padding:14px 24px;text-align:right;line-height:1.15}
.vence b{display:block;font-size:40px;letter-spacing:.06em}
.vence span{display:block;font-size:30px;letter-spacing:.08em}
.grid{flex:1;display:grid;grid-template-columns:repeat(%d,minmax(0,1fr));align-content:center;gap:18px 18px}
.af{background:#F2E6C9;color:#1C140A;padding:12px 12px 14px;display:flex;flex-direction:column;gap:7px;position:relative;
  border:3px solid #1C140A;box-shadow:6px 6px 0 #F5C542;min-width:0}
.af .t{font-family:'Barlow Condensed';font-weight:700;font-size:22px;letter-spacing:.14em;text-align:center}
.af img{width:100%%;aspect-ratio:1;object-fit:cover;filter:grayscale(.25) contrast(1.05);border:2px solid #1C140A;background:#d8ccb0}
.af b{font-weight:900;font-size:var(--fs,30px);line-height:34px;height:34px;text-transform:uppercase;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.af .cn{font-family:'Barlow Condensed';font-weight:700;font-size:23px;text-align:center;color:#6B5A3A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.af .v{font-family:'Barlow Condensed';font-weight:700;font-size:34px;text-align:center;background:#1C140A;color:#F5C542;padding:2px 0}
.af.cazado img{filter:grayscale(1) brightness(.7)}
.af .sello{position:absolute;top:30%%;left:50%%;transform:translateX(-50%%) rotate(-12deg);font-family:'Barlow Condensed';
  font-weight:700;font-size:38px;letter-spacing:.08em;color:#E41373;border:5px solid #E41373;padding:2px 12px;background:rgba(242,230,201,.88)}
""" % cols
    sueltos = sum(1 for b in d['b'] if b['estado'] not in ('cazado', 'escondio'))
    tope = max([b['v'] for b in d['b']] or [0])
    vence = ('<div class="et vence"><b>VENCE EL %s</b><span>%d %s · COBRAS HASTA %s PTS</span></div>'
             % (_e(_cuando(d['fin']).upper()) if d['fin'] else '—', sueltos, 'SIGUE SUELTO' if sueltos == 1 else 'SIGUEN SUELTOS',
                _num(tope))) if d['b'] else ''
    cuerpo = '<div class="grid">'
    for b in d['b']:
        caz = b['estado'] == 'cazado'
        # el nombre se achica según cuántas letras tiene (el afiche es angosto: «MAYEUTYK» no entraba a 30 px)
        fs = '' if len(b['n']) <= 7 or cols <= 6 else ' style="--fs:%dpx"' % (25 if len(b['n']) <= 9 else 21)
        cuerpo += ('<div class="af%s"><span class="t">SE BUSCA</span><img src="%s" alt=""><b%s>%s</b><span class="cn">%s</span>'
                   '<span class="v">%s PTS</span>%s</div>' % (' cazado' if caz else '', _cara(b['n']), fs, _e(b['n']), _e(b['cn']),
                                                           _num(b['v']), '<span class="sello">CAZADO</span>' if caz else ''))
    cuerpo += '</div>'
    if not d['b']:
        cuerpo = '<p class="et" style="font-size:44px;color:#C4C4BE;padding:40px 0">Esta semana todavía no hay buscados.</p>'
    return _pagina(cuerpo, 'SE BUSCA', 'Most Wanted · Liga Global', css, vence)


# ── 📅 la semana ───────────────────────────────────────────────────────────────────────────────────────────────────
def datos_semana():
    m = _json('datos', 'multiplicadores.json') or {}
    ahora = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    sem = next((s for s in reversed(m.get('semanas') or []) if s.get('inicio', '') <= ahora < s.get('fin', '')), None) or \
        ((m.get('semanas') or [{}])[-1])
    mi = _json('datos', 'misiones.json') or {}
    lista = ((mi.get('semanas') or {}).get(mi.get('sem') or '') or {}).get('lista') or []
    sv = {k: v for k, v in (sem.get('sv') or {}).items() if k not in FUERA}
    gu = [p for p in ((sem.get('guerra') or {}).get('pares') or []) if not (set(p) & FUERA)]
    dor = sem.get('dorado') or {}
    return {'fin': sem.get('fin') or '', 'sv': sorted(sv.items(), key=lambda kv: -kv[1]),
            'dorado': dor if dor.get('sv') and dor['sv'] not in FUERA else {}, 'guerra': gu,
            'misiones': [{'t': x[1], 'nivel': x[2], 'pts': x[4]} for x in lista], 'bono': mi.get('bono') or 0}


def columnas_mult(n):
    """🖥️ Cuántos multiplicadores por fila: 4 (las 16 de hoy en 4×4) y 5 si pasan de 16, para que sigan en cuatro filas."""
    return 4 if n <= 16 else 5


def _mult(x):
    return str(x).rstrip('0').rstrip('.').replace('.', ',')


def html_semana(d):
    """🖥️ Horizontal (Dlx, 28/11/2026): a la izquierda las Misiones y el evento dorado, a la derecha los multiplicadores en
    una grilla de 4×4 y la guerra de servidores debajo. Todo lo de antes, sin perder nada."""
    cols = columnas_mult(len(d['sv']))
    css = """
.cuerpo{flex-direction:row;gap:56px}
.col{display:flex;flex-direction:column;min-width:0;min-height:0}
.izq{flex:0 0 700px}
.der{flex:1}
h2{font-family:'Barlow Condensed';font-weight:700;font-size:30px;letter-spacing:.12em;text-transform:uppercase;color:#C4C4BE;margin:0 0 14px;white-space:nowrap}
.mult{flex:1;display:grid;grid-template-columns:repeat(%d,minmax(0,1fr));grid-auto-rows:minmax(0,1fr);gap:14px}
.m{border:3px solid #26262B;padding:8px 12px;display:flex;align-items:center;gap:12px;min-height:0;overflow:hidden}
.m img{width:68px;height:68px;border-radius:50%%;object-fit:cover;background:#1A1A1F;flex:none}
.m div{min-width:0}
.m b{display:block;font-weight:900;font-size:58px;line-height:.95;white-space:nowrap;letter-spacing:-.01em}
.m b small{font-size:.6em;margin-right:2px;vertical-align:.12em}
.m b.largo{font-size:46px}
.m span{display:block;font-family:'Barlow Condensed';font-weight:700;font-size:28px;letter-spacing:.08em}
.m.alto{border-color:#29B298}.m.alto b{color:#29B298}
.m.bajo b{color:#C4C4BE}
.dor{display:flex;align-items:center;gap:18px;background:#F5C542;color:#030304;padding:12px 20px;margin-top:16px}
.dor img{width:76px;height:76px;border-radius:50%%;flex:none}
.dor div{flex:1;min-width:0}
.dor b{display:block;font-weight:900;font-size:40px;line-height:1;text-transform:uppercase}
.dor span{font-family:'Barlow Condensed';font-weight:700;font-size:26px;line-height:1.1;display:block;margin-top:4px}
.dor em{font-style:normal;font-weight:900;font-size:76px;line-height:1;flex:none;color:#E41373}
.mis{flex:1;display:grid;grid-auto-rows:minmax(0,1fr);gap:12px;min-height:0}
.mi{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;background:#F6F6F6;color:#030304;padding:10px 22px;min-height:0}
.mi b{display:block;font-weight:900;font-size:33px;line-height:1.08}
.mi .p{font-family:'Barlow Condensed';font-weight:700;font-size:46px;line-height:1;color:#E41373;text-align:right}
.mi small{display:block;font-family:'Barlow Condensed';font-weight:700;font-size:22px;letter-spacing:.1em;color:#1F7A68;text-transform:uppercase}
.bono{font-family:'Barlow Condensed';font-weight:700;font-size:28px;color:#C4C4BE;margin-top:10px}
.gue{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.g{display:flex;align-items:center;justify-content:center;gap:8px;border:3px solid #26262B;padding:6px 8px;font-family:'Barlow Condensed';
  font-weight:700;font-size:26px;white-space:nowrap;min-width:0}
.g img{width:44px;height:44px;border-radius:50%%;flex:none}
.g i{font-style:normal;color:#E41373;font-size:22px}
.vacio{font-family:'Barlow Condensed';font-weight:700;font-size:32px;color:#C4C4BE}
""" % cols
    NIVEL = {'facil': 'fácil', 'media': 'media', 'dificil': 'difícil', 'caza': 'caza'}
    # ── la izquierda: las Misiones y el evento dorado
    izq = ''
    if d['misiones']:
        izq += '<h2>Las Misiones · suman a tu Temporada</h2><div class="mis">'
        for x in d['misiones']:
            # el nivel va debajo de los puntos y no arriba del texto: así cada misión entra en dos líneas
            izq += '<div class="mi"><b>%s</b><span class="p">+%s<small>%s</small></span></div>' % (
                _e(x['t']), _num(x['pts']), _e(NIVEL.get(x['nivel'], x['nivel'])))
        izq += '</div>'
        if d['bono']:
            izq += '<p class="bono">LAS DE LA SEMANA JUNTAS: +%s DE BONO</p>' % _num(d['bono'])
    else:
        izq += '<h2>Las Misiones</h2><p class="vacio" style="flex:1">Las de esta semana salen el lunes a las 11 AM ET.</p>'
    if d['dorado']:
        izq += ('<div class="dor"><img src="%s" alt=""><div><b>Evento dorado</b><span>El primer evento de %s desde el %s'
                ' cuenta triple</span></div><em>×3</em></div>' % (_logo(d['dorado']['sv']), _e(d['dorado']['sv']),
                                                       _e(_cuando(d['dorado'].get('desde')))))
    # ── la derecha: los multiplicadores y la guerra
    der = '<h2>Multiplicadores · cada servidor suma así esta semana</h2><div class="mult">'
    for sv, x in d['sv']:
        cls = 'alto' if x >= 2 else 'bajo' if x < 1 else ''
        # ⚠️ «×2,25» no entra al tamaño de «×3» (medido: se salía de su casilla): las de 4 letras, más chicas
        der += '<div class="m %s"><img src="%s" alt=""><div><b%s><small>×</small>%s</b><span>%s</span></div></div>' % (
            cls, _logo(sv), ' class="largo"' if len(_mult(x)) >= 4 else '', _mult(x), _e(sv))
    der += '</div>'
    if d['guerra']:
        der += '<h2 style="margin-top:20px">Guerra de servidores · gana el que más suma por persona</h2><div class="gue">'
        for a, b in d['guerra']:
            der += '<div class="g"><img src="%s" alt="">%s <i>VS</i> %s<img src="%s" alt=""></div>' % (_logo(a), _e(a), _e(b), _logo(b))
        der += '</div>'
    cuerpo = '<div class="col izq">%s</div><div class="col der">%s</div>' % (izq, der)
    return _pagina(cuerpo, 'ESTA SEMANA EN LA LIGA', 'Hasta el %s' % _cuando(d['fin']) if d['fin'] else 'Liga Global', css)


# ── 🪧 los carteles de cada canal: qué es y qué hacer, de un vistazo (Dlx, 28/11/2026) ─────────────────────────────────
# 🔑 Después del orden del 27/11 varios canales de DRA no decían para qué eran. Cada uno lleva UN cartel: la imagen con
# el estilo del banner de Dlx (`bot/paneles_img/verificate.png`, 28/11: obligatorio para las imágenes nuevas de DRA),
# una a tres líneas en el mensaje y botones a la página exacta. Mismo sistema que los paneles de datos: un mensaje que
# se EDITA, sólo si cambió (`firma`), nunca de 3 a 11 AM ET.
# 🎨 EL ESTILO, MEDIDO SOBRE EL BANNER (1920×1080): fondo #030304 (el mismo negro del círculo del logo, así el logo se
# recorta sin borde), «UNDER [dragón] LEGENDS» arriba en blanco, la palabra magenta con tres ecos teal en contorno
# hacia ARRIBA, la palabra grande teal con cuatro ecos magenta hacia ABAJO, la línea blanca entre chevrones dobles y
# las diagonales finas desde las esquinas de abajo. Sin degradés. La letra del banner no está en el repo: la más
# parecida es Archivo Black en su ancho máximo (125 %), la variable de la página (`bot/paginas/inicio/f/`).
# ⚠️ CADA PALABRA SE ACHICA HASTA ENTRAR (`ENCAJAR`, al sacar la foto): el HTML no lleva scripts y «PUBLICACIONES» no
# entra al tamaño de «TIENDA». Eso pasa en el navegador, así que la firma sigue siendo la del HTML.
# ⚠️ LOS CANALES SE BUSCAN POR NOMBRE, no por id (`canal_de()`: NFKD, sólo letras y números, como las otras herramientas
# de DRA): el orden del 27/11 borró `esta-semana` y el panel de la semana se quedó mandando a un canal muerto.
FUENTE_CARTEL = os.path.join(BASE, 'bot', 'paginas', 'inicio', 'f', 'archivo-latin-wdth-normal.woff2')
LOGO_CARTEL = os.path.join(BASE, 'bot', 'paginas', 'ul.png')
NEGRO, BLANCO = '#030304', '#EFEFEF'
#: lo que va en el mensaje puede nombrar canales: `{#verificateaqui}` → `<#id>` al mandarlo (`menciones()`)
CANALES_TEXTO = ('verificateaqui', 'eventonuevos', 'eventoshoy', 'tutarjeta')
#: 🎫 los botones que ACTÚAN en Discord (`'cid:<custom_id>'`): sólo los que el Worker sabe contestar. El Pase, en
#: `bot/pase_dc.js` (`ACCIONES`, el mismo juego: `bot/pase_dc_prueba.mjs` revisa que coincidan)
#: 🛍️🃏 y los del buzón que dan algo (`bzn:vit`, `bzn:card`: `ACCIONES` de bot/buzon_botones.js), en la Tienda y Tu tarjeta
ACCIONES = ('pse:pase', 'pse:tareas', 'pse:track', 'bzn:vit', 'bzn:card')


def _fuente_cartel():
    try:
        b = base64.b64encode(open(FUENTE_CARTEL, 'rb').read()).decode()
        return ("@font-face{font-family:'UL Cartel';font-weight:100 900;font-stretch:62%% 125%%;"
                "src:url(data:font/woff2;base64,%s) format('woff2')}" % b)
    except OSError:
        return _fuentes()                                # sin la variable, Archivo de embed.css (más angosta)


def _logo_cartel():
    try:
        return 'data:image/png;base64,' + base64.b64encode(open(LOGO_CARTEL, 'rb').read()).decode()
    except OSError:
        return ''


CSS_CARTEL = """
*{box-sizing:border-box;margin:0;padding:0}
body{background:%(n)s}
#c{position:relative;width:1920px;height:1080px;overflow:hidden;background:%(n)s;color:%(b)s;
  font-family:'UL Cartel','Archivo',sans-serif;font-weight:900;font-stretch:125%%;text-transform:uppercase}
.rayas{position:absolute;inset:0;width:1920px;height:1080px}
.marca{position:absolute;left:0;right:0;top:118px;transform:translateY(-50%%);display:flex;justify-content:center;
  align-items:center;gap:30px;font-size:62px;letter-spacing:.01em;line-height:1}
.marca img{width:150px;height:150px;clip-path:circle(45%%)}
.g{position:absolute;left:0;right:0;display:flex;justify-content:center;line-height:1;white-space:nowrap}
.g .eco{display:block;position:absolute;left:50%%;transform:translateX(-50%%)}
.g .solido{display:block;position:relative}
.arriba{top:352px;font-size:150px;color:%(m)s;transform:translateY(-50%%)}
.arriba .eco{color:transparent;-webkit-text-stroke:3px %(v)s}
.grande{top:540px;font-size:270px;color:%(v)s;transform:translateY(-50%%);z-index:2}
.grande .eco{color:transparent;-webkit-text-stroke:3px %(m)s}
.grande .solido,.arriba .solido{z-index:2}
.linea{top:856px;transform:translateY(-50%%);gap:44px;align-items:center;font-size:92px;color:%(b)s;z-index:3}
.linea .solido{position:relative}
.chev{position:relative;width:104px;height:104px;flex:none}
.chev i{position:absolute;left:0;width:104px;height:62px}
.chev i:first-child{top:0}.chev i:last-child{top:42px}
""" % {'n': NEGRO, 'b': BLANCO, 'm': MAGENTA, 'v': VERDE}


def _chevron(arriba, abajo):
    """Dos «v» apiladas, como las del banner: la de arriba de un color y la de abajo del otro."""
    def v(col):
        return ('<i><svg viewBox="0 0 104 62" width="104" height="62"><polyline points="8,8 52,50 96,8" fill="none" '
                'stroke="%s" stroke-width="20" stroke-linejoin="miter"/></svg></i>' % col)
    return '<span class="chev">%s%s</span>' % (v(arriba), v(abajo))


def _rayas():
    """Las diagonales finas desde las esquinas de abajo (medidas sobre el banner), y su espejo."""
    izq = [(VERDE, 0, 590, 380, 1080), (MAGENTA, 0, 730, 275, 1080), (MAGENTA, 0, 790, 690, 1080), (VERDE, 0, 880, 470, 1080)]
    ls = ''
    for col, x1, y1, x2, y2 in izq:
        ls += '<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="6"/>' % (x1, y1, x2, y2, col)
        ls += '<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="6"/>' % (1920 - x1, y1, 1920 - x2, y2, col)
    return '<svg class="rayas" viewBox="0 0 1920 1080">%s</svg>' % ls


def html_cartel(arriba, grande, linea):
    """El cartel de un canal con el estilo del banner: `arriba` en magenta con sus ecos, `grande` en teal con los suyos y
    `linea` en blanco entre chevrones. Cada grupo lleva `data-fit` (el ancho máximo): `ENCAJAR` lo achica al sacar la foto."""
    ecos_a = ''.join('<span class="eco" style="top:%.2fem;opacity:%.2f">%s</span>' % (-0.27 * i, 1 - 0.28 * (i - 1), _e(arriba))
                     for i in (3, 2, 1))
    ecos_g = ''.join('<span class="eco" style="top:%.2fem;opacity:%.2f">%s</span>' % (0.15 * i, 1 - 0.22 * (i - 1), _e(grande))
                     for i in (4, 3, 2, 1))
    logo = _logo_cartel()
    cuerpo = ('%s<div class="marca"><span>Under</span>%s<span>Legends</span></div>'
              '<div class="g arriba" data-fit="1480">%s<span class="solido">%s</span></div>'
              '<div class="g grande" data-fit="1640">%s<span class="solido">%s</span></div>'
              '<div class="g linea" data-fit="1320">%s<span class="solido">%s</span>%s</div>'
              % (_rayas(), ('<img src="%s" alt="">' % logo) if logo else '', ecos_a, _e(arriba), ecos_g, _e(grande),
                 _chevron(VERDE, MAGENTA), _e(linea), _chevron(MAGENTA, VERDE)))
    return ('<!doctype html><html><head><meta charset="utf-8"><style>%s%s</style></head><body><div id="c">%s</div>'
            '</body></html>') % (_fuente_cartel(), CSS_CARTEL, cuerpo)


#: hace entrar cada grupo `data-fit` en su ancho (lo corre `foto()`, no el HTML): primero lo ANGOSTA (del 125 % al 100 %,
#: el eje de ancho de la variable) y recién después lo achica. Sólo achicando, «PUBLICACIONES» quedaba a la mitad de alto
#: que «TIENDA» y el cartel se veía vacío entre la palabra y la línea
ENCAJAR = """() => { for (const g of document.querySelectorAll('[data-fit]')) {
  const max = +g.dataset.fit; let fs = parseFloat(getComputedStyle(g).fontSize); let st = 125;
  const ancho = () => { const h = [...g.children].filter((x) => !x.classList.contains('eco')).map((x) => x.getBoundingClientRect());
    return Math.max(...h.map((r) => r.right)) - Math.min(...h.map((r) => r.left)); };
  for (let i = 0; i < 25 && ancho() > max && st > 100; i++) { st -= 1; g.style.fontStretch = st + '%'; }
  for (let i = 0; i < 80 && ancho() > max && fs > 20; i++) { fs *= 0.97; g.style.fontSize = fs + 'px'; } } }"""

#: 🪧 los carteles: `(clave, canal, arriba, grande, línea, texto del mensaje, botones, título si el canal es un foro)`.
#: ⚠️ LO QUE DICEN TIENE QUE SER CIERTO HOY: cada uno se miró contra el código el 28/11/2026 (la vitrina rota cada día,
#: `vitrinaDelDia()` de bot/tienda.js; las tarjetas en dos pasos, `verificados.puede()`; 18 estilos, el 1.º lo eliges y el
#: 2.º y 3.º salen de los eventos de estilo de DRA, `estilos_juego.py`; el nivel 1 del Pase son 300 XP, `pase.umbrales()`).
#: Si cambia la regla, se cambia acá.
CARTELES = [
    ('guia', 'tutorialguia', '¿Recién llegas?', 'La Guía', 'Todo en una página',
     '**¿Recién llegas?** En la Guía están los puntos, los rangos, las tarjetas y los TAGs, explicados en una página.\n'
     'Ahí también tienes el tutorial completo de la página.',
     [('Abrir la Guía', WEB + '/guia'), ('Los eventos de hoy', WEB + '/eventos')], ''),
    ('empieza', 'empiezaaqui', 'Tus primeros pasos', 'Empieza aquí', 'Verifícate · juega · sube',
     '**1.** Verifícate en {#verificateaqui}: eliges tu país y tu AKA.\n'
     '**2.** Anótate a tu primer evento en {#eventonuevos}, sólo para los que empiezan.\n'
     '**3.** Mira qué se juega hoy en toda la Liga en {#eventoshoy}.',
     [('Entrar a la página', WEB), ('La Guía', WEB + '/guia'), ('Eventos de hoy', WEB + '/eventos')], ''),
    ('somos', 'quienessomos', 'Quiénes', 'Somos', 'La Liga Global de freestyle',
     '**Under Legends** arma la **Liga Global de Freestyle en Español**: los eventos de todos los servidores socios suman a '
     'un mismo ranking.\nDRA es la casa de la Liga: acá están los rankings, los eventos de hoy y tu tarjeta.',
     [('Conocer a los socios', WEB + '/socios'), ('Entrar a la página', WEB)], ''),
    ('tarjeta', 'tutarjeta', 'Consigue', 'Tu tarjeta', 'En dos pasos',
     '**1.** Verifícate en {#verificateaqui} y te llega la de **Servidor**.\n'
     '**2.** Llega al nivel 1 del Pase y sale la de **Temporada**. La Competitiva y la de País se ganan jugando.\n'
     'Escribe `/card` acá para mostrar las tuyas, o toca **Mi tarjeta** para verla sólo tú.',
     # 🃏 «Mi tarjeta» es el botón del buzón (`bzn:card`, bot/buzon_botones.js): la misma carta de `/card`, sólo para quien toca
     [('Mi tarjeta', 'cid:bzn:card', '🃏'), ('Ver las tarjetas', WEB + '/tarjetas'), ('Personalizar la mía', WEB + '/inventario')], ''),
    # 🎫 EL PASE SE MIRA ACÁ MISMO (28/11/2026, Dlx: «incluso la opción de ver en qué track estás ahora y recompensas
    # cercanas, y ver tus misiones de ahí mismo»): tres botones que contesta el Worker sólo a quien toca (bot/pase_dc.js)
    ('pase', 'paserapero', 'Sube de nivel', 'El Pase', 'Tareas · XP · premios',
     'Cumple **Tareas** diarias, semanales y de temporada, gana XP y sube de nivel.\n'
     'Con el **nivel 1** desbloqueas tu tarjeta de Temporada. Es para los Miembros de DRA: verifícate primero en {#verificateaqui}.\n'
     'Toca un botón y te contesto sólo a ti: **tu nivel**, **tus Tareas** y **dónde estás en el track**.',
     [('Mi Pase', 'cid:pse:pase', '🎫'), ('Mis Tareas', 'cid:pse:tareas', '🎯'), ('El track', 'cid:pse:track', '🗺️'),
      ('Abrir mi Pase', WEB + '/pase')], ''),
    ('tienda', 'tienda', 'Gasta tus Puntos', 'Tienda', 'La vitrina cambia cada día',
     'Marcos, fondos, TAGs y más para tu carta y tu perfil, con tus **Puntos de Tienda**.\n'
     'La vitrina cambia cada día y sus primeras piezas llegan tapadas: destápalas gratis, puede salir algo sólo para ti.\n'
     'Toca **La vitrina de hoy** para ver acá algunas piezas con su precio.',
     # 🛍️ «La vitrina de hoy» es el botón del buzón (`bzn:vit`, bot/buzon_botones.js): cuatro piezas de verdad, sólo a quien toca
     [('La vitrina de hoy', 'cid:bzn:vit', '🛍️'), ('Ir a la Tienda', WEB + '/tienda'), ('Mi inventario', WEB + '/inventario')], ''),
    ('estilos', 'objetivos', '¿Cómo rapeas?', 'Estilos', 'De juego · elige el tuyo',
     'Hay **18 estilos de juego**. El primero lo eliges tú en el Inventario (después lo puedes cambiar una vez por temporada).\n'
     'El 2.º y el 3.º se ganan en los **eventos de estilo de DRA**, y van en tu tarjeta Competitiva.',
     [('Elegir mi estilo', WEB + '/inventario/competitivo/juego'), ('Los eventos', WEB + '/eventos')], ''),
    ('publicaciones', 'publicaciones', 'Lo que pasa en la Liga', 'Publicaciones', 'Campeones · rachas · récords',
     'Campeones, debuts, rachas y crews que suben: el muro de todos los servidores de la Liga, al día en la página.',
     [('Ver Publicaciones', WEB + '/publicaciones')], ''),
    ('rimas', 'mejoresrimas', 'Las mejores', 'Rimas', 'Los videos de cada evento',
     'Los mejores momentos de las batallas de cada evento, en video y con quién es quién.',
     [('Ver los videos', WEB + '/reels')], ''),
    ('ligas', 'ligas', 'Cómo funcionan las', 'Ligas', 'Fechas · tablas · campeones',
     'Las ligas de los servidores socios: sus fechas, su tabla y sus campeones, al día en la página.\n'
     'Cada publicación de este foro es una liga, para seguirla y comentarla.',
     [('Ver las ligas', WEB + '/ligas')], '📌 Cómo funcionan las ligas'),
]


# ── los paneles: qué canal, qué imagen y qué botones ────────────────────────────────────────────────────────────────
def paneles():
    """`[(clave, canal, html, botones, texto, foro)]`. Los botones son `(texto, url)`: links a la página. `canal` es una
    clave de `datos/dra_hub.json`, un id, o `sfx:<nombre>` (se busca por nombre, `canal_de()`). `texto` va en el
    mensaje (puede nombrar canales, `menciones()`); `foro`, el título de la publicación si el canal es un foro."""
    return [
        ('temporada', 'ranking', html_temporada(datos_temporada()),
         [('Ver el ranking completo', WEB + '/ranking'), ('Competitivo', WEB + '/ranking/competitivo'), ('Duelos', WEB + '/ranking/duelos')],
         '', ''),
        ('mw', '1500262299112439839', html_mw(datos_mw()),
         [('Ver Se busca', WEB + '/ranking/mw'), ('Ponerle precio a una cabeza', WEB + '/tienda')], '', ''),
        # 📅 `esta-semana` ya no existe (el orden del 27/11 la juntó con eventos-hoy): la semana va ahí, un mensaje editado
        ('semana', 'sfx:eventoshoy', html_semana(datos_semana()),
         [('Las Misiones', WEB + '/ranking/misiones'), ('Votar el ×2 de la semana que viene', WEB), ('Los eventos', WEB + '/eventos')],
         '', ''),
    ] + [(k, 'sfx:' + canal, html_cartel(a, g, ln), bot, tx, foro) for k, canal, a, g, ln, tx, bot, foro in CARTELES]


def _n(s):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFKD', str(s or '')).lower() if c.isalnum())


def canal_de(canales, sfx):
    """El canal de DRA que se llama `sfx` (NFKD, sólo letras y números), fuera del ARCHIVO. Primero el nombre exacto
    —«objetivos» es 【🎭】objetivos y no ╏👑╏ul-objetivos—; si no hay, el único que termina así. `None` si no está o
    si hay dos. Pura: `canales` es lo que da `GET /guilds/{id}/channels`."""
    cats = {c['id']: _n(c.get('name')) for c in canales if c.get('type') == 4}
    vivos = [c for c in canales if c.get('type') in (0, 5, 15) and 'archivo' not in cats.get(c.get('parent_id'), '')]
    exactos = [c for c in vivos if _n(c.get('name')) == sfx]
    if len(exactos) == 1:
        return exactos[0]
    fin = [c for c in vivos if _n(c.get('name')).endswith(sfx)]
    return fin[0] if len(exactos) == 0 and len(fin) == 1 else None


def menciones(texto, canales=None):
    """`{#nombre}` → `<#id>` con los canales de DRA; sin ellos (la vista previa), `#nombre`."""
    for k in CANALES_TEXTO:
        c = canal_de(canales, k) if canales else None
        texto = texto.replace('{#%s}' % k, ('<#%s>' % c['id']) if c else '#' + k)
    return texto


def foto(htm, ruta):
    """El PNG del `#c` de ese HTML, entero, con la hora de ahora en «Actualizado». El tamaño sale del `#c` (1920×1080 los
    paneles de datos y los carteles desde el 28/11/2026; más alto si algo no entró), y los grupos `data-fit` se achican
    hasta entrar (`ENCAJAR`)."""
    htm = htm.replace(CUANDO, _e(_cuando(None)))
    import navegador
    navegador.hace_falta()
    from playwright.sync_api import sync_playwright
    # ⚠️ SE MIDE Y SE RECORTA, NO SE LE PIDE AL ELEMENTO (13/10/2026). `locator.screenshot()` espera a que el elemento
    # «se quede quieto», y con un panel más alto que la ventana se colgó dos veces esperando —dejando el navegador
    # abierto—. Ahora: la ventana del alto del panel y una foto de ese recorte, con tope de tiempo en cada paso
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox'])
        try:
            pg = b.new_page(viewport={'width': ANCHO_PANEL, 'height': ALTO_PANEL}, device_scale_factor=1)
            pg.set_default_timeout(60000)
            pg.set_content(htm, wait_until='load', timeout=60000)
            pg.evaluate('() => document.fonts.ready.then(() => true)')
            pg.evaluate(ENCAJAR)
            pg.wait_for_timeout(500)
            ancho, alto = pg.evaluate("() => { const r = document.querySelector('#c').getBoundingClientRect();"
                                      " return [Math.ceil(r.width), Math.ceil(r.height)]; }")
            pg.set_viewport_size({'width': int(ancho), 'height': max(400, int(alto))})
            pg.wait_for_timeout(300)
            pg.screenshot(path=ruta, clip={'x': 0, 'y': 0, 'width': int(ancho), 'height': int(alto)}, timeout=60000)
        finally:
            b.close()
    return ruta


def tamano_png(ruta):
    """`(ancho, alto)` de un PNG, leído de su cabecera (sin PIL)."""
    import struct
    with open(ruta, 'rb') as f:
        cab = f.read(24)
    return struct.unpack('>II', cab[16:24]) if cab[1:4] == b'PNG' else (0, 0)


def vista(carpeta):
    os.makedirs(carpeta, exist_ok=True)
    mal = 0
    for clave, canal, htm, botones, texto, foro in paneles():
        r = foto(htm, os.path.join(carpeta, 'panel_%s.png' % clave))
        print('  %-13s %s  · canal: %s%s' % (clave, r, canal, ' (foro: «%s»)' % foro if foro else ''))
        # 🖥️ medido, no mirado: los paneles son 16:9; si algo no entró, el panel se estiró y se dice acá
        tam = tamano_png(r)
        if tam != (ANCHO_PANEL, ALTO_PANEL):
            mal += 1
            print('                🔴 salió de %d×%d y no de %d×%d: algo no entra' % (tam + (ANCHO_PANEL, ALTO_PANEL)))
        if texto:
            print('                texto: ' + menciones(texto).replace('\n', '\n                       '))
        print('                botones: %s' % ' | '.join('%s → %s' % (b[0], b[1]) for b in botones))
    return 1 if mal else 0


def madrugada():
    h = _et().hour
    return 3 <= h < 11


#: 🖼️ cómo sale la imagen. Dlx, 15/10/2026: *«quitar las imágenes del embed de los mensajes de DRA, esos del ranking»*:
#: como el vs (2.94), la imagen va como ADJUNTO y no adentro de un embed —el embed la mete en su tarjeta, con el borde de
#: color y márgenes, y se ve más chica—. Entra a la firma: cambiarla vuelve a mandar los tres paneles una vez
FORMA = 'adjunto'


def es_accion(b):
    """¿El botón actúa en Discord (`'cid:…'`) en vez de llevar a la página?"""
    return str(b[1]).startswith('cid:')


def boton_dc(b):
    """Un botón de `paneles()` como componente de Discord: `(texto, url)` es un link; `(texto, 'cid:<id>', emoji)`, un botón
    gris que contesta el Worker. ⚠️ Grises a propósito: en un panel nadie «tiene que» tocar uno más que otro."""
    t, dest = b[0], b[1]
    emo = b[2] if len(b) > 2 and b[2] else ''
    if es_accion(b):
        c = {'type': 2, 'style': 2, 'label': t[:80], 'custom_id': dest[4:][:100]}
    else:
        c = {'type': 2, 'style': 5, 'label': t[:80], 'url': dest}
    if emo:
        c['emoji'] = {'name': emo}
    return c


def cuerpo_panel(clave, botones, texto=''):
    """El mensaje de un panel, sin la imagen (va como adjunto, `files[0]`): su texto (los carteles; los de datos, ninguno),
    SIN EMBED y con sus botones. `embeds: []` saca el embed de un mensaje que ya lo tenía, y `attachments` deja sólo la
    imagen nueva."""
    return {'content': texto or '', 'embeds': [], 'attachments': [{'id': 0, 'filename': clave + '.png'}],
            'allowed_mentions': {'parse': []},
            'components': [{'type': 1, 'components': [boton_dc(b) for b in botones[:5]]}]}


def firma_de(htm, texto='', botones=None):
    """La huella de lo que se ve: la forma, la imagen y el texto. ⚠️ Sin texto da lo mismo que antes del 28/11 (`FORMA`
    + HTML), así los tres paneles de datos no se vuelven a mandar sólo porque llegaron los carteles. Y los botones que
    ACTÚAN (`es_accion()`) también entran: sumarle uno a un cartel lo tiene que editar. Los links no, como antes (si no,
    todos los paneles se volverían a mandar sólo por este cambio)."""
    extra = json.dumps([list(b) for b in botones or []], ensure_ascii=False) if any(es_accion(b) for b in botones or []) else ''
    return hashlib.sha256((FORMA + htm + (texto or '') + extra).encode('utf-8')).hexdigest()[:16]


#: los carteles NUEVOS salen la primera vez sólo con el sí de Dlx a la vista previa (`--aplicar --prender`), igual que los
#: paneles el 13/10: sin esto, el ciclo siguiente al push los mandaba solos. Una vez que tienen su mensaje, se editan solos
PIDEN_SI = {x[0] for x in CARTELES}


def aplicar():
    """Pone cada imagen en su canal, como adjunto: edita su mensaje si está, o manda uno. Sólo si cambió."""
    import requests
    import avisar as AV
    hub = _json('datos', 'dra_hub.json') or {}
    # 🔒 APAGADO HASTA QUE DLX DIGA QUE SÍ a la vista previa (13/10/2026: «te muestro cada panel antes de que salga»).
    # Sin esto, el ciclo de las 11:22 ponía el de Most Wanted —ese canal ya existía— antes de que nadie lo viera
    prender = '--prender' in sys.argv
    if not hub.get('paneles_prendidos') and not prender:
        print('  los paneles de DRA están apagados hasta que Dlx los apruebe (--aplicar --prender la primera vez)')
        return 0
    hub['paneles_prendidos'] = True
    estado = hub.setdefault('paneles', {})
    tok = AV._token()
    if not tok:
        print('Falta el token del bot.')
        return 1
    h = {'Authorization': 'Bot ' + tok, 'Content-Type': 'application/json'}
    hm = {'Authorization': h['Authorization']}
    api = 'https://discord.com/api/v10'
    # los canales de DRA, una vez por corrida: los `sfx:` y las menciones del texto se buscan por nombre
    try:
        rc = requests.get('%s/guilds/%s/channels' % (api, GUILD), headers=hm, timeout=30)
        canales = rc.json() if rc.status_code == 200 else []
    except (requests.RequestException, ValueError):
        canales = []
    if not canales:
        print('  ⚠️ no pude leer los canales de DRA: sólo los paneles con id fijo')
    import tempfile
    d = tempfile.mkdtemp()
    for clave, canal_k, htm, botones, texto, foro in paneles():
        tipo = 0
        if canal_k.startswith('sfx:'):
            c = canal_de(canales, canal_k[4:]) if canales else None
            canal, tipo = (c['id'], c.get('type') or 0) if c else ('', 0)
        else:
            canal = hub.get(canal_k) or (canal_k if canal_k.isdigit() else '')
        if not canal:
            print('  %-13s sin canal (%s): no se toca' % (clave, canal_k))
            continue
        antes = estado.get(clave) or {}
        if clave in PIDEN_SI and not antes.get('msg') and not prender:
            print('  %-13s nuevo: espera el sí de Dlx a la vista previa (--aplicar --prender)' % clave)
            continue
        texto = menciones(texto, canales)
        # ⚠️ CON LA FORMA EN LA FIRMA: los que salieron en un embed tienen que volver a mandarse como adjunto aunque la
        # imagen sea la misma (`FORMA`). Y con el canal: si el panel se mudó (la semana, 28/11), se manda en el nuevo
        firma = firma_de(htm, texto, botones)
        if antes.get('firma') == firma and antes.get('msg') and antes.get('canal') == canal:
            print('  %-13s igual: no se toca' % clave)
            continue
        ruta = foto(htm, os.path.join(d, clave + '.png'))
        cuerpo = cuerpo_panel(clave, botones, texto)

        def _con_imagen(metodo, url_api, payload):
            with open(ruta, 'rb') as fh:
                return metodo(url_api, headers=hm, data={'payload_json': json.dumps(payload)},
                              files={'files[0]': (clave + '.png', fh, 'image/png')}, timeout=60)
        r, hilo = None, ''
        # 🧵 EN UN FORO EL PANEL ES UNA PUBLICACIÓN: su primer mensaje tiene el mismo id que el hilo, y se edita adentro
        donde = (antes.get('hilo') or '') if tipo == 15 else canal
        if antes.get('msg') and antes.get('canal') == canal and donde:
            r = _con_imagen(requests.patch, '%s/channels/%s/messages/%s' % (api, donde, antes['msg']), cuerpo)
            if r.status_code == 404:
                r = None
            else:
                hilo = antes.get('hilo') or ''
        if r is None and tipo == 15:
            r = _con_imagen(requests.post, '%s/channels/%s/threads' % (api, canal), {'name': (foro or clave)[:100], 'message': cuerpo})
            if r.status_code in (200, 201):
                hilo = r.json().get('id') or ''
                # 📌 fijada arriba del foro (el flag PINNED de un hilo); si no se puede, queda publicada igual
                rp = requests.patch('%s/channels/%s' % (api, hilo), headers=h, json={'flags': 2}, timeout=30)
                if rp.status_code != 200:
                    print('  %-13s ⚠️ no la pude fijar: %s' % (clave, rp.status_code))
        elif r is None:
            r = _con_imagen(requests.post, '%s/channels/%s/messages' % (api, canal), cuerpo)
        if r.status_code in (200, 201):
            j = r.json()
            # crear un hilo de foro devuelve el HILO (con `message` adentro); editar o mandar, el mensaje
            msg = (j.get('message') or {}).get('id') or (j.get('id') if not hilo or j.get('id') != hilo else hilo) or antes.get('msg')
            estado[clave] = {'canal': canal, 'msg': msg, 'firma': firma, 't': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
            if hilo:
                estado[clave]['hilo'] = hilo
            print('  %-13s ✓ %s' % (clave, msg))
        else:
            print('  %-13s ✗ %s %s' % (clave, r.status_code, r.text[:160]))
        time.sleep(0.5)
    with io.open(HUB, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(hub, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')
    return 0


def re_vos(t):
    """¿Hay voseo en `t`? Las formas que ya se colaron otras veces (tenés, podés, verificate, anotate…)."""
    import re
    return bool(re.search(r"\b(tenés|podés|querés|sabés|entrá|mirá|anotate|verificate|jugá|elegí|sumate|vos)\b", str(t or ""), re.I))


def _self_check():
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('ok' if c else '🔴', que))

    print('\n  paneles_dra.py — self-check, sin red ni navegador\n')
    ps = paneles()
    datos_p = [p for p in ps if p[0] in ('temporada', 'mw', 'semana')]
    carteles = [p for p in ps if p[0] in PIDEN_SI]
    ok([p[0] for p in datos_p] == ['temporada', 'mw', 'semana'], 'los tres paneles de datos')
    ok(len(carteles) == len(CARTELES) == 10 and len({p[0] for p in ps}) == len(ps), 'los diez carteles, cada uno con su clave')
    ok(all(1 <= len(p[3]) <= 5 and all(b[1].startswith('https://underlegends.pages.dev/') or (es_accion(b) and b[1][4:] in ACCIONES)
                                       for b in p[3]) for p in ps),
       'cada uno con 1 a 5 botones: links a la página o acciones que el Worker conoce (ACCIONES)')
    ok(all(len(b[0]) <= 80 for p in ps for b in p[3]), 'cada botón entra en las 80 letras de Discord')
    ok(all(not es_accion(p[3][-1]) for p in ps), 'el link a la página va siempre último')
    pb = dict((p[0], p[3]) for p in ps)['pase']
    ok([b[1] for b in pb[:3]] == ['cid:pse:pase', 'cid:pse:tareas', 'cid:pse:track'] and pb[3][1] == WEB + '/pase',
       'el Pase: Mi Pase, Mis Tareas y El track, y el link a la página al final (Dlx, 28/11: «más interactuable»)')
    dp = dict((p[0], p[3]) for p in ps)
    ok(dp['tienda'][0][1] == 'cid:bzn:vit' and dp['tarjeta'][0][1] == 'cid:bzn:card',
       'la Tienda lleva «La vitrina de hoy» y Tu tarjeta «Mi tarjeta» (los botones del buzón, sin copiar lo que hacen)')
    cp = cuerpo_panel('pase', pb)['components'][0]['components']
    ok([c['style'] for c in cp] == [2, 2, 2, 5] and cp[0]['custom_id'] == 'pse:pase' and cp[0]['emoji'] == {'name': '🎫'}
       and 'url' not in cp[0] and 'custom_id' not in cp[3], 'los botones que actúan van grises y con su custom_id; el link, link')
    ok(firma_de('<x>', 't', [('a', WEB)]) == firma_de('<x>', 't'), 'un panel sólo con links tiene la firma de antes')
    ok(firma_de('<x>', 't', pb) != firma_de('<x>', 't', [pb[3]]), 'sumarle un botón que actúa cambia la firma: el cartel se edita')
    # 🖥️ los paneles de datos son horizontales: 16:9 y con las columnas según cuántos hay
    ok((ANCHO_PANEL, ALTO_PANEL) == (1920, 1080) and 'width:1920px' in CSS and 'min-height:1080px' in CSS,
       'los paneles de datos son de 1920×1080 (Dlx, 28/11: «¿por qué vertical?»)')
    ok(columnas_mult(16) == 4 and columnas_mult(17) == 5 and columnas_mw(15) == 8 and columnas_mw(4) == 6,
       'la grilla de multiplicadores en 4×4 (5 si pasan de 16) y los afiches en dos filas')
    ok(tamano_png(LOGO_CARTEL) != (0, 0), 'el tamaño de un PNG se lee de su cabecera')
    s = datos_semana()
    ok('FVS' not in FUERA, 'FVS sale en el panel de la semana (Dlx, 13/10: «FVS debería estar en esto»)')
    ok(_num(273733) == '274K' and _num(9500) == '9.500' and _num(None) == '0', 'los números como en la página')
    ok('<script' not in ''.join(p[2] for p in ps).lower(), 'el HTML no lleva scripts')
    ok(all(CUANDO in p[2] for p in datos_p), 'la hora va aparte: la firma no cambia sólo porque pasó el tiempo')
    ok(all(CUANDO not in p[2] for p in carteles), 'los carteles no llevan hora: su firma cambia sólo si cambia el cartel')
    c = cuerpo_panel('temporada', ps[0][3])
    ok(c['embeds'] == [] and c['attachments'] == [{'id': 0, 'filename': 'temporada.png'}] and c['components'][0]['components']
       and c['content'] == '', 'la imagen va como adjunto y sin embed, con sus botones (Dlx, 15/10: «quitar las imágenes del embed»)')
    ok(firma_de('<x>') == hashlib.sha256((FORMA + '<x>').encode('utf-8')).hexdigest()[:16],
       'sin texto, la firma es la de antes: los paneles de datos no se vuelven a mandar por los carteles')
    ok(firma_de('<x>', 'a') != firma_de('<x>', 'b'), 'el texto del mensaje entra a la firma: cambiarlo edita el cartel')
    # 📅 la semana ya no va a `esta-semana` (no existe desde el 27/11) sino a eventos-hoy, buscada por nombre
    ok(dict((p[0], p[1]) for p in ps)['semana'] == 'sfx:eventoshoy', 'la semana va a eventos-hoy (esta-semana ya no existe)')
    # 🔎 la búsqueda por nombre, con los canales de DRA de hoy (nombres reales, ids inventados)
    cs = [{'id': '1', 'type': 4, 'name': '🎤 ╣ CYPHERS Y ENTRENAMIENTO ═'}, {'id': '2', 'type': 4, 'name': '👔 ╣ CENTRAL ═'},
          {'id': '3', 'type': 4, 'name': '📦 ╣ ARCHIVO ═'},
          {'id': '10', 'type': 0, 'name': '【🎭】objetivos', 'parent_id': '1'},
          {'id': '11', 'type': 15, 'name': '╏👑╏ul-objetivos', 'parent_id': '2'},
          {'id': '12', 'type': 0, 'name': '•「✅」verificate-aqui'}, {'id': '13', 'type': 0, 'name': 'verificate-aqui', 'parent_id': '3'},
          {'id': '14', 'type': 15, 'name': '〢🏟️〉ligas'}, {'id': '15', 'type': 0, 'name': '•「🙋」preséntate'},
          {'id': '16', 'type': 0, 'name': '🃏˚┊tu-tarjeta'}, {'id': '17', 'type': 5, 'name': '〢🔥〉eventos-hoy'},
          {'id': '18', 'type': 2, 'name': 'tienda'}, {'id': '19', 'type': 0, 'name': '🛍️˚┊tienda'}]
    ok((canal_de(cs, 'objetivos') or {}).get('id') == '10', '«objetivos» es 【🎭】objetivos y no ╏👑╏ul-objetivos (nombre exacto primero)')
    ok((canal_de(cs, 'verificateaqui') or {}).get('id') == '12', 'lo del ARCHIVO no cuenta')
    ok((canal_de(cs, 'presentate') or {}).get('id') == '15' and (canal_de(cs, 'tutarjeta') or {}).get('id') == '16',
       'NFKD: «preséntate» y «tu-tarjeta» se encuentran sin acento ni guion')
    ok((canal_de(cs, 'tienda') or {}).get('id') == '19' and canal_de(cs, 'noexiste') is None, 'un canal de voz no es un panel; sin canal, None')
    ok((canal_de(cs, 'ligas') or {}).get('type') == 15, 'las ligas son un foro: el cartel va como publicación fijada')
    ok(menciones('ve a {#verificateaqui}', cs) == 've a <#12>' and menciones('ve a {#verificateaqui}') == 've a #verificateaqui',
       'las menciones del texto: con los canales, <#id>; en la vista previa, #nombre')
    # los nombres de DRA el 28/11/2026 (GET, después del orden del 27/11): cada cartel tiene que dar con UNO solo
    hoy = ['【🎯】buscar-batalla', '【💿】pon-beats', '【🧠】entrenamientos', '【⚽】dinamicas-retos', '【🎭】objetivos',
           '✦🐣・evento-nuevos', '✦⚔️・elo-ranked-1v1', '✦⭐・competenciasᴹᴵˣ', '『🔴』eventos-grabados', '『🌟』publicaciones',
           '『🎬』mejores-rimas', '『💚』contenido-rap', '『🚀』promocionate', '•「✅」verificate-aqui', '〢📣〉liga-global',
           '〢🔥〉eventos-hoy', '〢🏆〉rankings', '〢💀〉most-wanted', '〢🎫〉pase-rapero', '〢🌎〉servidores-rap', '〢🏟️〉ligas',
           '💬˚┊conversacion', '🃏˚┊tu-tarjeta', '🛍️˚┊tienda', '💼˚┊postulaciones', '🎟️˚┊ticket-soporte', '💡˚┊dudas',
           '🛡️˚┊crews', '•「📮」empieza-aqui', '•「💙」quienes-somos', '•「🙋」preséntate', '•「🚪」recibidor',
           '•「🧭」tutorial-guia', '╏👑╏ul-objetivos', '╏🪽╏chat-staff', '╏📄╏registros']
    cs_hoy = [{'id': str(i), 'type': 0, 'name': nm} for i, nm in enumerate(hoy)]
    faltan = [x[1] for x in CARTELES if canal_de(cs_hoy, x[1]) is None] + \
        [k for k in CANALES_TEXTO if canal_de(cs_hoy, k) is None] + ([] if canal_de(cs_hoy, 'eventoshoy') else ['eventoshoy'])
    ok(not faltan, 'cada cartel, la semana y cada mención dan con un solo canal de DRA %s' % (faltan or ''))
    ok(all(not re_vos(x) for c0 in CARTELES for x in c0[2:6]), 'en tú, no en vos (Dlx, 20/10: «español latino»)')
    ok(all('{#' not in menciones(c0[5], cs + [{'id': '9' + k, 'type': 0, 'name': k} for k in CANALES_TEXTO]) for c0 in CARTELES),
       'cada {#canal} del texto es uno de CANALES_TEXTO')
    ok(os.path.exists(FUENTE_CARTEL) and os.path.exists(LOGO_CARTEL), 'la letra y el logo de los carteles están en el repo')
    h0 = html_cartel('a', 'b', 'c')
    ok(h0.count('data-fit') == 3 and 'UL Cartel' in h0 and 'gradient' not in CSS_CARTEL,
       'el cartel: tres grupos que se achican solos, con su letra y sin degradés (el estilo del banner de Dlx)')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    if '--vista' in sys.argv:
        i = sys.argv.index('--vista')
        carpeta = sys.argv[i + 1] if len(sys.argv) > i + 1 else os.path.join(BASE, 'salida', 'paneles')
        return vista(carpeta)
    if '--aplicar' in sys.argv:
        if madrugada():
            print('De 3 a 11 AM ET no se toca DRA (la madrugada).')
            return 1
        return aplicar()
    print(__doc__)
    return 0


if __name__ == '__main__':
    sys.exit(main())
