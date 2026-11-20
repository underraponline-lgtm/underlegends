# -*- coding: utf-8 -*-
"""🖼️ La maqueta de las imágenes para redes de cada servidor: tres direcciones sobre los datos reales de la semana.

    python maqueta.py <repo>            -> salida/*.webp + medidas.json
    python maqueta.py <repo> --html     -> además salida/*.html, para mirar una a mano
"""
import base64
import colorsys
import io
import json
import math
import os
import random
import sys

R = os.path.abspath(sys.argv[1])
sys.path[:0] = [os.path.join(R, 'bot'), os.path.join(R, 'sheet'), R]
AQUI = os.path.dirname(os.path.abspath(__file__))
SAL = os.path.join(AQUI, 'salida')
os.makedirs(SAL, exist_ok=True)

NEGRO, PAPEL, VERDE, MAG, ORO = '#030304', '#F2EEE6', '#29B298', '#E41373', '#E7B622'
MESES = ['', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
CORONA = ('<svg class="corona" viewBox="0 0 48 34" aria-hidden="true">'
          '<path d="M4 12 L14 21 L24 5 L34 21 L44 12 L40 30 L8 30 Z" fill="%s" stroke="#030304" stroke-width="2.4" '
          'stroke-linejoin="round"/><rect x="8" y="26" width="32" height="5" fill="#C8960F" stroke="#030304" stroke-width="2"/>'
          '<circle cx="4" cy="11" r="3.4" fill="%s" stroke="#030304" stroke-width="2"/>'
          '<circle cx="24" cy="4" r="3.6" fill="%s" stroke="#030304" stroke-width="2"/>'
          '<circle cx="44" cy="11" r="3.4" fill="%s" stroke="#030304" stroke-width="2"/></svg>') % (ORO, ORO, ORO, ORO)


def fuentes():
    return io.open(os.path.join(R, 'comun', 'fonts', 'embed.css'), encoding='utf-8').read()


def e(s):
    return str(s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def miles(n):
    return '{:,}'.format(int(round(n))).replace(',', '.')


def nota(v):
    return ('%.1f' % v).replace('.', ',') if v is not None else ''


# ── el color del servidor, en tres versiones ─────────────────────────────────────────────────────────────────────────
def rgb(hx):
    hx = hx.lstrip('#')
    return tuple(int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4))


def lum(hx):
    f = lambda c: c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4   # noqa: E731
    r, g, b = rgb(hx)
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b)


def hexa(r, g, b):
    return '#%02X%02X%02X' % tuple(max(0, min(255, round(x * 255))) for x in (r, g, b))


def luz(hx):
    """El color del servidor, legible sobre negro: si es muy oscuro (FFA, #26045B), se aclara sin perder el tono."""
    r, g, b = rgb(hx)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    while lum(hexa(*colorsys.hls_to_rgb(h, l, s))) < .16 and l < .9:
        l += .02
    return hexa(*colorsys.hls_to_rgb(h, l, s))


def tinta(hx):
    return NEGRO if lum(hx) > .32 else '#FFFFFF'


# ── texturas ─────────────────────────────────────────────────────────────────────────────────────────────────────────
GRANO = ("url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>\")")


def roto(seed, arriba=True, abajo=True, paso=2.2, amp=1.6):
    """Un `clip-path` de papel rasgado: borde dentado arriba y/o abajo, en %."""
    rnd = random.Random(seed)
    pts = []
    x = 0.0
    while x < 100:
        pts.append('%.2f%% %.2f%%' % (x, rnd.uniform(0, amp) if arriba else 0))
        x += rnd.uniform(paso * .6, paso * 1.4)
    pts.append('100%% %.2f%%' % (rnd.uniform(0, amp) if arriba else 0))
    x = 100.0
    while x > 0:
        pts.append('%.2f%% %.2f%%' % (x, 100 - (rnd.uniform(0, amp) if abajo else 0)))
        x -= rnd.uniform(paso * .6, paso * 1.4)
    pts.append('0%% %.2f%%' % (100 - (rnd.uniform(0, amp) if abajo else 0)))
    return 'polygon(%s)' % ','.join(pts)


def estrella(puntas=18, adentro=.82):
    pts = []
    for i in range(puntas * 2):
        a = math.pi * i / puntas - math.pi / 2
        r = 50 if i % 2 == 0 else 50 * adentro
        pts.append('%.2f%% %.2f%%' % (50 + r * math.cos(a), 50 + r * math.sin(a)))
    return 'polygon(%s)' % ','.join(pts)


def barras(seed, ancho=220, alto=54, color=NEGRO):
    """Un código de barras de adorno (no se lee), del número de los eventos."""
    rnd = random.Random(seed)
    x, rs = 0, []
    while x < ancho - 4:
        w = rnd.choice((2, 2, 3, 4, 6))
        rs.append('<rect x="%d" y="0" width="%d" height="%d" fill="%s"/>' % (x, w, alto, color))
        x += w + rnd.choice((2, 3, 4, 5))
    return ('<svg class="barras" viewBox="0 0 %d %d" width="%d" height="%d" aria-hidden="true">%s</svg>'
            % (ancho, alto, ancho, alto, ''.join(rs)))


# ── los datos de cada pieza ──────────────────────────────────────────────────────────────────────────────────────────
def cargar(sv):
    d = json.load(io.open(os.path.join(AQUI, 'datos_%s.json' % sv), encoding='utf-8'))
    d['luz'] = luz(d['color'])
    d['tinta'] = tinta(d['color'])
    a, b = d['ini'].split('-'), d['fin'].split('-')
    d['semana'] = '%d–%d %s' % (int(a[2]), int(b[2]), MESES[int(b[1])])
    import datetime as _dt
    d['nro'] = _dt.date.fromisoformat(d['ini']).isocalendar()[1]
    d['pleno'] = d['luz'] if lum(d['color']) < .05 else d['color']
    d['pleno_tinta'] = tinta(d['pleno'])
    d['semana_larga'] = 'Semana del %d al %d de %s' % (int(a[2]), int(b[2]), MESES[int(b[1])].lower())
    camp = next(g for g in d['top'] if g['k'] == d['camp']) if any(g['k'] == d['camp'] for g in d['top']) else d['top'][0]
    d['c'] = camp
    d['ganados'] = [x for x in d['eventos'] if x['camp'] and x['camp'].lower() == camp['n'].lower()]
    return d


