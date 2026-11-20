# -*- coding: utf-8 -*-
"""🗞️ LAS IMÁGENES DE LA SEMANA PARA LAS REDES DE CADA SOCIO (el plan de los tiers, desde el 20/11/2026).

    python bot/redes.py --ver                qué tocaría esta semana, sin dibujar ni subir
    python bot/redes.py --local CH FFA [2026-11-16]   dibuja esos servidores (la última semana cerrada, o la de ese lunes)
                                                       en .cache/redes/ y mide
    python bot/redes.py --aplicar            el paso del ciclo: dibuja, sube a R2, guarda datos/redes.json y avisa
    python bot/redes.py --auto               el self-check (sin navegador ni red)

Dlx, 19/11/2026, el plan: *«Una imagen por semana para sus redes que sean 2. Para tier 1 que sean 5»*; a la maqueta
(20/11): *«me gustan todos y de hecho me gusta este estilo. Guarda este estilo. Aunque creí que la mejor es portada de
revista»*, y a la propuesta de las cinco: *«Sí, ármalo»*. El estilo es el «estilo afiche», dirección **B** (portada de
revista): `docs/estilo_afiche.md`, y su maqueta en `docs/maquetas/redes/`.

QUÉ LLEVA CADA TIER (`PIEZAS_TIER`), de la semana cerrada (lunes a domingo, hora del este):
- 🏆 **campeón** (post 1080×1350): quien ganó más eventos del servidor; con empate, quien sumó más puntos.
- 🔝 **top** (post): los cinco que más puntos sumaron ahí.
- 📱 **historia** (1080×1920, sólo Tier 1): el campeón en historia, dentro de la zona segura.
- 🌙 **evento** (post, sólo Tier 1): su noche más grande (la de más gente): podio, notas y MVP.
- 📅 **viene** (historia, sólo Tier 1): lo que ya anunciaron para la semana que empieza y, si no hay, cuándo suele jugar
  (de los eventos de las últimas 8 semanas), en la hora del país de la mayoría de su gente.

⚠️ SIN DATO NO HAY PIEZA: un servidor sin eventos esa semana no tiene campeón, top ni evento; el top pide 3 personas;
«Lo que viene» pide un anuncio o 3 eventos pasados. Quien no tiene tarjeta va con su silueta, sin cartel.

DÓNDE QUEDA: R2 `redes/<sv>/<pieza>.jpg` (se pisa cada semana: el espacio no crece; la página la pide con `?v=<lunes>`),
`datos/redes.json` (qué semana y qué piezas, `{sv: {s, p, m, mira}}`) → `_pf['redes']` de /api/perfiles → «Tu servidor».
Y si el dueño eligió un canal (`redes` de `cfg:<guild>`, apagado por defecto), un mensaje ahí con las imágenes como LINK a
R2, nunca adjuntas (adjuntar pide un permiso que no todos los chats le dan al bot).

⏰ DESDE EL LUNES A LAS 12 PM ET (como el resumen de la semana del Worker): los resultados del domingo a la noche ya
entraron. Una vez por servidor y semana; si algo falla, se reintenta en la próxima corrida. Nunca frena el ciclo.
"""
import base64
import colorsys
import datetime as dt
import io
import json
import math
import os
import random
import re
import sys
import zoneinfo

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, os.path.join(BASE, 'sheet'), BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

ET = zoneinfo.ZoneInfo('America/New_York')
ARCH = os.path.join(BASE, 'datos', 'redes.json')
CACHE = os.path.join(BASE, '.cache', 'redes')
LEEME = ('🗞️ Las imágenes de la semana para las redes de cada socio (`bot/redes.py`): qué semana se dibujó (`s`, el lunes), '
         'qué piezas (`p`), el mensaje en su canal (`m`) y el último día que se miró si eligió canal (`mira`). Las imágenes '
         'viven en R2, `redes/<sv>/<pieza>.jpg`')
PANEL = 'https://underlegends.pages.dev/freestyle-rap/socio'
DESDE_HORA = 12

#: 🗂️ las piezas: clave → (título, ancho, alto). El orden es el de la página y el del mensaje
PIEZAS = {
    'campeon': ('El campeón de la semana', 1080, 1350),
    'top': ('El top 5', 1080, 1350),
    'historia': ('El campeón, en historia', 1080, 1920),
    'evento': ('El evento de la semana', 1080, 1350),
    'viene': ('Lo que viene', 1080, 1920),
}
#: 🏅 cuántas lleva cada tier (Dlx: «2… para tier 1 que sean 5»). El Tier 3 no lleva
PIEZAS_TIER = {1: ('campeon', 'top', 'historia', 'evento', 'viene'), 2: ('campeon', 'top')}
TOP_MIN = 3
HABITOS_MIN = 3
HABITOS_SEMANAS = 8

NEGRO, PAPEL, VERDE, MAG, ORO = '#030304', '#F2EEE6', '#29B298', '#E41373', '#E7B622'
MESES = ['', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
DIAS = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO']
DIAS_C = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']
#: el país, escrito para leer (la hora de «Lo que viene» va en la de la mayoría de su gente)
PAIS = {'AR': 'Argentina', 'BO': 'Bolivia', 'BR': 'Brasil', 'CL': 'Chile', 'CO': 'Colombia', 'CR': 'Costa Rica',
        'CU': 'Cuba', 'DO': 'República Dominicana', 'EC': 'Ecuador', 'ES': 'España', 'GT': 'Guatemala', 'HN': 'Honduras',
        'MX': 'México', 'NI': 'Nicaragua', 'PA': 'Panamá', 'PE': 'Perú', 'PR': 'Puerto Rico', 'PY': 'Paraguay',
        'SV': 'El Salvador', 'UY': 'Uruguay', 'VE': 'Venezuela'}


# ── lo chico ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def _j(ruta, defecto):
    try:
        with io.open(ruta, encoding='utf-8') as f:
            d = json.load(f)
        return d if isinstance(d, type(defecto)) else defecto
    except (OSError, ValueError):
        return defecto


def e(s):
    return str(s if s is not None else '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def miles(n):
    return '{:,}'.format(int(round(n or 0))).replace(',', '.')


def nota(v):
    return ('%.1f' % v).replace('.', ',') if isinstance(v, (int, float)) else ''


def b64f(ruta, tipo):
    with open(ruta, 'rb') as f:
        return 'data:%s;base64,%s' % (tipo, base64.b64encode(f.read()).decode())


# ── la semana ────────────────────────────────────────────────────────────────────────────────────────────────────────
def semana_cerrada(ahora):
    """`(lunes, domingo)` (fechas) de la última semana entera antes de `ahora` (hora del este), o `None` si todavía no
    toca: el lunes antes de las 12 PM se espera a que entren los resultados del domingo. Pura."""
    a = ahora.astimezone(ET)
    lunes_hoy = a.date() - dt.timedelta(days=a.weekday())
    if a.weekday() == 0 and a.hour < DESDE_HORA:
        return None
    return lunes_hoy - dt.timedelta(days=7), lunes_hoy - dt.timedelta(days=1)


def nro_semana(lunes):
    return lunes.isocalendar()[1]


def etiqueta(ini, fin):
    """«16–22 NOV» o «30 NOV–6 DIC»."""
    if ini.month == fin.month:
        return '%d–%d %s' % (ini.day, fin.day, MESES[fin.month])
    return '%d %s–%d %s' % (ini.day, MESES[ini.month], fin.day, MESES[fin.month])


def piezas_de(tier):
    return list(PIEZAS_TIER.get(tier) or ())


def clave_r2(sv, pieza):
    return 'redes/%s/%s.jpg' % (str(sv).lower(), pieza)


# ── el color del servidor ────────────────────────────────────────────────────────────────────────────────────────────
def _rgb(hx):
    hx = str(hx or '#26045B').lstrip('#')
    return tuple(int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4))


def lum(hx):
    f = lambda c: c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4   # noqa: E731
    r, g, b = _rgb(hx)
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b)


