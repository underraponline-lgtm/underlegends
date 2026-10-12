# -*- coding: utf-8 -*-
"""🧰 EL KIT DEL ORGANIZADOR: /afiche y /llave dibujan la imagen y se la contestan a quien la pidió.

    python bot/kit.py --tipo afiche --sv FFA              dibuja y guarda en salida/kit_*.png, sin subir nada
    python bot/kit.py --tipo llave --sv FFA --id <id>     dibuja, sube a R2 y le avisa al objeto (la tarea kit.yml)
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
import hashlib
import html
import io
import json
import os
import re
import sys

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


def foto(htm, ruta):
    """El PNG del `#c` de ese HTML."""
    import navegador
    navegador.hace_falta()
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 1200, 'height': 1200}, device_scale_factor=1)
        pg.set_content(htm)
        pg.wait_for_timeout(400)
        pg.locator('#c').screenshot(path=ruta)
        b.close()
    return ruta


# ── a quien lo pidió ─────────────────────────────────────────────────────────────────────────────────────────────────
def subir(ruta, clave):
    import subir_cartas as SC
    s = SC.sesion()
    datos = open(ruta, 'rb').read()
    r = s.put('%s/objects/%s' % (SC.API, clave), data=datos, headers={'Content-Type': 'image/png'}, timeout=60)
    if SC._ok(r, clave) is None:
        raise RuntimeError('R2 no la aceptó')
    return '%s/%s' % (SC.PUBLICA, clave)


def avisar(id_, url=None, error=None, texto=''):
    import requests
    import avisar as AV
    t = AV._token() if hasattr(AV, '_token') else None
    if not t:
        import escuchar as E
        t = E._env('DISCORD_TOKEN')
    k = hashlib.sha256(('lg-ciclo:' + t).encode('utf-8')).hexdigest()
    r = requests.post(AV.WORKER + '/avisos/kit-listo', headers={'x-lg-ciclo': k}, timeout=20,
                      json={'id': id_, 'url': url, 'error': error, 'texto': texto})
    print('   el objeto: %d %s' % (r.status_code, r.text[:120]))


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
    ll = html_llave('DESGRACIAS EN TOKYO VOL 27', [('SEMIFINALES', ['Ana', 'Beto'], 'Ana'),
                                                   ('SEMIFINALES', ['Caro', 'Dani'], 'Caro'),
                                                   ('FINAL', ['Ana', 'Caro'], 'Ana')], 'FFA', d)
    casos = [
        ('el afiche: el nombre sin los guiones bajos de Discord, la hora y la modalidad',
         'DESGRACIAS EN TOKYO VOL 27' in h and '9PM ARG' in h and '1VS1' in h and '__' not in h.split('<div class="nom">')[1][:40]),
        ('la llave: una columna por ronda y el campeón', ll.count('class="ronda"') == 2 and 'Campeón' in ll and '>Ana<' in ll),
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
    if tipo not in ('afiche', 'llave') or not re.match(r'^[A-Z]{2,5}$', sv) or (arg('--id') and not re.match(r'^[a-f0-9]{16,40}$', arg('--id'))):
        sys.exit('uso: python bot/kit.py --tipo afiche|llave --sv FFA [--id <id>]')
    sys.exit(correr(tipo, sv, arg('--id')))