def detalle(g):
    if g['tit'] >= 2:
        return '%d títulos' % g['tit']
    if g['tit'] == 1:
        return 'campeón'
    return {1: 'subcampeón', 2: 'tercero', 3: 'cuarto'}.get(g['mejor'], '%d evento%s' % (g['ev'], 's' if g['ev'] > 1 else ''))


def sello(g):
    """La pegatina del campeón: los títulos si son dos o más, si no la nota."""
    if g['tit'] >= 2:
        return '<b>×%d</b><span>títulos</span>' % g['tit']
    return '<span>nota</span><b>%s</b>' % nota(g['nota'])


def carta(g, clase='carta'):
    """La tarjeta de verdad; sin tarjeta, la figura (`kit._sil_vs`) en su placa: sin dato no hay pieza."""
    if g.get('carta'):
        return '<img class="%s" src="%s" alt="">' % (clase, g['carta'])
    return ('<div class="%s sinc"><div class="sinc-in"><img class="sil" src="%s" alt=""></div></div>'
            % (clase, g['sil']))


def nombre_fl(g):
    partes = str(g['n']).split()
    if len(partes) < 2:
        return '<span class="nw">%s%s</span>' % (e(g['n']), fl(g))
    return '%s <span class="nw">%s%s</span>' % (e(' '.join(partes[:-1])), e(partes[-1]), fl(g))


def fl(g):
    return '<img class="fl" src="%s" alt="">' % g['fl'] if g.get('fl') else ''


def pie(d, oscuro=True):
    return ('<div class="pie k"><img class="ul" src="%s" alt=""><div class="pie-t"><b>LIGA GLOBAL</b>'
            '<span>Toda la semana en underlegends.pages.dev</span></div><div class="nro"><b>N.º %d</b><span>%s</span></div></div>'
            % (d['ul'], d['nro'], e(d['sv'])))


def logo(d, clase='logo'):
    return '<img class="%s" src="%s" alt="">' % (clase, d['logo']) if d.get('logo') else ''


def vars_(d):
    return '--sv:%s;--sv-luz:%s;--sv-tinta:%s;--sv-pleno:%s;--sv-pleno-tinta:%s' % (d['color'], d['luz'], d['tinta'], d['pleno'], d['pleno_tinta'])


def lineas_ev(d, ganados, max_=3):
    out = []
    for x in ganados[:max_]:
        out.append('<li><b class="fit">%s</b><span>%s · campeón entre %d · nota %s</span></li>'
                   % (e(x['nombre']), e(x['fecha']), x['jug'], nota(x['nota_camp'])))
    return ''.join(out)


# ═══ A · PÓSTER DE PELEA ═════════════════════════════════════════════════════════════════════════════════════════════
CSS_BASE = """
*{box-sizing:border-box}
body{margin:0;background:#030304}
#c{position:relative;overflow:hidden;font-family:Archivo,LigaEmoji,sans-serif;color:#F6F6F4;background:#030304}
#c.post{width:1080px;height:1350px}
#c.story{width:1080px;height:1920px}
.lienzo{position:absolute;left:0;top:0;width:1080px;height:1350px}
#c.story .lienzo{top:255px}
.sigla{position:absolute;left:-20px;right:-20px;top:10px;height:250px;text-align:center;font:900 300px/.86 Archivo,sans-serif;font-stretch:125%;color:transparent;-webkit-text-stroke:4px var(--sv-luz);opacity:.38;white-space:nowrap;overflow:hidden}
.et{font-family:'Barlow Condensed',Archivo,sans-serif;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.grano{position:absolute;inset:0;background-image:GRANO;background-size:240px;opacity:.16;mix-blend-mode:overlay;pointer-events:none;z-index:90}
.fit,.fit2{display:block;white-space:nowrap;overflow:hidden}
.nw{white-space:nowrap}
img.fl{height:.62em;width:auto;vertical-align:.08em;margin-left:.22em;box-shadow:0 0 0 2px rgba(0,0,0,.5)}
.nombre img.fl,.titular h1 img.fl,.tk h1 img.fl{height:.36em;vertical-align:.3em;margin-left:.16em;box-shadow:0 0 0 3px #030304}
.corona{position:absolute;width:96px;height:auto;left:50%;transform:translateX(-50%) rotate(-5deg);filter:drop-shadow(0 4px 0 #030304)}
.sinc{position:relative;background:#030304;clip-path:polygon(0 6%,50% 0,100% 6%,100% 88%,50% 100%,0 88%)}
.sinc-in{position:absolute;inset:8px;background:var(--sv);overflow:hidden;display:flex;align-items:flex-end;justify-content:center;
  clip-path:polygon(0 6%,50% 0,100% 6%,100% 88%,50% 100%,0 88%)}
.sinc-in::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 35%,rgba(255,255,255,.35),transparent 60%),
  repeating-conic-gradient(from 0deg at 50% 38%,rgba(0,0,0,.18) 0 6deg,transparent 6deg 14deg)}
.sinc .sil{position:relative;height:80%;width:auto;margin-bottom:7%}
.sinc .sinc-t{position:absolute;z-index:2;left:50%;bottom:8%;transform:translateX(-50%);background:#030304;color:#F6F6F4;
  font:700 22px/1 'Barlow Condensed',sans-serif;letter-spacing:.14em;text-transform:uppercase;padding:6px 10px;white-space:nowrap}
.pie{position:absolute;left:64px;right:64px;bottom:44px;display:flex;align-items:center;gap:18px}
.pie .ul{width:64px;height:64px;object-fit:contain}
.pie-t{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}
.pie-t b{font:900 26px/1 Archivo,sans-serif;letter-spacing:.06em}
.pie-t span{font:700 21px/1 'Barlow Condensed',sans-serif;letter-spacing:.06em;opacity:.8}
.pie .nro{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.pie .nro b{font:900 34px/1 Archivo,sans-serif;font-stretch:115%}
.pie .nro span{font:700 20px/1 'Barlow Condensed',sans-serif;letter-spacing:.2em;opacity:.8}
""".replace('GRANO', GRANO)