def _hexa(r, g, b):
    return '#%02X%02X%02X' % tuple(max(0, min(255, round(x * 255))) for x in (r, g, b))


def luz(hx):
    """El color del servidor legible sobre negro: si es muy oscuro (FFA, #26045B) se aclara sin perder el tono."""
    h, l, s = colorsys.rgb_to_hls(*_rgb(hx))
    while lum(_hexa(*colorsys.hls_to_rgb(h, l, s))) < .16 and l < .9:
        l += .02
    return _hexa(*colorsys.hls_to_rgb(h, l, s))


def tinta(hx):
    return NEGRO if lum(hx) > .32 else '#FFFFFF'


# ── los datos de la semana de un servidor ────────────────────────────────────────────────────────────────────────────
ORDEN = {'Campeón': 0, 'Subcampeón': 1, 'Tercero': 2, 'Cuarto': 3, 'Semifinal': 4, 'Cuartos': 5, 'Octavos': 6,
         'Dieciseisavos': 7}


def semana_de(sv, ini, fin, llaves, notas, ccs, oficial, clave, limpio):
    """Lo que pasó en ese servidor esa semana, sin imágenes. `ccs` = `{evento: {clave: país}}`; `oficial` = `{clave:
    nombre de la vitrina}`; `clave` y `limpio` son las funciones de `bot/noche.py` (pasadas para poder probarla). Pura."""
    a, b = ini.isoformat(), fin.isoformat()
    evs = sorted((v for v in (llaves or {}).values() if v.get('sv') == sv and a <= str(v.get('dia') or '') <= b),
                 key=lambda v: (str(v.get('dia')), int(v.get('n') or 0)))
    nom = lambda x: oficial.get(clave(x), limpio(x)) if x else ''   # noqa: E731
    gente, out, bat = {}, [], {}
    for v in evs:
        n = str(v.get('n'))
        nt = {clave(k): x for k, x in (((notas or {}).get(n) or {}).get('notas') or {}).items()}
        tabla = v.get('tabla') or []
        por_puesto = lambda p: [f for f in tabla if str(f[1]).startswith(p)]   # noqa: E731
        camp = (por_puesto('Campe') or [None])[0]
        sub = (por_puesto('Subcampe') or [None])[0]
        terceros = por_puesto('Tercer') or por_puesto('Semifinal')
        mvp = ((notas or {}).get(n) or {}).get('mvp') or ''
        for ro in v.get('rondas') or []:
            for bt in (ro.get('b') if isinstance(ro, dict) else []) or []:
                if isinstance(bt, list) and len(bt) >= 2 and isinstance(bt[0], list):
                    g = clave(bt[1]) if bt[1] else ''
                    for x in bt[0]:
                        kx = clave(x)
                        if kx:
                            c = bat.setdefault(kx, [0, 0])
                            c[1] += 1
                            c[0] += kx == g
        n_bat = sum(len((ro.get('b') if isinstance(ro, dict) else []) or []) for ro in v.get('rondas') or [])
        out.append({'n': n, 'nombre': str(v.get('nombre') or '').strip() or 'Evento #%s' % n, 'dia': v.get('dia'),
                    'fecha': v.get('fecha') or '', 'jug': int(v.get('participantes') or len(tabla)), 'bat': n_bat,
                    'camp': nom(camp[0]) if camp else '', 'sub': nom(sub[0]) if sub else '',
                    'terceros': [nom(f[0]) for f in terceros][:2], 'mvp': nom(mvp),
                    'nota_camp': nt.get(clave(camp[0])) if camp else None, 'nota_sub': nt.get(clave(sub[0])) if sub else None,
                    'nota_mvp': nt.get(clave(mvp)) if mvp else None,
                    'k_camp': clave(camp[0]) if camp else '', 'k_sub': clave(sub[0]) if sub else ''})
        for f in tabla:
            k = clave(f[0])
            if not k:
                continue
            g = gente.setdefault(k, {'n': nom(f[0]), 'k': k, 'cc': '', 'pts': 0, 'ev': 0, 'tit': 0, 'mejor': 9, 'nota': None})
            try:
                g['pts'] += int(float(f[2] or 0))
            except (TypeError, ValueError, IndexError):
                pass
            g['ev'] += 1
            p = ORDEN.get(str(f[1]), 8)
            g['mejor'] = min(g['mejor'], p)
            g['tit'] += p == 0
            if nt.get(k) is not None:
                g['nota'] = max(g['nota'] or 0, nt[k])
            g['cc'] = g['cc'] or ((ccs or {}).get(n) or {}).get(k, '')
    top = sorted(gente.values(), key=lambda g: (-g['pts'], -g['tit'], -(g['nota'] or 0), g['n'].lower()))
    for i, g in enumerate(top):
        g['pos'] = i + 1
        g['bg'], g['bj'] = bat.get(g['k'], [0, 0])
    camp = max(top, key=lambda g: (g['tit'], g['pts'])) if top and any(g['tit'] for g in top) else None
    ganados = [x for x in out if camp and x['k_camp'] == camp['k']]
    grande = max(out, key=lambda x: (x['jug'], x['bat'])) if out else None
    return {'sv': sv, 'ini': a, 'fin': b, 'eventos': out, 'top': top[:5], 'jugaron': len(gente),
            'camp': camp, 'ganados': ganados, 'grande': grande}


def zona_de(ccs_temporada):
    """`(zona IANA, país)` de la mayoría de la gente de un servidor; Argentina si no se sabe (la mayoría de la Liga)."""
    import cuando as CU
    cuenta = {}
    for cc in ccs_temporada or []:
        cc = str(cc or '').upper()
        if cc in CU.ZONA_BANDERA:
            cuenta[cc] = cuenta.get(cc, 0) + 1
    cc = max(sorted(cuenta), key=lambda k: cuenta[k]) if cuenta else 'AR'
    return CU.ZONA_BANDERA[cc], PAIS.get(cc, cc)


