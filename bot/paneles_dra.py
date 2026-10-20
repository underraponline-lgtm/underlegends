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
⚠️ LOS BOTONES SON LINKS a la página: no hace falta que el Worker atienda nada.
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


CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0d}
#c{width:1080px;background:#0a0a0d;color:#F6F6F6;font-family:'Archivo',sans-serif;padding:56px 56px 0}
.et{font-family:'Barlow Condensed','Archivo',sans-serif;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.cab{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:40px}
.cab h1{font-weight:900;font-size:92px;line-height:.9;text-transform:uppercase;font-stretch:115%}
.cab .sub{font-size:26px;color:#C4C4BE;margin-bottom:10px}
.cab .ul{width:96px;height:96px}
.pie{display:flex;justify-content:space-between;align-items:center;margin:44px -56px 0;padding:22px 56px;background:#F6F6F6;color:#030304}
.pie b{font-weight:900;font-size:30px}
.pie span{font-size:24px}
.liga{height:12px;margin:0 -56px;background:linear-gradient(90deg,#29B298 50%,#E41373 50%)}
.fl{height:.8em;width:auto;vertical-align:.02em;margin-left:10px;border-radius:2px}
"""


def _pagina(cuerpo, titulo, sub, extra_css=''):
    ul = os.path.join(BASE, 'bot', 'paginas', 'ul.png')
    logo = ('data:image/png;base64,' + base64.b64encode(open(ul, 'rb').read()).decode()) if os.path.exists(ul) else ''
    return ('<!doctype html><html><head><meta charset="utf-8"><style>%s%s%s</style></head><body><div id="c">'
            '<div class="cab"><div><div class="et sub">%s</div><h1>%s</h1></div>%s</div>%s'
            '<div class="pie"><b>underlegends.pages.dev</b><span class="et">Actualizado %s</span></div><div class="liga"></div>'
            '</div></body></html>') % (_fuentes(), CSS, extra_css, _e(sub), titulo,
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
    css = """
.podio{display:grid;grid-template-columns:1fr 1.18fr 1fr;gap:24px;align-items:end;margin-bottom:34px}
.pc{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}
.pc img.carta{width:100%;height:auto;filter:drop-shadow(0 16px 26px rgba(0,0,0,.6))}
.pc .sin{width:100%;aspect-ratio:300/438;border:3px solid #3A3A3E;display:grid;place-items:center}
.pc .sin img{width:70%}
.pc b{font-weight:900;font-size:34px;text-transform:uppercase;font-stretch:110%;line-height:1}
.pc .et{font-size:24px;color:#C4C4BE}
.pc .pos{font-family:'Barlow Condensed';font-weight:700;font-size:30px;padding:4px 16px;background:#F5C542;color:#030304}
.pc.p1 .pos{background:#E41373;color:#F6F6F6}
.fila{display:grid;grid-template-columns:86px 76px minmax(0,1fr) auto;align-items:center;gap:20px;padding:16px 0;border-top:2px solid #26262B}
.fila .n{font-family:'Barlow Condensed';font-weight:700;font-size:44px;color:#C4C4BE}
.fila img.c{width:76px;height:76px;border-radius:50%;object-fit:cover;background:#1A1A1F}
.fila b{font-weight:900;font-size:38px;text-transform:uppercase;font-stretch:108%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fila .d{text-align:right;font-family:'Barlow Condensed';font-weight:700;font-size:30px;line-height:1.1}
.fila .d small{display:block;font-size:24px;color:#C4C4BE;font-weight:600}
"""
    if not filas:
        cuerpo = '<p class="et" style="font-size:34px;color:#C4C4BE;padding:40px 0">Todavía no hay nadie en la tabla.</p>'
        return _pagina(cuerpo, 'RANKING<br>DE TEMPORADA', 'Liga Global · T1', css)

    def podio(x, cls):
        if not x:
            return '<div></div>'
        from comun import sin_foto as SF
        vis = ('<img class="carta" src="%s" alt="">' % _e(x['carta'])) if x['carta'] else \
              '<div class="sin"><img src="%s" alt=""></div>' % SF.uri(x['n'])
        bf = _bandera(x['cc'])
        pos = '' if x['carta'] else '<span class="pos">#%d</span>' % x['pos']
        return ('<div class="pc %s">%s%s<b>%s%s</b><span class="et">OVR %s · %s pts</span></div>'
                % (cls, pos, vis, _e(x['n']), ('<img class="fl" src="%s" alt="">' % bf) if bf else '', x['ovr'], _num(x['pts'])))
    top = {x['pos']: x for x in filas[:3]}
    cuerpo = '<div class="podio">%s%s%s</div>' % (podio(top.get(2), 'p2'), podio(top.get(1), 'p1'), podio(top.get(3), 'p3'))
    for x in filas[3:]:
        bf = _bandera(x['cc'])
        cuerpo += ('<div class="fila"><span class="n">#%d</span><img class="c" src="%s" alt=""><b>%s%s</b>'
                   '<span class="d">OVR %s<small>%s pts · %d eventos</small></span></div>'
                   % (x['pos'], _cara(x['n']), _e(x['n']), ('<img class="fl" src="%s" alt="">' % bf) if bf else '',
                      x['ovr'], _num(x['pts']), x['ev']))
    return _pagina(cuerpo, 'RANKING<br>DE TEMPORADA', 'Liga Global · T1 · los 10 primeros', css)


# ── 💀 Most Wanted ──────────────────────────────────────────────────────────────────────────────────────────────────
def datos_mw():
    a = (_json('datos', 'mw.json') or {}).get('actual') or {}
    return {'fin': a.get('fin') or '', 'b': [{'n': _limpio(b['n']), 'cn': b.get('cn') or '', 'v': b.get('valor') or b.get('base') or 0,
                                              'estado': b.get('estado') or 'suelto', 'motivo': b.get('motivo') or ''}
                                             for b in a.get('buscados') or []]}


def html_mw(d):
    css = """
#c{background:#0a0a0d}
.cab h1{color:#F5C542}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.af{background:#F2E6C9;color:#1C140A;padding:14px 14px 16px;display:flex;flex-direction:column;gap:8px;position:relative;
  border:3px solid #1C140A;box-shadow:6px 6px 0 #F5C542}
.af .t{font-family:'Barlow Condensed';font-weight:700;font-size:22px;letter-spacing:.14em;text-align:center}
.af img{width:100%;aspect-ratio:1;object-fit:cover;filter:grayscale(.25) contrast(1.05);border:2px solid #1C140A;background:#d8ccb0}
.af b{font-weight:900;font-size:27px;line-height:1;text-transform:uppercase;text-align:center;overflow-wrap:anywhere}
.af .cn{font-family:'Barlow Condensed';font-weight:700;font-size:21px;text-align:center;color:#6B5A3A}
.af .v{font-family:'Barlow Condensed';font-weight:700;font-size:30px;text-align:center;background:#1C140A;color:#F5C542;padding:2px 0}
.af.cazado img{filter:grayscale(1) brightness(.7)}
.af .sello{position:absolute;top:96px;left:50%;transform:translateX(-50%) rotate(-12deg);font-family:'Barlow Condensed';
  font-weight:700;font-size:40px;letter-spacing:.08em;color:#E41373;border:5px solid #E41373;padding:2px 14px;background:rgba(242,230,201,.85)}
.vence{display:inline-block;margin-bottom:28px;font-size:28px;background:#F5C542;color:#030304;padding:6px 16px}
"""
    sueltos = sum(1 for b in d['b'] if b['estado'] not in ('cazado', 'escondio'))
    tope = max([b['v'] for b in d['b']] or [0])
    cuerpo = ('<div class="et vence">VENCE EL %s · %d %s · COBRAS HASTA %s PTS</div>'
              % (_e(_cuando(d['fin']).upper()) if d['fin'] else '—', sueltos, 'SIGUE SUELTO' if sueltos == 1 else 'SIGUEN SUELTOS', _num(tope)))
    cuerpo += '<div class="grid">'
    for b in d['b']:
        caz = b['estado'] == 'cazado'
        cuerpo += ('<div class="af%s"><span class="t">SE BUSCA</span><img src="%s" alt=""><b>%s</b><span class="cn">%s</span>'
                   '<span class="v">%s PTS</span>%s</div>' % (' cazado' if caz else '', _cara(b['n']), _e(b['n']), _e(b['cn']),
                                                           _num(b['v']), '<span class="sello">CAZADO</span>' if caz else ''))
    cuerpo += '</div>'
    if not d['b']:
        cuerpo = '<p class="et" style="font-size:34px;color:#C4C4BE;padding:40px 0">Esta semana todavía no hay buscados.</p>'
    return _pagina(cuerpo, 'SE BUSCA', 'Most Wanted · Liga Global', css)


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


def html_semana(d):
    css = """
.cab h1{font-size:84px}
h2{font-family:'Barlow Condensed';font-weight:700;font-size:30px;letter-spacing:.12em;text-transform:uppercase;color:#C4C4BE;margin:0 0 18px}
.mult{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:38px}
.m{border:3px solid #26262B;padding:16px;display:flex;flex-direction:column;align-items:center;gap:8px}
.m img{width:92px;height:92px;border-radius:50%;object-fit:cover;background:#1A1A1F}
.m b{font-weight:900;font-size:54px;line-height:1}
.m span{font-family:'Barlow Condensed';font-weight:700;font-size:24px;letter-spacing:.08em}
.m.alto{border-color:#29B298}.m.alto b{color:#29B298}
.m.bajo b{color:#C4C4BE}
.dor{display:flex;align-items:center;gap:20px;background:#F5C542;color:#030304;padding:18px 22px;margin-bottom:38px}
.dor img{width:80px;height:80px;border-radius:50%}
.dor b{font-weight:900;font-size:40px;text-transform:uppercase}
.dor span{font-family:'Barlow Condensed';font-weight:700;font-size:26px;display:block}
.mis{display:grid;gap:14px;margin-bottom:12px}
.mi{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;background:#F6F6F6;color:#030304;padding:18px 22px}
.mi b{font-weight:900;font-size:32px;line-height:1.1}
.mi small{display:block;font-family:'Barlow Condensed';font-weight:700;font-size:22px;letter-spacing:.1em;color:#1F7A68;text-transform:uppercase}
.mi .p{font-family:'Barlow Condensed';font-weight:700;font-size:34px;color:#E41373}
.bono{font-family:'Barlow Condensed';font-weight:700;font-size:26px;color:#C4C4BE;margin-top:6px}
.gue{display:flex;flex-wrap:wrap;gap:14px;margin-top:32px}
.g{display:flex;align-items:center;gap:10px;border:3px solid #26262B;padding:10px 16px;font-family:'Barlow Condensed';font-weight:700;font-size:26px}
.g img{width:48px;height:48px;border-radius:50%}
"""
    NIVEL = {'facil': 'fácil', 'media': 'media', 'dificil': 'difícil', 'caza': 'caza'}
    cuerpo = '<h2>Multiplicadores · cada servidor suma así esta semana</h2><div class="mult">'
    for sv, x in d['sv']:
        cls = 'alto' if x >= 2 else 'bajo' if x < 1 else ''
        cuerpo += '<div class="m %s"><img src="%s" alt=""><b>×%s</b><span>%s</span></div>' % (
            cls, _logo(sv), str(x).rstrip('0').rstrip('.').replace('.', ','), _e(sv))
    cuerpo += '</div>'
    if d['dorado']:
        cuerpo += ('<div class="dor"><img src="%s" alt=""><div><b>Evento dorado · vale ×3</b><span>El primer evento de %s desde el %s'
                   ' cuenta triple</span></div></div>' % (_logo(d['dorado']['sv']), _e(d['dorado']['sv']),
                                                          _e(_cuando(d['dorado'].get('desde')))))
    if d['misiones']:
        cuerpo += '<h2>Las Misiones · suman a tu Temporada</h2><div class="mis">'
        for x in d['misiones']:
            cuerpo += '<div class="mi"><div><small>%s</small><b>%s</b></div><span class="p">+%s</span></div>' % (
                _e(NIVEL.get(x['nivel'], x['nivel'])), _e(x['t']), _num(x['pts']))
        cuerpo += '</div>'
        if d['bono']:
            cuerpo += '<p class="bono">LAS DE LA SEMANA JUNTAS: +%s DE BONO</p>' % _num(d['bono'])
    if d['guerra']:
        cuerpo += '<h2 style="margin-top:34px">Guerra de servidores · gana el que más suma por persona</h2><div class="gue">'
        for a, b in d['guerra']:
            cuerpo += '<div class="g"><img src="%s" alt="">%s VS %s<img src="%s" alt=""></div>' % (_logo(a), _e(a), _e(b), _logo(b))
        cuerpo += '</div>'
    return _pagina(cuerpo, 'ESTA SEMANA<br>EN LA LIGA', 'Hasta el %s' % _cuando(d['fin']) if d['fin'] else 'Liga Global', css)


# ── los paneles: qué canal, qué imagen y qué botones ────────────────────────────────────────────────────────────────
def paneles():
    """`[(clave, canal_clave, html, botones)]`. Los botones son `(texto, url)`: links a la página."""
    return [
        ('temporada', 'ranking', html_temporada(datos_temporada()),
         [('Ver el ranking completo', WEB + '/ranking'), ('Competitivo', WEB + '/ranking/competitivo'), ('Duelos', WEB + '/ranking/duelos')]),
        ('mw', '1500262299112439839', html_mw(datos_mw()),
         [('Ver Se busca', WEB + '/ranking/mw'), ('Ponerle precio a una cabeza', WEB + '/tienda')]),
        ('semana', 'esta_semana', html_semana(datos_semana()),
         [('Las Misiones', WEB + '/ranking/misiones'), ('Votar el ×2 de la semana que viene', WEB), ('Los eventos', WEB + '/eventos')]),
    ]


def foto(htm, ruta):
    """El PNG del `#c` de ese HTML, entero, con la hora de ahora en «Actualizado»."""
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
            pg = b.new_page(viewport={'width': 1080, 'height': 1400}, device_scale_factor=1)
            pg.set_default_timeout(60000)
            pg.set_content(htm, wait_until='load', timeout=60000)
            pg.wait_for_timeout(500)
            alto = int(pg.evaluate("() => Math.ceil(document.querySelector('#c').getBoundingClientRect().height)"))
            pg.set_viewport_size({'width': 1080, 'height': max(400, alto)})
            pg.wait_for_timeout(300)
            pg.screenshot(path=ruta, clip={'x': 0, 'y': 0, 'width': 1080, 'height': alto}, timeout=60000)
        finally:
            b.close()
    return ruta


def vista(carpeta):
    os.makedirs(carpeta, exist_ok=True)
    for clave, _canal, htm, botones in paneles():
        r = foto(htm, os.path.join(carpeta, 'panel_%s.png' % clave))
        print('  %-10s %s  · botones: %s' % (clave, r, ' | '.join(t for t, _u in botones)))
    return 0


def madrugada():
    h = _et().hour
    return 3 <= h < 11


#: 🖼️ cómo sale la imagen. Dlx, 15/10/2026: *«quitar las imágenes del embed de los mensajes de DRA, esos del ranking»*:
#: como el vs (2.94), la imagen va como ADJUNTO y no adentro de un embed —el embed la mete en su tarjeta, con el borde de
#: color y márgenes, y se ve más chica—. Entra a la firma: cambiarla vuelve a mandar los tres paneles una vez
FORMA = 'adjunto'


def cuerpo_panel(clave, botones):
    """El mensaje de un panel, sin la imagen (va como adjunto, `files[0]`): sin texto, SIN EMBED y con sus botones.
    `embeds: []` saca el embed de un mensaje que ya lo tenía, y `attachments` deja sólo la imagen nueva."""
    return {'content': '', 'embeds': [], 'attachments': [{'id': 0, 'filename': clave + '.png'}],
            'allowed_mentions': {'parse': []},
            'components': [{'type': 1, 'components': [{'type': 2, 'style': 5, 'label': t[:80], 'url': u}
                                                      for t, u in botones[:5]]}]}


def aplicar():
    """Pone cada imagen en su canal, como adjunto: edita su mensaje si está, o manda uno. Sólo si cambió."""
    import requests
    import avisar as AV
    hub = _json('datos', 'dra_hub.json') or {}
    # 🔒 APAGADO HASTA QUE DLX DIGA QUE SÍ a la vista previa (13/10/2026: «te muestro cada panel antes de que salga»).
    # Sin esto, el ciclo de las 11:22 ponía el de Most Wanted —ese canal ya existía— antes de que nadie lo viera
    if not hub.get('paneles_prendidos') and '--prender' not in sys.argv:
        print('  los paneles de DRA están apagados hasta que Dlx los apruebe (--aplicar --prender la primera vez)')
        return 0
    hub['paneles_prendidos'] = True
    estado = hub.setdefault('paneles', {})
    tok = AV._token()
    if not tok:
        print('Falta el token del bot.')
        return 1
    h = {'Authorization': 'Bot ' + tok, 'Content-Type': 'application/json'}
    import tempfile
    d = tempfile.mkdtemp()
    for clave, canal_k, htm, botones in paneles():
        canal = hub.get(canal_k) or (canal_k if canal_k.isdigit() else '')
        if not canal:
            print('  %-10s sin canal (correr herramientas/dra_hub.py --aplicar antes)' % clave)
            continue
        # ⚠️ CON LA FORMA EN LA FIRMA: los que salieron en un embed tienen que volver a mandarse como adjunto aunque la
        # imagen sea la misma (`FORMA`)
        firma = hashlib.sha256((FORMA + htm).encode('utf-8')).hexdigest()[:16]
        antes = estado.get(clave) or {}
        if antes.get('firma') == firma and antes.get('msg'):
            print('  %-10s igual: no se toca' % clave)
            continue
        ruta = foto(htm, os.path.join(d, clave + '.png'))
        cuerpo = cuerpo_panel(clave, botones)
        hm = {'Authorization': h['Authorization']}

        def _con_imagen(metodo, url_api):
            with open(ruta, 'rb') as fh:
                return metodo(url_api, headers=hm, data={'payload_json': json.dumps(cuerpo)},
                              files={'files[0]': (clave + '.png', fh, 'image/png')}, timeout=60)
        r = None
        if antes.get('msg') and antes.get('canal') == canal:
            r = _con_imagen(requests.patch, 'https://discord.com/api/v10/channels/%s/messages/%s' % (canal, antes['msg']))
            if r.status_code == 404:
                r = None
        if r is None:
            r = _con_imagen(requests.post, 'https://discord.com/api/v10/channels/%s/messages' % canal)
        if r.status_code in (200, 201):
            estado[clave] = {'canal': canal, 'msg': r.json().get('id') or antes.get('msg'), 'firma': firma,
                             't': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
            print('  %-10s ✓ %s' % (clave, estado[clave]['msg']))
        else:
            print('  %-10s ✗ %s %s' % (clave, r.status_code, r.text[:160]))
        time.sleep(0.5)
    with io.open(HUB, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(hub, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')
    return 0


def _self_check():
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('ok' if c else '🔴', que))

    print('\n  paneles_dra.py — self-check, sin red ni navegador\n')
    ps = paneles()
    ok([p[0] for p in ps] == ['temporada', 'mw', 'semana'], 'los tres paneles')
    ok(all(1 <= len(p[3]) <= 5 and all(u.startswith('https://underlegends.pages.dev/') for _t, u in p[3]) for p in ps),
       'cada uno con 1 a 5 botones, todos a la página')
    s = datos_semana()
    ok('FVS' not in FUERA, 'FVS sale en el panel de la semana (Dlx, 13/10: «FVS debería estar en esto»)')
    ok(_num(273733) == '274K' and _num(9500) == '9.500' and _num(None) == '0', 'los números como en la página')
    ok('<script' not in ''.join(p[2] for p in ps).lower(), 'el HTML no lleva scripts')
    ok(all(CUANDO in p[2] for p in ps), 'la hora va aparte: la firma no cambia sólo porque pasó el tiempo')
    c = cuerpo_panel('temporada', ps[0][3])
    ok(c['embeds'] == [] and c['attachments'] == [{'id': 0, 'filename': 'temporada.png'}] and c['components'][0]['components'],
       'la imagen va como adjunto y sin embed, con sus botones (Dlx, 15/10: «quitar las imágenes del embed»)')
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