CSS_A = """
#c.A{background:#030304}
.A .rayas{position:absolute;inset:-10% -30%;z-index:0;transform:rotate(-14deg);background:
  radial-gradient(circle,var(--sv-luz) 2.2px,transparent 2.6px) 0 0/12px 12px;opacity:.28;
  -webkit-mask-image:linear-gradient(180deg,transparent 8%,#000 30%,#000 62%,transparent 86%)}
.A .sol{position:absolute;left:50%;top:560px;width:820px;height:820px;margin-left:-410px;margin-top:-410px;border-radius:50%;
  background:#040405;box-shadow:0 0 0 14px var(--sv-luz),0 0 0 26px #030304,0 0 0 30px var(--sv-luz)}
.A .sol::after{content:'';position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,var(--sv-luz) 2.6px,transparent 3px) 0 0/11px 11px;
  opacity:.34;-webkit-mask-image:radial-gradient(circle,#000 38%,transparent 74%)}
.A .arriba{position:absolute;left:64px;right:64px;top:52px;display:flex;align-items:center;gap:18px;z-index:20}
.A .arriba .logo{width:86px;height:86px;object-fit:contain;background:#030304;border:3px solid var(--sv-luz);padding:6px}
.A .arriba .sv{display:flex;flex-direction:column;gap:6px;flex:1;min-width:0}
.A .arriba .sv b{font:900 34px/1 Archivo,sans-serif;font-stretch:112%;text-transform:uppercase}
.A .arriba .sv span{font-size:22px;color:#D8D8D4}
.A .arriba .sem{font:900 30px/1 Archivo,sans-serif;background:#F6F6F4;color:#030304;padding:12px 16px;box-shadow:7px 7px 0 var(--sv-luz)}
.A .eco{position:absolute;z-index:4;background:#040405;filter:drop-shadow(3px 0 0 var(--sv-luz)) drop-shadow(-3px 0 0 var(--sv-luz)) drop-shadow(0 3px 0 var(--sv-luz)) drop-shadow(0 -3px 0 var(--sv-luz));-webkit-mask-size:contain;-webkit-mask-repeat:no-repeat;-webkit-mask-position:center}
.A .heroe{position:absolute;left:50%;z-index:6}
.A .heroe .cw{height:100%;filter:drop-shadow(16px 16px 0 #29B298)}
.A .heroe .carta{display:block;height:100%;width:auto}
.A .heroe .carta.sinc{width:100%;height:100%}
.A .heroe .corona{top:-58px}
.A .sol.chico{left:250px;top:720px;width:440px;height:440px;margin-left:-220px;margin-top:-220px}
.A .rot{position:absolute;left:64px;top:182px;z-index:22;background:#E41373;color:#fff;font:700 30px/1 'Barlow Condensed',sans-serif;
  letter-spacing:.16em;text-transform:uppercase;padding:10px 14px;transform:rotate(-3deg);box-shadow:6px 6px 0 #030304}
.A .boom{position:absolute;z-index:24;width:210px;height:210px;background:#E7B622;color:#030304;clip-path:STAR;
  display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(10deg)}
.A .boom b{font:900 74px/.9 Archivo,sans-serif}
.A .boom span{font:700 26px/1 'Barlow Condensed',sans-serif;letter-spacing:.12em;text-transform:uppercase}
.A .boom-s{position:absolute;z-index:23;width:210px;height:210px;background:#030304;clip-path:STAR;transform:translate(8px,8px) rotate(10deg)}
.A .bajo{position:absolute;left:40px;right:40px;bottom:128px;z-index:30;display:flex;flex-direction:column;gap:22px}
.A .bajo .ticket{position:relative;left:auto;right:auto;margin:0 24px}
.A .nombre{position:relative;z-index:30;font:900 176px/.86 Archivo,sans-serif;font-stretch:125%;text-transform:uppercase;
  text-align:center;color:#F6F6F4;text-shadow:8px 8px 0 var(--sv),10px 10px 0 #030304;padding:4px 14px 10px}
.A .ticket{position:absolute;left:64px;right:64px;z-index:30;display:flex;background:#F2EEE6;color:#030304;box-shadow:10px 10px 0 #29B298}
.A .ticket .talon{width:120px;flex:none;border-right:4px dashed #030304;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
  background:var(--sv);color:var(--sv-tinta)}
.A .ticket .talon b{font:900 58px/1 Archivo,sans-serif}
.A .ticket .talon span{font:700 20px/1 'Barlow Condensed',sans-serif;letter-spacing:.12em;text-transform:uppercase}
.A .ticket ul{list-style:none;margin:0;padding:18px 24px;display:flex;flex-direction:column;gap:12px;flex:1;min-width:0}
.A .ticket li{display:flex;flex-direction:column;gap:3px;min-width:0}
.A .ticket li b{font:900 34px/1 Archivo,sans-serif;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.A .ticket li span{font:700 23px/1 'Barlow Condensed',sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#3A3A3E}
/* top 5 */
.A .tit5{position:absolute;left:56px;right:56px;top:176px;z-index:20;font:900 132px/.84 Archivo,sans-serif;font-stretch:125%;text-transform:uppercase;
  color:#F6F6F4;text-shadow:7px 7px 0 var(--sv),9px 9px 0 #030304}
.A .tit5 small{display:block;font:700 34px/1 'Barlow Condensed',sans-serif;letter-spacing:.2em;color:var(--sv-luz);text-shadow:none;margin-bottom:12px}
.A .uno{position:absolute;left:66px;top:470px;width:380px;height:513px;z-index:10}
.A .uno .carta{position:absolute;inset:0;height:100%;width:auto;margin:auto;filter:drop-shadow(12px 12px 0 #030304)}
.A .uno .carta.sinc{width:100%;filter:none}
.A .uno .corona{top:-52px}
.A .filas.angosta{left:520px}
.A .filas{position:absolute;left:64px;right:56px;top:420px;display:flex;flex-direction:column;gap:12px;z-index:12}
.A .fila{position:relative;display:flex;align-items:center;gap:16px;background:rgba(3,3,4,.86);border:3px solid #F6F6F4;padding:8px 16px 8px 0;height:104px}
.A .filas:not(.angosta) .fila{height:108px}
.A .fila.n1{background:#F6F6F4;color:#030304;box-shadow:9px 9px 0 var(--sv-luz)}
.A .fila .num{width:90px;flex:none;text-align:center;font:900 84px/.8 Archivo,sans-serif;color:transparent;-webkit-text-stroke:3px #F6F6F4}
.A .fila.n1 .num{color:#030304;-webkit-text-stroke:0}
.A .fila .q{flex:1;min-width:0;display:flex;flex-direction:column;gap:7px}
.A .fila .q b{font:900 34px/1 Archivo,sans-serif;text-transform:uppercase}
.A .fila .q span{font:700 22px/1 'Barlow Condensed',sans-serif;letter-spacing:.06em;text-transform:uppercase;opacity:.82}
.A .fila .bar{height:10px;background:rgba(255,255,255,.12)}
.A .fila.n1 .bar{background:rgba(0,0,0,.12)}
.A .fila .bar i{display:block;height:100%;background:var(--sv-luz)}
.A .fila.n1 .bar i{background:var(--sv)}
.A .fila .pts{font:900 36px/1 Archivo,sans-serif;white-space:nowrap}
.A .fila .pts small{display:block;font:700 18px/1 'Barlow Condensed',sans-serif;letter-spacing:.12em;text-align:right;opacity:.7}
.A .resumen{position:absolute;left:56px;right:56px;top:1030px;z-index:12;display:flex;gap:14px}
.A .resumen div{flex:1;background:#F2EEE6;color:#030304;padding:14px 18px;display:flex;flex-direction:column;gap:6px;box-shadow:7px 7px 0 #29B298}
.A .resumen b{font:900 52px/1 Archivo,sans-serif}
.A .resumen span{font:700 22px/1 'Barlow Condensed',sans-serif;letter-spacing:.1em;text-transform:uppercase}
""".replace('STAR', estrella())