def habitos(instantes, zona, minimo=HABITOS_MIN):
    """📅 Cuándo suele jugar: `[(día 0-6, 'HH:MM', cuántos)]` de los días con 2 o más eventos (o el más jugado si
    ninguno llega), ordenados por día; la hora es la mediana, redondeada a la media hora. `[]` con menos de `minimo`
    eventos. Pura."""
    z = zoneinfo.ZoneInfo(zona)
    xs = [t.astimezone(z) for t in instantes]
    if len(xs) < minimo:
        return []
    por = {}
    for x in xs:
        por.setdefault(x.weekday(), []).append(x.hour * 60 + x.minute)
    dias = [d for d, v in por.items() if len(v) >= 2] or [max(por, key=lambda d: len(por[d]))]
    out = []
    for d in sorted(dias)[:5]:
        v = sorted(por[d])
        m = v[len(v) // 2]
        m = int(round(m / 30.0) * 30) % (24 * 60)
        out.append((d, '%02d:%02d' % (m // 60, m % 60), len(por[d])))
    return out


def lo_que_viene(sv, calendario, desde, zona, ahora):
    """`{'prox': [(día, 'HH:MM', nombre)], 'habitos': [...], 'zona': país}` de un servidor, del calendario de la web
    (`calendario` del lobby: `{t, n, sv}`, `t` en UTC). Los próximos, de los 7 días que siguen a `desde`; los hábitos, de las
    últimas `HABITOS_SEMANAS`. Pura."""
    z = zoneinfo.ZoneInfo(zona[0])
    fin = desde + dt.timedelta(days=7)
    prox, pasados = [], []
    for c in calendario or []:
        if c.get('sv') != sv or not c.get('t'):
            continue
        try:
            t = dt.datetime.fromisoformat(str(c['t']).replace('Z', '+00:00'))
        except ValueError:
            continue
        if desde <= t < fin and t >= ahora:
            x = t.astimezone(z)
            prox.append((t, (x.weekday(), '%02d:%02d' % (x.hour, x.minute), str(c.get('n') or '').strip(), x.day)))
        elif ahora - dt.timedelta(weeks=HABITOS_SEMANAS) <= t < ahora:
            pasados.append(t)
    return {'prox': [p for _t, p in sorted(prox, key=lambda x: x[0])][:6], 'habitos': habitos(pasados, zona[0]), 'zona': zona[1]}


# ── el dibujo: el «estilo afiche», dirección B (docs/estilo_afiche.md) ──────────────────────────────────────────────
GRANO = ("url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>\")")
CORONA = ('<svg class="corona" viewBox="0 0 48 34" aria-hidden="true">'
          '<path d="M4 12 L14 21 L24 5 L34 21 L44 12 L40 30 L8 30 Z" fill="%s" stroke="#030304" stroke-width="2.4" '
          'stroke-linejoin="round"/><rect x="8" y="26" width="32" height="5" fill="#C8960F" stroke="#030304" stroke-width="2"/>'
          '<circle cx="4" cy="11" r="3.4" fill="%s" stroke="#030304" stroke-width="2"/>'
          '<circle cx="24" cy="4" r="3.6" fill="%s" stroke="#030304" stroke-width="2"/>'
          '<circle cx="44" cy="11" r="3.4" fill="%s" stroke="#030304" stroke-width="2"/></svg>') % (ORO, ORO, ORO, ORO)


def roto(seed, arriba=True, abajo=True, paso=2.2, amp=1.6):
    """Un `clip-path` de papel rasgado, con semilla: sale igual cada vez."""
    rnd = random.Random(seed)
    pts, x = [], 0.0
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


CSS = """
*{box-sizing:border-box}
body{margin:0;background:#030304}
#c{position:relative;overflow:hidden;font-family:Archivo,LigaEmoji,sans-serif;color:#F6F6F4;background:#030304}
#c.post{width:1080px;height:1350px}
#c.story{width:1080px;height:1920px}
.lienzo{position:absolute;left:0;top:0;width:1080px;height:1350px}
#c.story .lienzo{top:255px}
.sigla{position:absolute;left:-20px;right:-20px;top:10px;height:250px;text-align:center;font:900 300px/.86 Archivo,sans-serif;font-stretch:125%;
  color:transparent;-webkit-text-stroke:4px var(--sv-tinta);opacity:.22;white-space:nowrap;overflow:hidden}
.et{font-family:'Barlow Condensed',Archivo,sans-serif;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.grano{position:absolute;inset:0;background-image:GRANO;background-size:240px;opacity:.16;mix-blend-mode:overlay;pointer-events:none;z-index:90}
.fit,.fit2{display:block;white-space:nowrap;overflow:hidden;padding-top:.14em;margin-top:-.14em}
.nw{white-space:nowrap}
img.fl{height:.62em;width:auto;vertical-align:.08em;margin-left:.22em;box-shadow:0 0 0 2px rgba(0,0,0,.5)}
.titular h1 img.fl{height:.36em;vertical-align:.3em;margin-left:.16em;box-shadow:0 0 0 3px #030304}
.corona{position:absolute;width:96px;height:auto;left:50%;transform:translateX(-50%) rotate(-5deg);filter:drop-shadow(0 4px 0 #030304)}
.sinc{position:relative;background:#030304;clip-path:polygon(0 6%,50% 0,100% 6%,100% 88%,50% 100%,0 88%)}
.sinc-in{position:absolute;inset:8px;background:var(--sv);overflow:hidden;display:flex;align-items:flex-end;justify-content:center;
  clip-path:polygon(0 6%,50% 0,100% 6%,100% 88%,50% 100%,0 88%)}
.sinc-in::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 35%,rgba(255,255,255,.35),transparent 60%),
  repeating-conic-gradient(from 0deg at 50% 38%,rgba(0,0,0,.18) 0 6deg,transparent 6deg 14deg)}
.sinc .sil{position:relative;height:80%;width:auto;margin-bottom:7%}
.pie{position:absolute;left:64px;right:64px;bottom:44px;display:flex;align-items:center;gap:18px}
.pie .ul{width:64px;height:64px;object-fit:contain}
.pie-t{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}
.pie-t b{font:900 26px/1 Archivo,sans-serif;letter-spacing:.06em}
.pie-t span{font:700 21px/1 'Barlow Condensed',sans-serif;letter-spacing:.06em;opacity:.8}
.pie .nro{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.pie .nro b{font:900 34px/1 Archivo,sans-serif;font-stretch:115%}
.pie .nro span{font:700 20px/1 'Barlow Condensed',sans-serif;letter-spacing:.2em;opacity:.8}
.cabeza-fondo{position:absolute;left:0;right:0;top:0;height:300px;background:var(--sv)}
.cabeza{position:absolute;left:0;right:0;top:0;height:222px;background:var(--sv);color:var(--sv-tinta);z-index:10;clip-path:ROTO_ABAJO}
.cabeza .linea{position:absolute;left:56px;right:56px;top:40px;display:flex;justify-content:space-between;align-items:center;
  font:700 26px/1 'Barlow Condensed',sans-serif;letter-spacing:.16em;text-transform:uppercase}
.cabeza .linea .logo{width:58px;height:58px;object-fit:contain;background:#030304;padding:4px}
.cabeza .linea span{display:flex;align-items:center;gap:14px}
.cabeza .mast{position:absolute;left:44px;right:44px;top:98px;font:900 100px/.9 Archivo,sans-serif;font-stretch:125%;text-transform:uppercase;letter-spacing:-.01em}
.papel{position:absolute;background:#F2EEE6;color:#030304;z-index:12}
.papel::after{content:'';position:absolute;inset:0;background-image:GRANO;background-size:240px;opacity:.5;mix-blend-mode:multiply;pointer-events:none}
.titular{left:40px;width:590px;top:272px;padding:30px 30px 28px 38px;clip-path:ROTO_A;transform:rotate(-1.5deg)}
.titular .et{display:inline-block;background:#E41373;color:#fff;font-size:28px;padding:8px 12px}
.titular h1{margin:calc(14px - .14em) 0 0;font:900 150px/.86 Archivo,sans-serif;font-stretch:118%;text-transform:uppercase}
.titular h2{margin:14px 0 0;font:900 52px/1.02 Archivo,sans-serif;text-transform:uppercase}
.titular h2 .et{display:block;font-size:30px;letter-spacing:.16em;margin-bottom:8px;background:none;color:#030304;padding:0}
.titular h2 em{font-style:normal;background:#030304;color:#F2EEE6;padding:0 10px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.titular.ancho{width:1000px}
.portadas{position:absolute;left:56px;width:560px;top:720px;z-index:12;display:flex;flex-direction:column;gap:22px}
.portadas div{display:flex;align-items:baseline;gap:16px}
.portadas b{font:900 78px/1 Archivo,sans-serif;color:var(--sv-luz);min-width:0}
.portadas span{font:700 28px/1.05 'Barlow Condensed',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#E8E8E4}
.portada{position:absolute;right:44px;top:290px;width:450px;height:608px;z-index:14;transform:rotate(4deg)}
.portada .carta{position:absolute;inset:0;height:100%;width:auto;margin:auto;filter:drop-shadow(12px 12px 0 #29B298)}
.portada .carta.sinc{width:100%;filter:none}
.portada .corona{top:-56px}
.sticker{position:absolute;z-index:20;right:400px;top:800px;width:190px;height:190px;border-radius:50%;background:#E7B622;color:#030304;border:5px solid #030304;
  display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-8deg);box-shadow:8px 8px 0 #030304}
.sticker b{font:900 68px/.9 Archivo,sans-serif}
.sticker span{font:700 24px/1 'Barlow Condensed',sans-serif;letter-spacing:.12em;text-transform:uppercase}
.lineas{position:absolute;left:56px;right:56px;z-index:12;display:flex;flex-direction:column;gap:0}
.lineas div{display:flex;align-items:baseline;gap:18px;padding:18px 0;height:76px;border-top:3px solid #F6F6F4}
.lineas div:last-child{border-bottom:3px solid #F6F6F4}
.lineas i{font:900 40px/1 Archivo,sans-serif;font-style:normal;color:var(--sv-luz);flex:none}
.lineas b{font:900 34px/1.05 Archivo,sans-serif;text-transform:uppercase;flex:1;min-width:0}
.lineas span{font:700 26px/1 'Barlow Condensed',sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#CFCFCA;white-space:nowrap}
.lineas.grandes div{height:96px;padding:22px 0}
.lineas.grandes i{font-size:46px;min-width:150px}
.lineas.grandes b{font-size:44px}
.lineas.grandes span{font-size:34px;color:#F6F6F4}
.t5h{position:absolute;left:56px;right:56px;top:262px;z-index:12;display:flex;align-items:flex-end;justify-content:space-between}
.t5h h1{margin:0;font:900 112px/.86 Archivo,sans-serif;font-stretch:122%;text-transform:uppercase}
.t5h span{font:700 30px/1 'Barlow Condensed',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--sv-luz);padding-bottom:8px}
.tira{left:44px;right:44px;height:122px;display:flex;align-items:center;gap:22px;padding:0 26px 0 0}
.tira .num{width:118px;height:100%;flex:none;display:grid;place-items:center;background:#030304;color:#F2EEE6;font:900 92px/1 Archivo,sans-serif}
.tira.n1 .num{background:var(--sv);color:var(--sv-tinta)}
.tira .av{width:76px;height:102px;flex:none;object-fit:contain}
.tira .q{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.tira .q b{font:900 42px/1 Archivo,sans-serif;text-transform:uppercase}
.tira .q span{font:700 24px/1 'Barlow Condensed',sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#4A4A4E}
.tira .pts{font:900 44px/1 Archivo,sans-serif;white-space:nowrap;text-align:right}
.tira .pts small{display:block;font:700 20px/1 'Barlow Condensed',sans-serif;letter-spacing:.14em;color:#4A4A4E}
.podio2{position:absolute;right:56px;top:300px;width:420px;height:560px;z-index:14}
.podio2 .uno,.podio2 .dos{position:absolute;display:flex;justify-content:center}
.podio2 .uno{right:0;top:30px;width:318px;height:430px;z-index:3;transform:rotate(4deg);filter:drop-shadow(10px 10px 0 #29B298)}
.podio2 .dos{left:-30px;top:150px;width:252px;height:340px;z-index:2;transform:rotate(-6deg);filter:drop-shadow(8px 8px 0 #030304) brightness(.82)}
.podio2 .carta{display:block;height:100%;width:auto}
.podio2 .carta.sinc{width:100%}
.podio2 .corona{left:auto;right:150px;top:-26px;transform:rotate(6deg)}
.vacio{position:absolute;left:56px;right:56px;top:700px;z-index:12;font:700 34px/1.3 'Barlow Condensed',sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#E8E8E4}
""".replace('GRANO', GRANO).replace('ROTO_ABAJO', roto(3, False, True, 2.0, 8)).replace('ROTO_A', roto(5, True, True, 2.4, 2.2))

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

#: 📏 lo que se mide en cada imagen: un texto cortado, algo fuera del lienzo, algo clave fuera de la zona segura (en una
#: historia, 250 px arriba y 330 abajo) y dos piezas clave que se pisan
MEDIR = """(story) => {
  const c = document.querySelector('#c').getBoundingClientRect();
  const out = [];
  for (const el of document.querySelectorAll('.fit, .fit2')) {
    if (el.scrollWidth > el.clientWidth + 1)
      out.push('se corta: ' + el.textContent.slice(0, 40));
  }
  const arriba = story ? 250 : 0, abajo = story ? 1920 - 330 : 1350;
  const ks = [...document.querySelectorAll('.k')].map((el) => [el, el.getBoundingClientRect()]).filter(([, r]) => r.width && r.height);
  for (const [el, r] of ks) {
    const t = el.className.split(' ')[0];
    if (r.left < c.left - 1 || r.right > c.right + 1 || r.top < c.top - 1 || r.bottom > c.bottom + 1) out.push('fuera: ' + t);
    else if (story && (r.top - c.top < arriba || r.bottom - c.top > abajo)) out.push('zona segura: ' + t);
  }
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    const [a, ra] = ks[i], [b, rb] = ks[j];
    if (a.contains(b) || b.contains(a) || a.dataset.pisa || b.dataset.pisa) continue;
    if (ra.right > rb.left + 2 && rb.right > ra.left + 2 && ra.bottom > rb.top + 2 && rb.bottom > ra.top + 2)
      out.push('se pisan: ' + a.className.split(' ')[0] + ' y ' + b.className.split(' ')[0]);
  }
  return out;
}"""


def _fl(g):
    return '<img class="fl" src="%s" alt="">' % g['fl'] if g.get('fl') else ''


def nombre_fl(g):
    """El nombre con su bandera, la bandera pegada a la última palabra: si baja de renglón, no queda sola."""
    partes = str(g.get('n') or '').split()
    if len(partes) < 2:
        return '<span class="nw">%s%s</span>' % (e(g.get('n')), _fl(g))
    return '%s <span class="nw">%s%s</span>' % (e(' '.join(partes[:-1])), e(partes[-1]), _fl(g))


def carta(g, clase='carta'):
    """La tarjeta de verdad; sin tarjeta, su silueta sobre los rayos del servidor (sin cartel: en un festejo, sobra)."""
    if g.get('carta'):
        return '<img class="%s" src="%s" alt="">' % (clase, g['carta'])
    return '<div class="%s sinc"><div class="sinc-in"><img class="sil" src="%s" alt=""></div></div>' % (clase, g.get('sil') or '')


def detalle(g):
    if g['tit'] >= 2:
        return '%d títulos' % g['tit']
    if g['tit'] == 1:
        return 'campeón'
    return {1: 'subcampeón', 2: 'tercero', 3: 'cuarto'}.get(g['mejor'], '%d evento%s' % (g['ev'], 's' if g['ev'] > 1 else ''))


def sello(g):
    if g['tit'] >= 2:
        return '<b>×%d</b><span>títulos</span>' % g['tit']
    return '<span>nota</span><b>%s</b>' % nota(g['nota']) if g.get('nota') is not None else '<b>#1</b><span>de la semana</span>'


def _vars(d):
    return '--sv:%s;--sv-luz:%s;--sv-tinta:%s' % (d['color'], luz(d['color']), tinta(d['color']))


def _logo(d):
    return '<img class="logo" src="%s" alt="">' % d['logo'] if d.get('logo') else ''


def cabeza(d, arriba='La semana de'):
    return ('<div class="cabeza k"><div class="linea"><span>%s%s</span><span>N.º %d · %s</span></div>'
            '<div class="mast fit">%s</div></div>' % (_logo(d), e(arriba), d['nro'], e(d['semana']), e(d['nombre'])))


def pie(d):
    return ('<div class="pie k"><img class="ul" src="%s" alt=""><div class="pie-t"><b>LIGA GLOBAL</b>'
            '<span>Toda la semana en underlegends.pages.dev</span></div><div class="nro"><b>N.º %d</b><span>%s</span></div></div>'
            % (d['ul'], d['nro'], e(d['sv'])))


def armar(d, story, cont):
    """El post (1080×1350) o la historia (1080×1920): la historia es el MISMO lienzo, corrido a la zona segura."""
    extra = '<div class="cabeza-fondo"></div><div class="sigla">%s</div>' % e(d['sv']) if story else ''
    return ('<!doctype html><meta charset="utf-8"><style>%s%s</style><div id="c" class="%s" style="%s">%s<div class="lienzo">%s'
            '</div><div class="grano"></div></div>' % (d['fuentes'], CSS, 'story' if story else 'post', _vars(d), extra, cont))


def html_campeon(d, story=False):
    g = d['camp']
    if g['tit'] >= 2:
        h2 = 'Se lleva <em>%d</em> en una semana' % g['tit']
    else:
        h2 = '<span class="et">Gana</span><em>%s</em>' % e(d['ganados'][0]['nombre']) if d['ganados'] else ''
    rivales = sum(max(0, x['jug'] - 1) for x in d['ganados'])
    filas = [(miles(g['pts']), 'puntos de la semana'),
             (str(rivales), 'rivales en %s' % ('sus llaves' if len(d['ganados']) > 1 else 'la llave'))]
    if g.get('bj'):
        filas.append(('%d/%d' % (g['bg'], g['bj']), 'batallas ganadas'))
    filas = filas[:3 if len(d['ganados']) < 3 else 2]
    portadas = ''.join('<div><b>%s</b><span>%s</span></div>' % (v, t) for v, t in filas)
    n = max(1, min(3, len(d['ganados'])))
    lineas = ''.join('<div><i>%s</i><b class="fit">%s</b><span>entre %d · nota %s</span></div>'
                     % (e(x['fecha']), e(x['nombre']), x['jug'], nota(x['nota_camp'])) for x in d['ganados'][:3])
    return armar(d, story, (
        '%s<div class="papel titular k"><span class="et">Campeón de la semana</span><h1 class="fit2" data-min="96">%s</h1>'
        '<h2>%s</h2></div><div class="portadas k">%s</div><div class="portada">%s%s</div><div class="sticker k" data-pisa="1">%s</div>'
        '<div class="lineas k" style="top:%dpx">%s</div>%s'
        % (cabeza(d), nombre_fl(g), h2, portadas, CORONA, carta(g), sello(g), 1222 - n * 76, lineas, pie(d))))


def html_top(d):
    tiras = ''
    for i, g in enumerate(d['top'][:5]):
        tiras += ('<div class="papel tira%s" style="top:%dpx;clip-path:%s;transform:rotate(%.1fdeg)"><span class="num">%d</span>%s'
                  '<div class="q"><b class="fit">%s</b><span>%s%s</span></div><div class="pts">%s<small>PTS</small></div></div>'
                  % (' n1' if g['pos'] == 1 else '', 420 + i * 140, roto(20 + i, True, True, 3, 4), (-.8, .6, -.4, .7, -.5)[i],
                     g['pos'], carta(g, 'av'), e(g['n']) + _fl(g), detalle(g),
                     ' · nota %s' % nota(g['nota']) if g.get('nota') is not None else '', miles(g['pts'])))
    return armar(d, False, '%s<div class="t5h k"><h1>El top 5</h1><span>%d jugaron · %d evento%s</span></div><div class="k">%s</div>%s'
                 % (cabeza(d), d['jugaron'], len(d['eventos']), 's' if len(d['eventos']) != 1 else '', tiras, pie(d)))


def html_evento(d):
    x = d['grande']
    camp = d['personas'].get(x['k_camp']) or {'n': x['camp'], 'tit': 0, 'nota': x['nota_camp']}
    sub = d['personas'].get(x['k_sub'])
    filas = []
    if x['camp']:
        filas.append(('Campeón', x['camp'], 'nota %s' % nota(x['nota_camp']) if x['nota_camp'] is not None else ''))
    if x['sub']:
        filas.append(('Final', x['sub'], 'nota %s' % nota(x['nota_sub']) if x['nota_sub'] is not None else ''))
    if x['terceros']:
        filas.append(('Semis', ' · '.join(x['terceros']), ''))
    if x['mvp'] and x['mvp'].lower() != (x['camp'] or '').lower():
        filas.append(('MVP', x['mvp'], 'nota %s' % nota(x['nota_mvp']) if x['nota_mvp'] is not None else ''))
    lineas = ''.join('<div><i>%s</i><b class="fit">%s</b><span>%s</span></div>' % (e(a.upper()), e(b), e(c)) for a, b, c in filas)
    portadas = ''.join('<div><b>%s</b><span>%s</span></div>' % (v, t) for v, t in (
        (str(x['jug']), 'jugaron'), (str(x['bat']), 'batallas')) if v and v != '0')
    podio = '<div class="podio2">%s<div class="uno">%s</div>%s</div>' % (
        CORONA, carta(camp), ('<div class="dos">%s</div>' % carta(sub)) if sub else '')
    return armar(d, False, (
        '%s<div class="papel titular k"><span class="et">El evento de la semana</span><h1 class="fit2" data-min="64">%s</h1>'
        '<h2><span class="et">%s</span></h2></div><div class="portadas k" style="top:%dpx">%s</div>%s'
        '<div class="lineas k" style="top:%dpx">%s</div>%s'
        % (cabeza(d), e(x['nombre']), e(_fecha_larga(x['dia'])), 700, portadas, podio, 1222 - len(filas) * 76, lineas, pie(d))))


def html_viene(d):
    v = d['viene']
    if v['prox']:
        filas = ''.join('<div><i>%s %d</i><b class="fit">%s</b><span>%s</span></div>' % (DIAS_C[a], dia, e(n or 'Evento'), h)
                        for a, h, n, dia in v['prox'])
        tit, sub = 'Esta semana', '%d evento%s anunciado%s' % (len(v['prox']), 's' if len(v['prox']) != 1 else '', 's' if len(v['prox']) != 1 else '')
        n_f = len(v['prox'])
    else:
        filas = ''.join('<div><i>%s</i><b class="fit">%s</b><span>%d %s en %d semanas</span></div>'
                        % (DIAS[a], h, n, 'vez' if n == 1 else 'veces', HABITOS_SEMANAS) for a, h, n in v['habitos'])
        tit, sub = 'Cuándo se juega', 'lo que suele jugar'
        n_f = len(v['habitos'])
    return armar(d, True, (
        '%s<div class="papel titular ancho k"><span class="et">Lo que viene</span><h1 class="fit2" data-min="80">%s</h1>'
        '<h2><span class="et">%s · hora de %s</span></h2></div>'
        '<div class="lineas grandes k" style="top:%dpx">%s</div>%s'
        % (cabeza(d, 'En'), e(tit), e(sub), e(v['zona']), 640, filas, pie(d))))


def _fecha_larga(dia):
    try:
        f = dt.date.fromisoformat(str(dia))
    except ValueError:
        return ''
    return '%s %d de %s' % (DIAS[f.weekday()].capitalize(), f.day, MESES[f.month].lower())


# ── juntar lo de un servidor ─────────────────────────────────────────────────────────────────────────────────────────
def preparar(sv, ini, fin, ahora, calendario=None):
    """Todo lo que hace falta para dibujar las piezas de un servidor (con las tarjetas embebidas), o `None` si no hay nada."""
    import kit as K
    import noche as NO
    from comun import banderas as BA
    D = NO.cargar()
    vit = _j(os.path.join(BASE, 'datos', 't1_vitrina_temporada.json'), {})
    cab = vit.get('cabecera') or []
    iR = cab.index('Rapero') if 'Rapero' in cab else 1
    oficial = {NO.clave(f[iR]): NO.limpio(f[iR]) for f in vit.get('filas') or [] if len(f) > iR}
    ccs = {n: {NO.clave(r['n']): r['cc'] for r in rs} for n, rs in D['RES'].items()}
    s = semana_de(sv, ini, fin, D['LL'], _j(os.path.join(BASE, 'datos', 'notas_eventos.json'), {}), ccs, oficial,
                  NO.clave, NO.limpio)
    ccs_sem = {}
    for x in s['eventos']:
        ccs_sem.update(ccs.get(x['n']) or {})
    personas = {}

    def persona(k, n):
        """La persona con su bandera y su tarjeta (o su silueta), una sola vez aunque salga en dos piezas."""
        if not k:
            return None
        if k in personas:
            return personas[k]
        g = (next((x for x in s['top'] if x['k'] == k), None) or (s['camp'] if s['camp'] and s['camp']['k'] == k else None)
             or {'n': n, 'k': k, 'cc': ccs_sem.get(k, ''), 'tit': 0, 'nota': None, 'pts': 0, 'ev': 0, 'mejor': 9})
        try:
            g['fl'] = BA.src(g['cc']) if g.get('cc') and len(g['cc']) == 2 else ''
        except Exception:                                # noqa: BLE001
            g['fl'] = ''
        g['carta'] = NO.carta(g['n'], sv)
        g['sil'] = '' if g['carta'] else K._sil_vs(g['n'])
        personas[k] = g
        return g
    for g in s['top']:
        persona(g['k'], g['n'])
    if s['camp']:
        s['camp'] = persona(s['camp']['k'], s['camp']['n'])
    if s['grande']:
        persona(s['grande']['k_camp'], s['grande']['camp'])
        persona(s['grande']['k_sub'], s['grande']['sub'])
    s['personas'] = personas
    # 🌍 la hora de «Lo que viene»: la del país de la mayoría de su gente en la temporada
    gente_sv = [cc for n, x in D['EV'].items() if x.get('sv') == sv for cc in (ccs.get(n) or {}).values()]
    zona = zona_de(gente_sv)
    s['viene'] = lo_que_viene(sv, calendario or [], dt.datetime.combine(fin + dt.timedelta(days=1), dt.time(0), ET), zona, ahora)
    sd = K._sv_datos(sv)
    s.update({'nombre': sd['nombre'], 'color': sd['color'], 'logo': sd['logo'], 'nro': nro_semana(ini),
              'semana': etiqueta(ini, fin), 'fuentes': K._fuentes(),
              'ul': b64f(os.path.join(SCR, 'paginas', 'ul-blanco.png'), 'image/png')})
    return s


def que_piezas(s, tier):
    """Las piezas que se pueden dibujar para ese servidor esa semana: las de su tier que tienen dato."""
    out = []
    for p in piezas_de(tier):
        if p in ('campeon', 'historia') and not s.get('camp'):
            continue
        if p == 'top' and len(s.get('top') or []) < TOP_MIN:
            continue
        if p == 'evento' and not (s.get('grande') and s['grande'].get('camp')):
            continue
        if p == 'viene' and not ((s.get('viene') or {}).get('prox') or (s.get('viene') or {}).get('habitos')):
            continue
        out.append(p)
    return out


def html_de(s, pieza):
    return {'campeon': lambda: html_campeon(s), 'top': lambda: html_top(s), 'historia': lambda: html_campeon(s, True),
            'evento': lambda: html_evento(s), 'viene': lambda: html_viene(s)}[pieza]()


def dibujar(s, piezas, pg, carpeta):
    """`{pieza: (ruta del jpg, problemas)}`. `pg` es una página de Playwright."""
    from PIL import Image
    os.makedirs(carpeta, exist_ok=True)
    out = {}
    for p in piezas:
        _t, w, h = PIEZAS[p]
        pg.set_viewport_size({'width': w, 'height': h})
        pg.set_content(html_de(s, p), wait_until='load')
        pg.evaluate('document.fonts.ready.then(() => true)')
        pg.wait_for_timeout(200)
        pg.evaluate(AJUSTAR)
        prob = pg.evaluate(MEDIR, h > 1400)
        png = pg.locator('#c').screenshot()
        ruta = os.path.join(carpeta, '%s_%s.jpg' % (s['sv'].lower(), p))
        Image.open(io.BytesIO(png)).convert('RGB').save(ruta, 'JPEG', quality=90, optimize=True, progressive=True)
        out[p] = (ruta, prob)
    return out


# ── el mensaje en el canal del dueño ─────────────────────────────────────────────────────────────────────────────────
def mensaje(s, urls):
    """El mensaje de Componentes V2 (`flags` 32768) con las imágenes como links de R2. Sin menciones. Puro."""
    texto = ('🗞️ **Tus imágenes de la semana** · %s\nListas para Instagram y TikTok: guárdalas desde acá o desde tu panel, '
             '%s' % (s['semana'], PANEL))
    items = [{'media': {'url': u}, 'description': PIEZAS[p][0]} for p, u in urls]
    return {'flags': 32768, 'allowed_mentions': {'parse': []},
            'components': [{'type': 10, 'content': texto}, {'type': 12, 'items': items[:10]}]}


def _cfg(gid):
    import aviso_ganadores as AG
    return AG._cfg(gid)


def avisar_canal(sv, gid, s, urls, guardado, hoy):
    """Lo deja en el canal que eligió el dueño (`redes` de `cfg:<guild>`), una vez por semana; sin canal, se vuelve a
    mirar al día siguiente. Nunca levanta."""
    if guardado.get('m') or guardado.get('mira') == hoy or not gid:
        return
    guardado['mira'] = hoy
    cfg = _cfg(gid)
    canal = str((cfg or {}).get('redes') or '')
    if not re.match(r'^[0-9]{15,22}$', canal):
        return
    try:
        import escuchar as E
        r = E.sesion().post('https://discord.com/api/v10/channels/%s/messages' % canal, json=mensaje(s, urls), timeout=30)
    except Exception as ex:                              # noqa: BLE001
        print('      ⚠️ %s: no pude mandarlas a su canal (%r)' % (sv, ex))
        return
    if r.status_code in (200, 201):
        guardado['m'] = str((r.json() or {}).get('id') or 'ok')
        print('      📨 %s: en su canal' % sv)
    elif r.status_code in (403, 404):
        guardado['m'] = 'sin_permiso_%d' % r.status_code
        print('      ⚠️ %s: Discord no deja escribir en su canal (%d)' % (sv, r.status_code))
    else:
        print('      ⚠️ %s: Discord contestó %d, se reintenta mañana' % (sv, r.status_code))


# ── el paso del ciclo ────────────────────────────────────────────────────────────────────────────────────────────────
def _calendario():
    """El calendario de la web (lobby de KV): lo anunciado y lo jugado, con su hora. `[]` si no se puede leer."""
    try:
        import subir_datos as SD
        r = SD.sesion().get('%s/values/web:lobby' % SD.API, timeout=45)
        if r.status_code == 200:
            return (json.loads(r.content.decode('utf-8')) or {}).get('calendario') or []
    except Exception as ex:                              # noqa: BLE001
        print('   · sin KV (%r): el calendario sale de la página' % str(ex)[:60])
    try:
        import requests
        r = requests.get('https://underlegends.pages.dev/api/lobby', timeout=45)
        return (r.json() or {}).get('calendario') or [] if r.status_code == 200 else []
    except Exception as ex:                              # noqa: BLE001
        print('   ⚠️ sin el calendario (%r): «Lo que viene» queda para la próxima' % ex)
        return []


def correr(aplicar=True, solo=None, local=False, ahora=None, desde=None):
    ahora = ahora or dt.datetime.now(ET)
    sem = (desde, desde + dt.timedelta(days=6)) if desde else semana_cerrada(ahora)
    if not sem:
        print('   🗞️ todavía no: las imágenes de la semana salen desde el lunes a las %d PM ET' % (DESDE_HORA - 12 or 12))
        return 0
    ini, fin = sem
    import tiers
    niv = tiers.niveles()
    G = _j(ARCH, {}) or {}
    G.setdefault('sv', {})
    pend = [(sv, t) for sv, t in sorted(niv.items()) if t in PIEZAS_TIER and (not solo or sv in solo)
            and (local or (G['sv'].get(sv) or {}).get('s') != ini.isoformat())]
    hoy = ahora.astimezone(ET).date().isoformat()
    # 📨 los de esta semana ya dibujados: el canal, si lo eligieron después
    if aplicar and not local:
        import chats as CH
        gids = dict(CH.servidores())
        for sv, x in G['sv'].items():
            if x.get('s') == ini.isoformat() and not x.get('m') and x.get('p'):
                import subir_cartas as SC
                urls = [(p, '%s/%s?v=%s' % (SC.PUBLICA, clave_r2(sv, p), x['s'])) for p in x['p']]
                avisar_canal(sv, gids.get(sv), {'semana': etiqueta(ini, fin)}, urls, x, hoy)
    if not pend:
        print('   🗞️ las imágenes de la semana del %s ya están' % etiqueta(ini, fin))
        _guardar(G, aplicar and not local)
        return 0
    print('   🗞️ la semana del %s: %s' % (etiqueta(ini, fin), ', '.join('%s (T%d)' % p for p in pend)))
    if not aplicar and not local:
        return 0
    cal = _calendario()
    import navegador
    navegador.hace_falta()
    from playwright.sync_api import sync_playwright
    hechos = 0
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--no-sandbox'])
        try:
            pg = b.new_page(viewport={'width': 1080, 'height': 1350}, device_scale_factor=1)
            gids = {}
            if not local:
                import chats as CH
                gids = dict(CH.servidores())
            for sv, tier in pend:
                try:
                    s = preparar(sv, ini, fin, ahora, cal)
                    piezas = que_piezas(s, tier)
                    if not piezas:
                        print('      · %s: sin eventos esa semana, no hay imágenes' % sv)
                        if not local:
                            G['sv'][sv] = {'s': ini.isoformat(), 'p': []}
                        continue
                    hechas = dibujar(s, piezas, pg, CACHE)
                    for p, (ruta, prob) in hechas.items():
                        print('      %s %s/%s%s' % ('⚠️' if prob else '✅', sv, p, (': ' + '; '.join(prob[:4])) if prob else ''))
                    if local:
                        hechos += 1
                        continue
                    import kit as K
                    urls = []
                    for p in piezas:
                        u = K.subir(hechas[p][0], clave_r2(sv, p), 'image/jpeg')
                        urls.append((p, '%s?v=%s' % (u, ini.isoformat())))
                    x = {'s': ini.isoformat(), 'p': piezas}
                    G['sv'][sv] = x
                    avisar_canal(sv, gids.get(sv), s, urls, x, hoy)
                    hechos += 1
                except Exception as ex:                  # noqa: BLE001
                    print('      ⚠️ %s: las imágenes no salieron (%r): se reintenta en la próxima corrida' % (sv, ex))
        finally:
            b.close()
    _guardar(G, aplicar and not local)
    return hechos


def _guardar(G, escribir):
    if not escribir:
        return
    nuevo = {'_leeme': LEEME, 'sv': {k: G['sv'][k] for k in sorted(G['sv'])}}
    if _j(ARCH, {}) != nuevo:
        with io.open(ARCH, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(nuevo, f, ensure_ascii=False, indent=1)
            f.write('\n')


def para_web():
    """`{t: {pieza: [título, ancho, alto]}, sv: {sv: [lunes, [piezas]]}}` para `_pf['redes']` (bot/subir_web.py): lo que
    «Tu servidor» muestra para bajar. Los títulos viajan para no escribirlos dos veces. `{}` mientras no haya ninguna."""
    G = _j(ARCH, {})
    sv = {k: [x.get('s'), x.get('p')] for k, x in sorted((G.get('sv') or {}).items()) if x.get('s') and x.get('p')}
    return {'t': {p: list(v) for p, v in PIEZAS.items()}, 'sv': sv} if sv else {}


# ── el self-check ────────────────────────────────────────────────────────────────────────────────────────────────────
def _self_check():
    mal = 0

    def ok(c, q):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '❌', q))
    lun = dt.datetime(2026, 11, 23, 11, 59, tzinfo=ET)
    ok(semana_cerrada(lun) is None, 'el lunes antes de las 12 PM ET todavía no: entran los resultados del domingo')
    ok(semana_cerrada(lun + dt.timedelta(minutes=1)) == (dt.date(2026, 11, 16), dt.date(2026, 11, 22)),
       'desde el lunes a las 12, la semana cerrada (lunes a domingo)')
    ok(semana_cerrada(dt.datetime(2026, 11, 26, 3, 0, tzinfo=ET)) == (dt.date(2026, 11, 16), dt.date(2026, 11, 22)),
       'el resto de la semana, la misma')
    ok(etiqueta(dt.date(2026, 11, 16), dt.date(2026, 11, 22)) == '16–22 NOV'
       and etiqueta(dt.date(2026, 11, 30), dt.date(2026, 12, 6)) == '30 NOV–6 DIC', 'la etiqueta de la semana')
    ok(piezas_de(1) == ['campeon', 'top', 'historia', 'evento', 'viene'] and piezas_de(2) == ['campeon', 'top'] and not piezas_de(3),
       'cinco el Tier 1, dos el Tier 2, ninguna el Tier 3')
    ok(clave_r2('FFA', 'top') == 'redes/ffa/top.jpg', 'la clave en R2 se pisa cada semana (el espacio no crece)')
    ok(luz('#26045B') != '#26045B' and lum(luz('#26045B')) >= .16 and luz('#F2A900') == '#F2A900', 'un color muy oscuro se aclara; uno claro no')
    # los datos de una semana inventada
    k = lambda x: re.sub(r'[^a-z0-9]', '', str(x).lower())   # noqa: E731
    L = {'1': {'n': 1, 'sv': 'AAA', 'dia': '2026-11-17', 'fecha': '17/11', 'nombre': 'COPA', 'participantes': 12,
               'tabla': [['Ana', 'Campeón', 1000], ['Bea', 'Subcampeón', 750], ['Cris', 'Tercero', 300], ['Dani', 'Cuartos', 200]],
               'rondas': [{'b': [[['Ana', 'Bea'], 'Ana', '']]}]},
         '2': {'n': 2, 'sv': 'AAA', 'dia': '2026-11-19', 'fecha': '19/11', 'nombre': 'COPA 2', 'participantes': 8,
               'tabla': [['Ana', 'Campeón', 1000], ['Cris', 'Subcampeón', 750], ['Bea', 'Tercero', 300]]},
         '3': {'n': 3, 'sv': 'BBB', 'dia': '2026-11-18', 'tabla': [['Eva', 'Campeón', 1000]]},
         '4': {'n': 4, 'sv': 'AAA', 'dia': '2026-11-24', 'tabla': [['Bea', 'Campeón', 1000]]}}
    s = semana_de('AAA', dt.date(2026, 11, 16), dt.date(2026, 11, 22), L, {'1': {'mvp': 'Bea', 'notas': {'Ana': 8.0, 'Bea': 8.5}}},
                  {'1': {'ana': 'ar'}}, {'ana': 'Ana'}, k, lambda x: str(x).strip())
    ok(len(s['eventos']) == 2 and s['camp']['n'] == 'Ana' and s['camp']['tit'] == 2 and len(s['ganados']) == 2,
       'el campeón es quien ganó más eventos de ESE servidor esa semana (no los de otro ni los de la que viene)')
    ok([g['n'] for g in s['top']] == ['Ana', 'Bea', 'Cris', 'Dani'] and s['top'][0]['pts'] == 2000 and s['top'][0]['cc'] == 'ar',
       'el top, por puntos de la semana')
    ok(s['grande']['n'] == '1' and s['grande']['mvp'] == 'Bea' and s['grande']['nota_mvp'] == 8.5 and s['grande']['bat'] == 1,
       'el evento de la semana es el de más gente, con su MVP')
    ok(que_piezas(dict(s, viene={'prox': [], 'habitos': []}), 1) == ['campeon', 'top', 'historia', 'evento']
       and que_piezas(dict(s, top=s['top'][:2], viene={'prox': [], 'habitos': []}), 2) == ['campeon'],
       'sin dato no hay pieza: sin hábitos no hay «Lo que viene», y el top pide 3')
    vacia = semana_de('CCC', dt.date(2026, 11, 16), dt.date(2026, 11, 22), L, {}, {}, {}, k, str)
    ok(vacia['camp'] is None and not que_piezas(dict(vacia, viene={'prox': [], 'habitos': []}), 1), 'un servidor sin eventos no tiene piezas')
    # cuándo suele jugar
    ts = [dt.datetime(2026, 11, d, 23, 0, tzinfo=dt.timezone.utc) for d in (3, 10, 17)] + [dt.datetime(2026, 11, 5, 0, 10, tzinfo=dt.timezone.utc)]
    h = habitos(ts, 'America/Argentina/Buenos_Aires')
    ok(h == [(1, '20:00', 3)], 'cuándo suele jugar: el día con 2 o más, en la hora de su país (%s)' % h)
    ok(habitos(ts[:2], 'America/Argentina/Buenos_Aires') == [], 'con menos de 3 eventos, no se dice «suele»')
    v = lo_que_viene('AAA', [{'sv': 'AAA', 't': '2026-11-24T23:30:00Z', 'n': 'COPA 3'}, {'sv': 'BBB', 't': '2026-11-24T23:30:00Z', 'n': 'X'}],
                     dt.datetime(2026, 11, 23, 0, 0, tzinfo=ET), ('America/Argentina/Buenos_Aires', 'Argentina'),
                     dt.datetime(2026, 11, 23, 12, 0, tzinfo=ET))
    ok(v['prox'] == [(1, '20:30', 'COPA 3', 24)] and v['zona'] == 'Argentina', 'lo anunciado de la semana, en la hora de su país %s' % v['prox'])
    g = {'n': 'Mr Still Ballin', 'fl': 'data:x'}
    ok(nombre_fl(g).endswith('<span class="nw">Ballin<img class="fl" src="data:x" alt=""></span>'), 'la bandera va pegada a la última palabra')
    m = mensaje({'semana': '16–22 NOV'}, [('campeon', 'https://x/redes/aaa/campeon.jpg?v=1')])
    ok(m['flags'] == 32768 and m['allowed_mentions'] == {'parse': []} and m['components'][1]['type'] == 12
       and m['components'][1]['items'][0]['media']['url'].startswith('https://'), 'el mensaje: V2, sin menciones, las imágenes como link')
    print('   %s' % ('todo bien' if not mal else '%d mal' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    if '--local' in sys.argv:
        arg = [a for a in sys.argv[2:] if not a.startswith('--')]
        desde = next((dt.date.fromisoformat(a) for a in arg if re.match(r'^\d{4}-\d{2}-\d{2}$', a)), None)
        solo = {a.upper() for a in arg if not re.match(r'^\d{4}-', a)} or None
        n = correr(aplicar=False, solo=solo, local=True, desde=desde)
        print('   🗞️ %d servidor(es) dibujado(s) en %s' % (n, CACHE))
        sys.exit(0)
    if '--aplicar' in sys.argv:
        correr(aplicar=True)
        sys.exit(0)
    correr(aplicar=False)