def armar(d, clase, story, fondo, cont, fondo_story=''):
    """El post (1080×1350) o la historia (1080×1920): la historia es el MISMO lienzo, corrido a la zona segura (250 px
    arriba y 330 abajo, donde Instagram pone su nombre y la barra de respuesta), con el fondo estirado."""
    sigla = '<div class="sigla">%s</div>' % e(d['sv']) if story else ''
    return ('<div id="c" class="%s %s" style="%s">%s%s%s<div class="lienzo">%s</div><div class="grano"></div></div>'
            % ('story' if story else 'post', clase, vars_(d), fondo, fondo_story if story else '', sigla, cont))


def A_campeon(d, story=False):
    g = d['c']
    sol_y, h_carta, top_carta, nom_top, tick_top = 560, 600, 250, 860, 1050
    w_carta = round(h_carta * (300 / 405)) if not g.get('carta') else None
    mask = g.get('carta') or g.get('sil')
    ecos = ''
    for dx, rot, op in ((-70, -7, 1), (70, 7, 1)):
        ecos += ('<div class="eco" style="left:calc(50%% + %dpx);top:%dpx;width:%dpx;height:%dpx;margin-left:-%dpx;'
                 'transform:rotate(%ddeg);opacity:%s;-webkit-mask-image:url(%s)"></div>'
                 % (dx, top_carta + 40, round(h_carta * .7), h_carta - 80, round(h_carta * .35), rot, op, mask))
    heroe_w = 'width:%dpx;' % w_carta if w_carta else ''
    heroe = ('<div class="heroe" style="top:%dpx;height:%dpx;%stransform:translateX(-50%%) rotate(-3deg)">%s%s</div>'
             % (top_carta, h_carta, heroe_w, CORONA, '<div class="cw">%s</div>' % carta(g)))
    tick = ('<div class="ticket k"><div class="talon"><b>%d</b><span>evento%s</span></div><ul>%s</ul></div>'
            % (len(d['ganados']), 's' if len(d['ganados']) != 1 else '', lineas_ev(d, d['ganados'])))
    cont = ('<div class="sol" style="top:%dpx"></div>'
            '<div class="arriba k">%s<div class="sv"><b class="fit">%s</b><span class="et">Freestyle · Liga Global</span></div>'
            '<span class="sem">%s</span></div>'
            '<div class="rot k">Campeón de la semana</div>%s%s'
            '<div class="boom-s" style="left:770px;top:%dpx"></div><div class="boom k" style="left:770px;top:%dpx">%s</div>'
            '<div class="bajo"><div class="nombre fit2 k" data-min="110" data-top="%d">%s</div>%s</div>%s'
            % (sol_y, logo(d), e(d['nombre']), e(d['semana']), ecos, heroe, top_carta + 40, top_carta + 40, sello(g),
               nom_top, nombre_fl(g), tick, pie(d)))
    return armar(d, 'A', story, '<div class="rayas"></div>', cont)


def A_top(d):
    top = d['top'][:5]
    mx = max(g['pts'] for g in top) or 1
    uno = top[0]
    filas = ''
    for g in top:
        filas += ('<div class="fila%s"><span class="num">%d</span><div class="q"><b class="fit">%s</b>'
                  '<div class="bar"><i style="width:%d%%"></i></div><span>%s · nota %s</span></div>'
                  '<div class="pts">%s<small>PTS</small></div></div>'
                  % (' n1' if g['pos'] == 1 else '', g['pos'], e(g['n']) + fl(g), round(100 * g['pts'] / mx), detalle(g),
                     nota(g['nota']), miles(g['pts'])))
    res = ('<div class="resumen k"><div><b>%d</b><span>eventos</span></div><div><b>%d</b><span>jugaron</span></div>'
           '<div><b>%s</b><span>la nota más alta</span></div></div>'
           % (len(d['eventos']), d['jugaron'], nota(max(g['nota'] for g in d['top']))))
    cont = (('<div class="sol chico"></div>' if uno.get('carta') else '') +
            '<div class="arriba k">%s<div class="sv"><b class="fit">%s</b><span class="et">Freestyle · Liga Global</span></div>'
            '<span class="sem">%s</span></div>'
            '<div class="tit5 k"><small class="et">Los que más sumaron</small>El top 5</div>'
            '%s<div class="filas%s k">%s</div>%s%s'
            % (logo(d), e(d['nombre']), e(d['semana']),
               '<div class="uno">%s%s</div>' % (CORONA, carta(uno)) if uno.get('carta') else '',
               ' angosta' if uno.get('carta') else '', filas, res, pie(d)))
    return armar(d, 'A', False, '<div class="rayas"></div>', cont)


# ═══ B · PORTADA DE REVISTA ══════════════════════════════════════════════════════════════════════════════════════════
CSS_B = """
#c.B{background:#030304}
.B .cabeza-fondo{position:absolute;left:0;right:0;top:0;height:300px;background:var(--sv)}
.B .cabeza{position:absolute;left:0;right:0;top:0;height:222px;background:var(--sv);color:var(--sv-tinta);z-index:10;clip-path:ROTO_ABAJO}
.B .cabeza .linea{position:absolute;left:56px;right:56px;top:40px;display:flex;justify-content:space-between;align-items:center;
  font:700 26px/1 'Barlow Condensed',sans-serif;letter-spacing:.16em;text-transform:uppercase}
.B .cabeza .linea .logo{width:58px;height:58px;object-fit:contain;background:#030304;padding:4px}
.B .cabeza .linea span{display:flex;align-items:center;gap:14px}
.B .cabeza .mast{position:absolute;left:44px;right:44px;top:98px;font:900 100px/.9 Archivo,sans-serif;font-stretch:125%;text-transform:uppercase;
  letter-spacing:-.01em}
.B .papel{position:absolute;background:#F2EEE6;color:#030304;z-index:12}
.B .papel::after{content:'';position:absolute;inset:0;background-image:GRANO;background-size:240px;opacity:.5;mix-blend-mode:multiply;pointer-events:none}
.B .titular{left:40px;width:590px;top:272px;padding:30px 30px 28px 38px;clip-path:ROTO_A;transform:rotate(-1.5deg)}
.B .titular .et{display:inline-block;background:#E41373;color:#fff;font-size:28px;padding:8px 12px}
.B .titular h1{margin:14px 0 0;font:900 150px/.86 Archivo,sans-serif;font-stretch:118%;text-transform:uppercase}
.B .titular h2{margin:14px 0 0;font:900 52px/1.02 Archivo,sans-serif;text-transform:uppercase}
.B .titular h2 .et{display:block;font-size:30px;letter-spacing:.16em;margin-bottom:8px}
.B .titular h2 em{font-style:normal;background:#030304;color:#F2EEE6;padding:0 10px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.B .portadas{position:absolute;left:56px;width:560px;top:720px;z-index:12;display:flex;flex-direction:column;gap:22px}
.B .portadas div{display:flex;align-items:baseline;gap:16px}
.B .portadas b{font:900 78px/1 Archivo,sans-serif;color:var(--sv-luz);min-width:0}
.B .portadas span{font:700 28px/1.05 'Barlow Condensed',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#E8E8E4}
.B .portada{position:absolute;right:44px;top:290px;width:450px;height:608px;z-index:14;transform:rotate(4deg)}
.B .portada .carta{position:absolute;inset:0;height:100%;width:auto;margin:auto;filter:drop-shadow(12px 12px 0 #29B298)}
.B .portada .carta.sinc{width:100%;filter:none;box-shadow:12px 12px 0 #29B298}
.B .portada .corona{top:-56px}
.B .sticker{position:absolute;z-index:20;right:400px;top:800px;width:190px;height:190px;border-radius:50%;background:#E7B622;color:#030304;border:5px solid #030304;
  display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-8deg);box-shadow:8px 8px 0 #030304}
.B .sticker b{font:900 68px/.9 Archivo,sans-serif}
.B .sticker span{font:700 24px/1 'Barlow Condensed',sans-serif;letter-spacing:.12em;text-transform:uppercase}
.B .lineas{position:absolute;left:56px;right:56px;z-index:12;display:flex;flex-direction:column;gap:0}
.B .lineas div{display:flex;align-items:baseline;gap:18px;padding:18px 0;height:76px;border-top:3px solid #F6F6F4}
.B .lineas div:last-child{border-bottom:3px solid #F6F6F4}
.B .lineas i{font:900 40px/1 Archivo,sans-serif;font-style:normal;color:var(--sv-luz);flex:none}
.B .lineas b{font:900 34px/1.05 Archivo,sans-serif;text-transform:uppercase;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.B .lineas span{font:700 26px/1 'Barlow Condensed',sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#CFCFCA;white-space:nowrap}
/* top 5 */
.B .t5h{position:absolute;left:56px;right:56px;top:262px;z-index:12;display:flex;align-items:flex-end;justify-content:space-between}
.B .t5h h1{margin:0;font:900 112px/.86 Archivo,sans-serif;font-stretch:122%;text-transform:uppercase}
.B .t5h span{font:700 30px/1 'Barlow Condensed',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--sv-luz);padding-bottom:8px}
.B .tira{left:44px;right:44px;height:122px;display:flex;align-items:center;gap:22px;padding:0 26px 0 0}
.B .tira .num{width:118px;height:100%;flex:none;display:grid;place-items:center;background:#030304;color:#F2EEE6;font:900 92px/1 Archivo,sans-serif}
.B .tira.n1 .num{background:var(--sv);color:var(--sv-tinta)}
.B .tira .av{width:76px;height:102px;flex:none;object-fit:contain}
.B .tira .av.sinc{width:76px;height:102px}
.B .tira .av.sinc .sinc-t{display:none}
.B .tira .q{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.B .tira .q b{font:900 42px/1 Archivo,sans-serif;text-transform:uppercase}
.B .tira .q span{font:700 24px/1 'Barlow Condensed',sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#4A4A4E}
.B .tira .pts{font:900 44px/1 Archivo,sans-serif;white-space:nowrap;text-align:right}
.B .tira .pts small{display:block;font:700 20px/1 'Barlow Condensed',sans-serif;letter-spacing:.14em;color:#4A4A4E}
"""


def B_cabeza(d, nro):
    return ('<div class="cabeza k"><div class="linea"><span>%sLa semana de</span><span>N.º %d · %s</span></div>'
            '<div class="mast fit">%s</div></div>' % (logo(d), nro, e(d['semana']), e(d['nombre'])))


def B_campeon(d, story=False):
    g = d['c']
    if g['tit'] >= 2:
        h2 = 'Se lleva <em>%d</em> en una semana' % g['tit']
    else:
        h2 = '<span class="et">Gana</span><em>%s</em>' % e(d['ganados'][0]['nombre']) if d['ganados'] else 'Campeón'
    rivales = sum(max(0, x['jug'] - 1) for x in d['ganados'])
    portadas = ''.join('<div><b>%s</b><span>%s</span></div>' % (v, t) for v, t in (
        (miles(g['pts']), 'puntos de la semana'), (str(rivales), 'rivales en %s' % ('sus llaves' if len(d['ganados']) > 1 else 'la llave')),
        ('%d/%d' % (g['bg'], g['bj']), 'batallas ganadas'))[:3 if len(d['ganados']) < 3 else 2])
    lineas = ''.join('<div><i>%s</i><b class="fit">%s</b><span>entre %d · nota %s</span></div>'
                     % (e(x['fecha']), e(x['nombre']), x['jug'], nota(x['nota_camp'])) for x in d['ganados'][:3])
    n_lin = max(1, min(3, len(d['ganados'])))
    cont = ('%s<div class="papel titular k"><span class="et">Campeón de la semana</span>'
            '<h1 class="fit2" data-min="96">%s</h1><h2>%s</h2></div>'
            '<div class="portadas k">%s</div>'
            '<div class="portada">%s%s</div>'
            '<div class="sticker k">%s</div>'
            '<div class="lineas k" style="top:%dpx">%s</div>%s'
            % (B_cabeza(d, d['nro']), nombre_fl(g), h2, portadas, CORONA, carta(g), sello(g),
               1222 - n_lin * 76, lineas, pie(d)))
    return armar(d, 'B', story, '', cont, '<div class="cabeza-fondo"></div>')


def B_top(d):
    top = d['top'][:5]
    tiras = ''
    for i, g in enumerate(top):
        y = 420 + i * 140
        tiras += ('<div class="papel tira%s" style="top:%dpx;clip-path:%s;transform:rotate(%.1fdeg)"><span class="num">%d</span>%s'
                  '<div class="q"><b class="fit">%s</b><span>%s · nota %s</span></div><div class="pts">%s<small>PTS</small></div></div>'
                  % (' n1' if g['pos'] == 1 else '', y, roto(20 + i, True, True, 3, 4), (-.8, .6, -.4, .7, -.5)[i], g['pos'],
                     carta(g, 'av'), e(g['n']) + fl(g), detalle(g), nota(g['nota']), miles(g['pts'])))
    cont = ('%s<div class="t5h k"><h1>El top 5</h1><span>%d jugaron · %d eventos</span></div>'
            '<div class="k">%s</div>%s'
            % (B_cabeza(d, d['nro']), d['jugaron'], len(d['eventos']), tiras, pie(d)))
    return armar(d, 'B', False, '', cont)


# ═══ C · CARTA Y TICKET ══════════════════════════════════════════════════════════════════════════════════════════════
CSS_C = """
#c.C{background:#030304}
.C .reja{position:absolute;inset:0;background:
  linear-gradient(rgba(255,255,255,.05) 2px,transparent 2px) 0 0/90px 90px,
  linear-gradient(90deg,rgba(255,255,255,.05) 2px,transparent 2px) 0 0/90px 90px;
  -webkit-mask-image:radial-gradient(ellipse at 50% 40%,#000 30%,transparent 78%)}
.C .franja{position:absolute;left:0;right:0;height:16px;background:var(--sv)}
.C .arriba{position:absolute;left:64px;right:64px;top:64px;display:flex;align-items:center;gap:18px;z-index:20}
.C .arriba .logo{width:78px;height:78px;object-fit:contain}
.C .arriba .sv{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.C .arriba .sv b{font:900 32px/1 Archivo,sans-serif;text-transform:uppercase}
.C .arriba .sv span{font-size:22px;color:#BDBDB8}
.C .arriba .sem{font:700 28px/1 'Barlow Condensed',sans-serif;letter-spacing:.14em;text-transform:uppercase;border:3px solid #F6F6F4;padding:10px 14px}
.C .marco{position:absolute;z-index:10;background:#F2EEE6;padding:26px 26px 64px;box-shadow:16px 16px 0 #29B298;transform:rotate(-3deg)}
.C .marco .carta{display:block;height:100%;width:auto}
.C .marco .carta.sinc{width:100%}
.C .marco .pie-m{position:absolute;left:26px;right:26px;bottom:16px;display:flex;justify-content:space-between;color:#030304;
  font:700 22px/1 'Barlow Condensed',sans-serif;letter-spacing:.14em;text-transform:uppercase}
.C .cinta{position:absolute;height:44px;background:rgba(231,182,34,.82);z-index:12}
.C .grande{position:absolute;z-index:16;left:620px;right:64px;top:330px;height:420px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px}
.C .grande b{width:100%;text-align:center;font:900 220px/.86 Archivo,sans-serif;color:var(--sv-luz);text-shadow:10px 10px 0 #F2EEE6;padding:0 14px 14px 0}
.C .grande .et{font-size:30px;color:#E8E8E4}
.C .tk{position:absolute;z-index:18;display:flex;background:#F2EEE6;color:#030304;box-shadow:12px 12px 0 #29B298}
.C .tk .cuerpo{flex:1;min-width:0;padding:24px 28px;display:flex;flex-direction:column;gap:10px;position:relative;border-right:4px dashed #030304}
.C .tk .cuerpo .et{font-size:24px;color:#6A6A6E}
.C .tk .cuerpo h1{margin:0;font:900 96px/.9 Archivo,sans-serif;font-stretch:118%;text-transform:uppercase}
.C .tk .cuerpo .ev{display:flex;flex-direction:column;gap:8px;margin-top:6px}
.C .tk .cuerpo .ev div{display:flex;flex-direction:column;gap:5px;border-top:2px dashed #030304;padding-top:9px}
.C .tk .cuerpo .ev b{font:900 28px/1 Archivo,sans-serif;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.C .tk .cuerpo .ev span{font:700 24px/1 'Barlow Condensed',sans-serif;letter-spacing:.06em;white-space:nowrap;text-transform:uppercase}
.C .tk .talon{width:210px;flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
  background:var(--sv-pleno);color:var(--sv-pleno-tinta);padding:16px 0}
.C .tk .talon b{font:900 50px/1 Archivo,sans-serif}
.C .tk .talon span{font:700 22px/1 'Barlow Condensed',sans-serif;letter-spacing:.12em;text-transform:uppercase;text-align:center}
.C .tk .talon .barras{transform:rotate(90deg);margin:30px 0}
.C .sellito{position:absolute;z-index:22;border:6px solid #E41373;color:#E41373;text-transform:uppercase;padding:10px 16px 12px;
  transform:rotate(-10deg);display:flex;flex-direction:column;align-items:center;gap:4px;background:#030304;box-shadow:6px 6px 0 #E41373}
.C .sellito b{font:900 50px/1 Archivo,sans-serif;letter-spacing:.06em}
.C .sellito span{font:700 22px/1 'Barlow Condensed',sans-serif;letter-spacing:.24em}
/* top 5 */
.C .t5{position:absolute;left:64px;right:64px;top:190px;z-index:16;display:flex;align-items:flex-end;justify-content:space-between}
.C .t5 h1{margin:0;font:900 104px/.86 Archivo,sans-serif;font-stretch:120%;text-transform:uppercase}
.C .t5 h1 small{display:block;font:700 30px/1 'Barlow Condensed',sans-serif;letter-spacing:.18em;color:var(--sv-luz);margin-bottom:12px}
.C .ent{position:absolute;left:64px;right:64px;z-index:16;display:flex;background:#F2EEE6;color:#030304;height:132px;box-shadow:10px 10px 0 #29B298}
.C .ent .pos{width:112px;flex:none;display:grid;place-items:center;font:900 78px/1 Archivo,sans-serif;background:var(--sv-pleno);color:var(--sv-pleno-tinta)}
.C .ent .mini{width:104px;flex:none;display:grid;place-items:center;overflow:hidden;border-left:4px dashed #030304}
.C .ent .mini .av{height:120px;width:auto}
.C .ent .mini .av.sinc{width:89px;height:120px}
.C .ent .mini .av.sinc .sinc-t{display:none}
.C .ent .q{flex:1;min-width:0;padding:0 16px;display:flex;flex-direction:column;justify-content:center;gap:8px}
.C .ent .q b{font:900 42px/1 Archivo,sans-serif;text-transform:uppercase}
.C .ent .q span{font:700 24px/1 'Barlow Condensed',sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#4A4A4E}
.C .ent .pts{width:200px;flex:none;border-left:4px dashed #030304;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
.C .ent .pts b{font:900 40px/1 Archivo,sans-serif}
.C .ent .pts small{font:700 20px/1 'Barlow Condensed',sans-serif;letter-spacing:.14em}
.C .ent.n1{height:190px;box-shadow:12px 12px 0 var(--sv-luz)}
.C .ent.n1 .mini{width:150px}
.C .ent.n1 .mini .av{height:176px}
.C .ent.n1 .mini .av.sinc{width:130px;height:176px}
.C .ent.n1 .q b{font-size:56px}
"""


def C_campeon(d, story=False):
    g = d['c']
    mx, my, mh, tky = 64, 200, 640, 880
    mw = round(mh * 300 / 405)
    evs = ''.join('<div><b class="fit">%s</b><span>%s · campeón entre %d · nota %s</span></div>' % (e(x['nombre']), e(x['fecha']), x['jug'], nota(x['nota_camp']))
                  for x in d['ganados'][:3])
    grande, que = ('×%d' % g['tit'], 'títulos esta semana') if g['tit'] >= 2 else (nota(g['nota']), 'su nota' if g['ev'] == 1 else 'su nota más alta')
    cont = ('<div class="arriba k">%s<div class="sv"><b class="fit">%s</b><span class="et">Freestyle · Liga Global</span></div>'
            '<span class="sem">%s</span></div>'
            '<div class="marco" style="left:%dpx;top:%dpx;height:%dpx;width:%dpx">%s<div class="pie-m"><span>%s</span><span>%s</span></div></div>'
            '<div class="cinta" style="left:%dpx;top:%dpx;width:150px;transform:rotate(-38deg)"></div>'
            '<div class="cinta" style="left:%dpx;top:%dpx;width:115px;transform:rotate(22deg)"></div>'
            '<div class="grande k"><b class="fit">%s</b><span class="et">%s</span></div>'
            '<div class="tk k" style="left:64px;right:64px;bottom:178px"><div class="cuerpo">'
            '<h1 class="fit2" data-min="80">%s</h1><div class="ev">%s</div></div>'
            '<div class="talon"><b>%s</b><span>pts de la semana</span></div></div>'
            '<div class="sellito k" style="left:660px;top:%dpx"><b>Campeón</b><span>de la semana</span></div>%s'
            % (logo(d), e(d['nombre']), e(d['semana']),
               mx, my, mh + 90, mw + 52, carta(g), e(g['n']), e(d['semana']),
               mx - 44, my - 4, mx + mw - 40, my - 8,
               grande, que,
               nombre_fl(g), evs, miles(g['pts']), 196, pie(d)))
    return armar(d, 'C', story, '<div class="reja"></div><div class="franja" style="top:0"></div>', cont)


def C_top(d):
    top = d['top'][:5]
    ents, y = '', 380
    for g in top:
        n1 = g['pos'] == 1
        ents += ('<div class="ent%s" style="top:%dpx"><span class="pos">%d</span><div class="mini">%s</div>'
                 '<div class="q"><b class="fit">%s</b><span>%s · nota %s</span></div><div class="pts"><b>%s</b><small>PTS</small></div></div>'
                 % (' n1' if n1 else '', y, g['pos'], carta(g, 'av'), e(g['n']) + fl(g), detalle(g), nota(g['nota']), miles(g['pts'])))
        y += (190 if n1 else 132) + 22
    cont = ('<div class="arriba k">%s<div class="sv"><b class="fit">%s</b><span class="et">Freestyle · Liga Global</span></div>'
            '<span class="sem">%s</span></div>'
            '<div class="t5 k"><h1><small>%d jugaron · %d eventos</small>El top 5</h1></div>'
            '<div class="k">%s</div>%s'
            % (logo(d), e(d['nombre']), e(d['semana']), d['jugaron'], len(d['eventos']), ents, pie(d)))
    return armar(d, 'C', False, '<div class="reja"></div><div class="franja" style="top:0"></div>', cont)


CSS_B = CSS_B.replace('ROTO_ABAJO', roto(3, False, True, 2.0, 8)).replace('ROTO_A', roto(5, True, True, 2.4, 2.2)).replace('GRANO', GRANO)

AJUSTAR = """() => {
  for (const el of document.querySelectorAll('.fit2')) {
    const cs = getComputedStyle(el), f0 = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight) / f0;
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom), min = +(el.dataset.min || 96);
    let fs = f0, n = 0;
    while (el.scrollWidth > el.clientWidth + 1 && fs > min && n < 200) { fs -= 2; el.style.fontSize = fs + 'px'; n++; }
    if (el.scrollWidth > el.clientWidth + 1 && /\\s/.test(el.textContent.trim())) {
      el.style.whiteSpace = 'normal'; fs = f0; el.style.fontSize = fs + 'px'; n = 0;
      while ((el.scrollWidth > el.clientWidth + 1 || el.scrollHeight - pad > 2 * fs * lh + 4) && fs > 30 && n < 300) {
        fs -= 2; el.style.fontSize = fs + 'px'; n++;
      }
    } else {
      while (el.scrollWidth > el.clientWidth + 1 && fs > 14 && n < 300) { fs -= 2; el.style.fontSize = fs + 'px'; n++; }
    }
  }
  for (const el of document.querySelectorAll('.fit')) {
    let fs = parseFloat(getComputedStyle(el).fontSize), n = 0;
    while ((el.scrollWidth > el.clientWidth + 1) && fs > 14 && n < 200) { fs -= 2; el.style.fontSize = fs + 'px'; n++; }
  }
  return true;
}"""

MEDIR = """(story) => {
  const c = document.querySelector('#c').getBoundingClientRect();
  const out = {corta: [], fuera: [], seguro: []};
  for (const el of document.querySelectorAll('.fit, .fit2, .ticket li b, .lineas b, .ev b')) {
    if (el.scrollWidth > el.clientWidth + 1) out.corta.push(el.textContent.slice(0, 40));
  }
  const arriba = story ? 250 : 40, abajo = story ? 1920 - 330 : 1350 - 30;
  for (const el of document.querySelectorAll('.k')) {
    const r = el.getBoundingClientRect();
    const t = (el.className + ' ' + el.textContent.slice(0, 30)).trim();
    if (r.left < c.left - 1 || r.right > c.right + 1 || r.top < c.top - 1 || r.bottom > c.bottom + 1) out.fuera.push(t);
    else if (r.top - c.top < arriba || r.bottom - c.top > abajo) out.seguro.push([t, Math.round(r.top - c.top), Math.round(r.bottom - c.top)]);
  }
  return out;
}"""


def documento(cuerpo):
    return '<!doctype html><meta charset="utf-8"><style>%s%s%s%s%s</style>%s' % (fuentes(), CSS_BASE, CSS_A, CSS_B, CSS_C, cuerpo)


PIEZAS = [
    ('A', 'campeon', 'FFA', A_campeon, False), ('A', 'top', 'CH', A_top, False), ('A', 'campeon', 'CH', A_campeon, False),
    ('A', 'story', 'FFA', A_campeon, True),
    ('B', 'campeon', 'FFA', B_campeon, False), ('B', 'top', 'CH', B_top, False), ('B', 'campeon', 'CH', B_campeon, False),
    ('B', 'story', 'FFA', B_campeon, True),
    ('C', 'campeon', 'FFA', C_campeon, False), ('C', 'top', 'CH', C_top, False), ('C', 'campeon', 'CH', C_campeon, False),
    ('C', 'story', 'FFA', C_campeon, True),
    ('A', 'campeon', 'LARGO', A_campeon, False), ('B', 'campeon', 'LARGO', B_campeon, False), ('C', 'campeon', 'LARGO', C_campeon, False),
]


def main():
    import navegador
    navegador.hace_falta()
    from playwright.sync_api import sync_playwright
    from PIL import Image
    D = {sv: cargar(sv) for sv in ('CH', 'FFA')}
    # 🧪 el peor caso, INVENTADO para probar: un nombre largo de tres palabras y tres eventos, uno de nombre larguísimo
    import copy
    L = copy.deepcopy(D['CH'])
    L['c']['n'], L['c']['tit'] = 'Mr Still Ballin', 3
    L['ganados'] = L['ganados'] + [{'n': '999', 'nombre': 'LA GRAN FINAL DEL INTERSERVIDOR DE INVIERNO VOL. 12', 'fecha': '21/11',
                                     'jug': 48, 'nota_camp': 8.8}]
    D['LARGO'] = L
    solo = [a for a in sys.argv[2:] if not a.startswith('--')]
    medidas = {}
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 1080, 'height': 1920}, device_scale_factor=1)
        for dirc, pieza, sv, fn, story in PIEZAS:
            nom = '%s_%s_%s' % (dirc, pieza, sv)
            if solo and not any(s in nom for s in solo):
                continue
            h = documento(fn(D[sv], story) if pieza in ('campeon', 'story') else fn(D[sv]))
            if '--html' in sys.argv:
                io.open(os.path.join(SAL, nom + '.html'), 'w', encoding='utf-8').write(h)
            pg.set_content(h, wait_until='load')
            pg.evaluate('document.fonts.ready.then(() => true)')
            pg.wait_for_timeout(250)
            pg.evaluate(AJUSTAR)
            m = pg.evaluate(MEDIR, story)
            png = pg.locator('#c').screenshot()
            im = Image.open(io.BytesIO(png)).convert('RGB')
            im.save(os.path.join(SAL, nom + '.webp'), 'WEBP', quality=82, method=6)
            im.save(os.path.join(SAL, nom + '.png'))
            medidas[nom] = m
            print('%-18s corta=%s fuera=%s seguro=%s' % (nom, m['corta'], m['fuera'], m['seguro']))
        b.close()
    io.open(os.path.join(SAL, 'medidas.json'), 'w', encoding='utf-8').write(json.dumps(medidas, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass
    main()
