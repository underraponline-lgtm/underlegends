# -*- coding: utf-8 -*-
"""LOS FONDOS DE LA PANTALLA DE CARGA (Dlx, 12/11/2026).

Cinco fondos por temporada, cada uno con la misma chance; la página elige uno al azar en cada entrada (web/montar.py).
Qué fondos hay y cómo se arma cada uno vive en `web/carga.json`.

    1  Afiches       los de la Liga como tapas de disco pintadas a mano y pegadas con cinta (sale del ranking)
    2  La batalla    un momento real de cada video que pasó Dlx; cada video tiene su parte del 20 %
    3  Tarjetas 3D   las tarjetas de verdad en un escenario (Blender): la Temporada adelante, el Competitivo arriba
    4  Competitivo   los mejores del Competitivo que tienen una foto suya de avatar, con la cara a la vista
    5  VS de la Liga espera su imagen de IA

    python herramientas/fondos_carga.py              arma 1, 3 y 4 en .cache/carga/out/ (Playwright; el 3, Blender)
    python herramientas/fondos_carga.py 1 4          sólo esos
    python herramientas/fondos_carga.py --batallas   los momentos de «La batalla» (yt-dlp + ffmpeg; una vez por temporada)
    python herramientas/fondos_carga.py --subir      sube .cache/carga/out/ a R2, carga/<temporada>/

🎨 EL ESTILO ES EL DE LA BIENVENIDA (Dlx: «con la intro y bienvenida hay un contraste gigantísimo»): fotos en blanco y
negro con grano, el color sólo en las tarjetas y en los toques magenta y celeste. El título, la barra y la marca NO van
en la imagen: los pone la página encima, siempre en el mismo lugar («como Brawl Stars, que siempre tiene su estilo pero
diferentes fondos»).

⚠️ NO VAN AL REPO: son caras de gente real. Van a R2, como el video de la bienvenida, y la página las pide de ahí.
⚠️ CADA FONDO SE MIDE CONTRA LA ZONA DEL TÍTULO (arriba al centro, del 30 al 70 % de ancho y hasta el 27 % de alto):
ninguna cara puede caer ahí. Por eso los momentos de la batalla se eligieron mirando una hoja con esa zona marcada.
"""
import base64
import io
import json
import os
import random
import subprocess
import sys

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'herramientas'))
from comun import rangos, respaldo, sin_foto  # noqa: E402
from comun.temporada import ACTUAL  # noqa: E402

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

CONF = json.load(io.open(os.path.join(BASE, 'web', 'carga.json'), encoding='utf-8'))
TEMP = CONF['temporada']
CACHE = os.path.join(BASE, '.cache', 'carga')
OUT, TMP, CARTAS, BAT = (os.path.join(CACHE, d) for d in ('out', 'tmp', 'cartas', 'bat'))
FOTOS = os.path.join(BASE, 'comun', 'fotos', ACTUAL)
#: css de ancho y alto, y la densidad: 1920×1080 en la compu, 1080×2340 en el teléfono
FORMATOS = {'pc': (1600, 900, 1.2), 'cel': (432, 936, 2.5)}
FUENTES = ("<link href='https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wdth,wght@100..125,800;100..125,900"
           "&family=Barlow+Condensed:wght@600;700&family=Bungee&family=Permanent+Marker&family=Shrikhand&family=Righteous"
           "&family=Rubik+Mono+One&family=Bowlby+One+SC&family=Rock+Salt&family=Sedgwick+Ave+Display"
           "&family=Black+Ops+One&display=swap' rel='stylesheet'>")
#: las marcas de agua de los canales: se borronean (no se recorta: correría la persona)
MARCAS = {'bvs': [(.40, .93, .60, .99)], 'ko': [(.43, .80, .57, .96)]}
GRANO = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'>"
         "<feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 .9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

for d in (OUT, TMP, CARTAS, BAT):
    os.makedirs(d, exist_ok=True)


def url(ruta):
    return 'file:///' + ruta.replace(os.sep, '/')


def clave(nombre):
    return nombre.lower().replace(' ', '')


def vitrina(n):
    """Las filas numeradas de una vitrina (los miembros: los de «fuera de concurso» no tienen puesto)."""
    d = json.load(io.open(os.path.join(BASE, 'datos', f'{ACTUAL}_vitrina_{n}.json'), encoding='utf-8'))
    return [dict(zip(d['cabecera'], f)) for f in d['filas'] if isinstance(f[0], int)]


def fotos_buenas():
    """Las fotos del espejo, menos las lisas y las de quien ocultó la suya."""
    try:
        ocultas = json.load(io.open(os.path.join(BASE, 'comun', 'fotos', 'ocultas.json'), encoding='utf-8'))
    except (OSError, ValueError):
        ocultas = {}
    fuera = {clave(n) for n in ocultas.get('nombres', [])}
    sal = {}
    for f in sorted(os.listdir(FOTOS)) if os.path.isdir(FOTOS) else []:
        k = f.rsplit('.', 1)[0]
        p = os.path.join(FOTOS, f)
        if k in fuera:
            continue
        try:
            if respaldo.plana(p):
                continue
        except Exception:
            pass
        sal[k] = p
    return sal


# ───────────────────────── 1 · afiches ─────────────────────────
PAPEL = ['#E41373', '#29B298', '#111114', '#F4F4F0', '#2a2a31', '#E41373', '#F4F4F0', '#111114', '#29B298']
LETRA = ["'Sedgwick Ave Display'", "'Permanent Marker'", 'Bungee', 'Shrikhand', 'Righteous', 'Anton', "'Rubik Mono One'",
         "'Bowlby One SC'", "'Rock Salt'", "'Black Ops One'"]


def caja(a, k):
    """El promedio de una ventana k×k en cada píxel, con sumas acumuladas (sin scipy: el ciclo no lo instala)."""
    p = k // 2
    extra = ((0, 0),) * (a.ndim - 2)
    b = np.pad(a, ((p, k - 1 - p), (p, k - 1 - p)) + extra, mode='reflect').astype(np.float64)
    c = np.pad(b.cumsum(0).cumsum(1), ((1, 0), (1, 0)) + extra)
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


def kuwahara(arr, r):
    """Kuwahara: cada píxel toma el promedio del cuadrante más parejo de los cuatro. Deja manchas planas, de pincel."""
    k, s = r + 1, r // 2
    lum = arr.mean(axis=2)
    m = caja(arr, k)
    ml = caja(lum, k)
    var = caja(lum * lum, k) - ml * ml
    sal = np.zeros_like(arr)
    mejor = np.full(lum.shape, np.inf)
    for dy in (-s, s):
        for dx in (-s, s):
            v = np.roll(np.roll(var, dy, 0), dx, 1)
            mm = np.roll(np.roll(m, dy, 0), dx, 1)
            usar = v < mejor
            sal[usar] = mm[usar]
            mejor[usar] = v[usar]
    return sal


def pintada(ruta, lado=520):
    """La foto «pintada a mano», en blanco y negro: primero se aclara (casi todas son de escenario, oscuras), después
    Kuwahara, pocos tonos y un trazo oscuro en los bordes. Medido: con r=8 y sin aclarar, las de noche quedaban planas."""
    im = ImageOps.fit(Image.open(ruta).convert('RGB'), (lado, lado), Image.LANCZOS)
    im = ImageOps.autocontrast(im, cutoff=1)
    a = (np.asarray(im, dtype=np.float32) / 255) ** .78
    im = ImageEnhance.Color(Image.fromarray((a * 255).astype(np.uint8))).enhance(1.5)
    a = kuwahara(np.asarray(im, dtype=np.float32), 4)
    a = np.repeat(a.mean(axis=2, keepdims=True), 3, axis=2)
    q = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).quantize(colors=12, method=Image.Quantize.MEDIANCUT,
                                                                       dither=Image.Dither.NONE).convert('RGB')
    g = np.asarray(q.convert('L').filter(ImageFilter.FIND_EDGES), dtype=np.float32)
    borde = g > np.percentile(g, 95)
    o = np.asarray(q).copy()
    o[borde] = (o[borde] * .45).astype(np.uint8)
    dest = os.path.join(TMP, 'pint-' + os.path.basename(ruta).rsplit('.', 1)[0] + '.png')
    Image.fromarray(o).save(dest)
    return url(dest)


def oscuro(hexc):
    r, g, b = (int(hexc[i:i + 2], 16) for i in (1, 3, 5))
    return (r * 299 + g * 587 + b * 114) / 1000 < 140


def afiches(fmt):
    w, h, _ = FORMATOS[fmt]
    random.seed(21 if fmt == 'pc' else 22)
    fotos = fotos_buenas()
    claves = []
    for f in vitrina('temporada'):
        k = clave(f['Rapero'])
        if k in fotos and k not in [c for c, _ in claves]:
            claves.append((k, f['Rapero']))
    if not claves:
        raise SystemExit('🔴 afiches: nadie del ranking tiene foto en el espejo (¿corrió `bot/fotos.py --espejo`?)')
    cols, filas = (5, 3) if fmt == 'pc' else (3, 4)
    cw, ch = w / cols, (h * .93) / filas
    lista, i = [], 0
    for r in range(filas):
        for c in range(cols):
            k, nombre = claves[i % len(claves)]
            i += 1
            ancho = cw * random.uniform(.74, .9) * (1.22 if random.random() < .2 else 1)
            alto = min(ancho * random.choice([1.0, 1.22, 1.3, .9]), ch * 1.12)
            x = c * cw + (cw - ancho) / 2 + random.uniform(-.14, .14) * cw
            y = r * ch + (ch - alto) / 2 + random.uniform(-.12, .12) * ch + h * .02
            papel = random.choice(PAPEL)
            tinta = '#F4F4F0' if oscuro(papel) else '#111114'
            acento = random.choice(['#E41373', '#29B298', '#F4F4F0'])
            letra = random.choice(LETRA)
            tipo = random.choices(['arriba', 'abajo', 'encima', 'disco'], [45, 12, 23, 20])[0]
            foto = pintada(fotos[k])
            tam = max(16, min(46, ancho / max(4.5, len(nombre) * .62)))
            cinta = ''.join(f"<i class=cinta style='left:{cx:.0f}%;top:-9px;rotate:{cr:.0f}deg'></i>"
                            for cx, cr in ((random.uniform(-6, 10), random.uniform(-40, -25)),
                                           (random.uniform(70, 86), random.uniform(25, 40))))
            if tipo == 'disco':
                cuerpo = (f"<div class=disco style='background:{papel}'><img src='{foto}'>"
                          f"<b style=\"font-family:{letra};color:{acento};font-size:{tam * .9:.0f}px\">{nombre}</b></div>")
            elif tipo == 'arriba':
                cuerpo = (f"<b class=tit style=\"font-family:{letra};color:{acento if oscuro(papel) else tinta};"
                          f"font-size:{tam:.0f}px\">{nombre}</b><div class=ph><img src='{foto}'></div>")
            elif tipo == 'abajo':
                cuerpo = (f"<div class=ph><img src='{foto}'></div>"
                          f"<b class=tit style=\"font-family:{letra};color:{tinta};font-size:{tam:.0f}px\">{nombre}</b>")
            else:
                cuerpo = (f"<div class=ph full><img src='{foto}'></div><b class='tit sobre' style=\"font-family:{letra};"
                          f"color:{acento};font-size:{tam * 1.2:.0f}px\">{nombre}</b>")
            lista.append((r + random.random() * .6,
                          f"<div class='af {tipo}' style='left:{x:.0f}px;top:{y:.0f}px;width:{ancho:.0f}px;height:{alto:.0f}px;"
                          f"background:{papel};rotate:{random.uniform(-5, 5):.1f}deg'>{cuerpo}{cinta}</div>"))
    lista.sort()
    vb, d = sin_foto.FIGURAS[1]
    pc = fmt == 'pc'
    return f"""<div class=col><svg class=sombra viewBox='{vb}'><path d='{d}' fill='rgba(0,0,0,.55)'/></svg>
{''.join(a for _, a in lista)}<i class=haz></i><div class='stk s1'>FREE<br>STYLE</div></div>
<style>
.col{{position:absolute;inset:0;overflow:hidden;background:linear-gradient(152deg,#1b1b21 0 54%,#121216 54% 100%)}}
.col .haz{{position:absolute;left:-10%;top:-30%;width:70%;height:160%;rotate:-38deg;background:linear-gradient(90deg,transparent,
  rgba(246,246,246,.1) 30%,rgba(246,246,246,.1) 70%,transparent);z-index:50;pointer-events:none;mix-blend-mode:screen}}
.col .sombra{{position:absolute;right:{'-6%' if pc else '-30%'};bottom:-4%;height:{'118%' if pc else '92%'};opacity:.9}}
.af{{position:absolute;box-shadow:0 12px 22px rgba(0,0,0,.6);display:flex;flex-direction:column;padding:7px;gap:6px}}
.af .ph{{flex:1;min-height:0;overflow:hidden}}
.af .ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.af.encima{{padding:0}}
.af .ph[full]{{position:absolute;inset:0}}
.af .tit{{font-weight:400;line-height:.95;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-shadow:2px 2px 0 rgba(0,0,0,.25)}}
.af .tit.sobre{{position:absolute;left:8px;bottom:10px;right:8px;rotate:-6deg;transform-origin:0 100%;-webkit-text-stroke:1.5px #111;paint-order:stroke fill}}
.af.disco{{padding:10px}}
.af .disco{{position:absolute;inset:10px;border-radius:50%;overflow:hidden;display:grid;place-items:center}}
.af .disco img{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.92}}
.af .disco b{{position:relative;font-weight:400;text-transform:uppercase;background:rgba(0,0,0,.55);padding:2px 8px;rotate:-8deg}}
.af .cinta{{position:absolute;width:{'64' if pc else '44'}px;height:{'20' if pc else '14'}px;background:rgba(230,230,226,.45)}}
.stk{{position:absolute;display:grid;place-items:center;text-align:center;border-radius:50%;font:400 {'26' if pc else '18'}px/.95 Bungee}}
.stk.s1{{width:{'150' if pc else '96'}px;height:{'150' if pc else '96'}px;background:#E41373;color:#fff;box-shadow:6px 6px 0 #29B298;
  left:{'46%' if pc else '62%'};top:{'53%' if pc else '44%'};rotate:-12deg;border:5px solid #fff}}
</style>"""


#: que cada nombre entre entero en su afiche: se achica la letra hasta que entra
AJUSTAR = '''() => { for (const el of document.querySelectorAll('.af .tit, .af .disco b')) {
  const max = (el.closest('.disco') ? el.closest('.disco').clientWidth * .86 : el.parentElement.clientWidth - 14);
  let t = parseFloat(getComputedStyle(el).fontSize);
  el.style.display = 'inline-block';
  while (el.scrollWidth > max && t > 9) { t -= 1; el.style.fontSize = t + 'px'; }
  el.style.display = ''; } }'''


# ───────────────────────── 4 · competitivo ─────────────────────────
def competitivo(fmt):
    caras = {k: v for k, v in CONF['competitivo'].items() if not k.startswith('_')}
    fotos = fotos_buenas()
    top = [f for f in vitrina('competitivo') if clave(f['Rapero']) in caras and clave(f['Rapero']) in fotos][:5]
    if len(top) < 3:
        raise SystemExit('🔴 competitivo: menos de 3 con foto real en el Competitivo (web/carga.json → competitivo)')
    W, H, _ = FORMATOS[fmt]
    n = len(top)
    paneles = []
    for i, f in enumerate(top):
        k = clave(f['Rapero'])
        col = rangos.ACENTO.get(f['Rango'], '#ffffff')
        dato = (f"<div class=dato><span class=pos>#{f['#']}</span><b class=nom>{f['Rapero'].upper()}</b>"
                f"<span class=rg style='background:{col}'>{f['Rango']}</span><span class=sc>{f['Score']:.1f}</span></div>")
        fx, fy, z = caras[k]
        if fmt == 'pc':
            s = 8
            x0, x1 = i * 100 / n, (i + 1) * 100 / n
            a, b = (0, 0) if i == 0 else (x0 + s / 2, x0 - s / 2)
            c, d = (100, 100) if i == n - 1 else (x1 - s / 2, x1 + s / 2)
            estilo = f"clip-path:polygon({a}% 0,{d}% 0,{c}% 100%,{b}% 100%);--x:{(x0 + x1) / 2}%;--c:{col}"
            lado = z * H
            izq = (i + .5) * W / n - fx * lado
            arr = min(0, max(H - lado, .47 * H - fy * lado))   # la cara, debajo del título (que llega al 27 %)
        else:
            # en el teléfono las franjas van del 22 al 92 %: arriba el título, abajo la barra
            s, Y0, Y1 = 5, 22, 92
            y0, y1 = Y0 + i * (Y1 - Y0) / n, Y0 + (i + 1) * (Y1 - Y0) / n
            a, b = (Y0, Y0) if i == 0 else (y0 + s / 2, y0 - s / 2)
            c, d = (Y1, Y1) if i == n - 1 else (y1 - s / 2, y1 + s / 2)
            estilo = f"clip-path:polygon(0 {a}%,100% {b}%,100% {d}%,0 {c}%);--y:{(y0 + y1) / 2}%;--c:{col}"
            lado = z * W
            arr = min(y0 / 100 * H - 20, max(y1 / 100 * H + 20 - lado, (y0 + y1) / 200 * H - fy * lado))
            izq = min(0, max(W - lado, .36 * W - fx * lado))   # a la izquierda: el nombre va a la derecha
        pos = f"width:{lado:.0f}px;height:{lado:.0f}px;left:{izq:.0f}px;top:{arr:.0f}px"
        paneles.append(f"<div class=pan style='{estilo}'><img src='{url(fotos[k])}' style='{pos}'><i class=trama></i>"
                       f"<i class=tinte></i>{dato}</div>")
    if fmt == 'pc':
        lineas = ''.join(f"<line x1='{x + 4}' y1='0' x2='{x - 4}' y2='100'/>" for x in [i * 100 / n for i in range(1, n)])
        css = """.cp .dato{position:absolute;left:var(--x);bottom:15%;translate:-50% 0;display:grid;justify-items:center;gap:6px;text-align:center}
.cp .nom{font:400 34px/1 Anton;color:#fff;letter-spacing:.02em;text-shadow:3px 3px 0 #111;white-space:nowrap}
.cp .pos{font:900 20px/1 Archivo;font-stretch:120%;color:var(--c);text-shadow:2px 2px 0 #111}
.cp .rg{font:900 18px/1 Archivo;font-stretch:120%;color:#111;padding:4px 10px;transform:skewX(-10deg);border:2px solid #111}
.cp .sc{font:700 16px/1 'Barlow Condensed';letter-spacing:.2em;color:#fff;text-shadow:1px 1px 0 #111}"""
    else:
        lineas = ''.join(f"<line x1='0' y1='{y + 2.5}' x2='100' y2='{y - 2.5}'/>" for y in [22 + i * 70 / n for i in range(0, n + 1)])
        css = """.cp .dato{position:absolute;right:6%;top:calc(var(--y) + 1%);display:flex;align-items:center;gap:8px}
.cp .nom{font:400 24px/1 Anton;color:#fff;text-shadow:2px 2px 0 #111;white-space:nowrap}
.cp .pos{font:900 15px/1 Archivo;font-stretch:120%;color:var(--c);text-shadow:2px 2px 0 #111}
.cp .rg{font:900 13px/1 Archivo;font-stretch:120%;color:#111;padding:3px 7px;transform:skewX(-10deg);border:2px solid #111}
.cp .sc{display:none}"""
    return f"""<div class=cp>{''.join(paneles)}
<svg viewBox='0 0 100 100' preserveAspectRatio='none'><g class=neg>{lineas}</g><g class=bla>{lineas}</g></svg></div>
<style>
.cp{{position:absolute;inset:0;background:#111;overflow:hidden}}
.cp .pan{{position:absolute;inset:0;overflow:hidden}}
.cp .pan img{{position:absolute;object-fit:cover;filter:grayscale(1) contrast(1.18) brightness(.82)}}
.cp .trama{{position:absolute;inset:0;background:radial-gradient(circle,rgba(0,0,0,.55) 1.3px,transparent 1.8px) 0 0/7px 7px;
  -webkit-mask:linear-gradient(180deg,transparent 35%,#000 85%);mask:linear-gradient(180deg,transparent 35%,#000 85%);opacity:.5}}
.cp .tinte{{position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(3,3,4,.9) 100%)}}
{css}
.cp svg{{position:absolute;inset:0;width:100%;height:100%;z-index:2}}
.cp .neg line{{stroke:#0a0a0a;stroke-width:14px;vector-effect:non-scaling-stroke}}
.cp .bla line{{stroke:#fff;stroke-width:6px;vector-effect:non-scaling-stroke}}
</style>"""


# ───────────────────────── 2 · la batalla ─────────────────────────
def bajar_batallas():
    """El cuadro de cada momento, del video (yt-dlp + ffmpeg). Una vez por temporada: los momentos no cambian."""
    ff = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe')
    ff = ff if os.path.exists(ff) else 'ffmpeg'
    for b in CONF['batallas']:
        dest = os.path.join(BAT, b['id'] + '.jpg')
        if os.path.exists(dest):
            continue
        tramo = os.path.join(TMP, b['id'] + '.mp4')
        t = float(b['seg'])
        subprocess.run([sys.executable, '-m', 'yt_dlp', '-q', '--no-warnings', '-f', 'bv*[height<=1080][ext=mp4]/bv*[height<=1080]',
                        '--download-sections', f'*{t:.1f}-{t + 2:.1f}', '--force-keyframes-at-cuts',
                        '--ffmpeg-location', os.path.dirname(ff) if os.sep in ff else '', '-o', tramo,
                        f"https://www.youtube.com/watch?v={b['video']}"], check=True)
        subprocess.run([ff, '-loglevel', 'error', '-y', '-i', tramo, '-frames:v', '1', '-q:v', '2', dest], check=True)
        print('✓', b['id'])


def batalla(b, fmt):
    """Un momento real, entero y sin recortes, en blanco y negro de cine: contraste, un poco más oscuro y viñeta."""
    im = Image.open(os.path.join(BAT, b['id'] + '.jpg')).convert('L')
    w, h = im.size
    for x0, y0, x1, y1 in MARCAS.get(b.get('marca'), []):
        r = (int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))
        im.paste(im.crop(r).filter(ImageFilter.GaussianBlur(18)), r[:2])
    if fmt == 'pc':
        tam = (1920, 1080)
    else:
        cw = round(h * 1080 / 2340)
        x0 = int(min(max(b['cx'] * w - cw / 2, 0), w - cw))
        im = im.crop((x0, 0, x0 + cw, h))
        tam = (1080, 2340)
    im = im.resize(tam, Image.LANCZOS)
    im = ImageEnhance.Brightness(ImageEnhance.Contrast(ImageOps.autocontrast(im, cutoff=1)).enhance(1.2)).enhance(b.get('luz', .8))
    a = np.asarray(im, dtype=np.float32)
    H, W = a.shape
    yy, xx = np.mgrid[0:H, 0:W]
    v = 1 - .5 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H * b['foco']) / (H / 2)) ** 2) ** 1.2
    a = np.clip(a * np.clip(v, .18, 1), 0, 255)
    dest = os.path.join(OUT, f"2-{b['id']}-{fmt}.webp")
    Image.fromarray(a.astype(np.uint8)).convert('RGB').save(dest, 'WEBP', quality=80, method=6)
    return dest


# ───────────────────────── 3 · tarjetas en 3D ─────────────────────────
def los_diez():
    tem = [clave(f['Rapero']) for f in vitrina('temporada')][:5]
    com = [k for k in (clave(f['Rapero']) for f in vitrina('competitivo')) if k not in tem][:5]
    return tem, com


def bajar_cartas():
    """Las tarjetas que salen en el 3D, de R2: las del top y 70 más, a la suerte, para el fondo."""
    import requests
    inv = json.load(io.open(os.path.join(BASE, 'datos', 'cartas_r2.json'), encoding='utf-8'))
    tem, com = los_diez()
    pedir = [(k, 'temporada') for k in tem] + [(k, 'competitivo') for k in com]
    random.seed(7)
    otras = [k for k in inv if isinstance(inv[k], dict) and k not in tem + com]
    for k in random.sample(otras, min(70, len(otras))):
        tipos = [t for t in ('temporada', 'competitivo', 'pais', 'servidor') if t in inv[k]]
        if tipos:
            pedir.append((k, random.choice(tipos)))
    s = requests.Session()
    for k, t in pedir:
        p = os.path.join(CARTAS, f'{k}__{t}.webp')
        if t in inv.get(k, {}) and not (os.path.exists(p) and os.path.getsize(p)):
            r = s.get(inv[k][t], timeout=30)
            if r.status_code == 200:
                open(p, 'wb').write(r.content)
    return tem, com


def blender():
    for p in (os.environ.get('BLENDER'), r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe', 'blender'):
        if p and (os.path.exists(p) or p == 'blender'):
            return p


def tarjetas_3d():
    tem, com = bajar_cartas()
    # en la nube no hay placa de video: Cycles en la CPU (CARGA_CYCLES=1); acá, EEVEE
    motor = 'cycles' if os.environ.get('CARGA_CYCLES') else 'eevee'
    for fmt in ('pc', 'cel'):
        png = os.path.join(TMP, f't3d-{fmt}.png')
        subprocess.run([blender(), '-b', '--factory-startup', '-P', os.path.join(BASE, 'herramientas', 'tarjetas_3d.py'),
                        '--', png, fmt, CARTAS, ','.join(tem), ','.join(com), motor], check=True,
                       stdout=subprocess.DEVNULL)
        Image.open(png).convert('RGB').save(os.path.join(OUT, f'3-{fmt}.webp'), 'WEBP', quality=80, method=6)
        print(f'3 · {fmt}: listo ({motor})')


# ───────────────────────── armar y subir ─────────────────────────
HTML = {'1': afiches, '4': competitivo}


def render(cuales):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        nav = pw.chromium.launch()
        for n in cuales:
            for fmt, (w, h, dpr) in FORMATOS.items():
                html = (f"<!doctype html><meta charset=utf-8>{FUENTES}<style>html,body{{margin:0;width:{w}px;height:{h}px;"
                        f"overflow:hidden;background:#000}}</style>{HTML[n](fmt)}")
                ruta = os.path.join(TMP, f'{n}-{fmt}.html')
                io.open(ruta, 'w', encoding='utf-8').write(html)
                pg = nav.new_page(viewport={'width': w, 'height': h}, device_scale_factor=dpr)
                pg.goto(url(ruta))
                pg.wait_for_load_state('networkidle')
                pg.evaluate('document.fonts.ready')
                pg.evaluate(AJUSTAR)
                pg.wait_for_timeout(300)
                im = Image.open(io.BytesIO(pg.screenshot())).convert('RGB')
                pg.close()
                dest = os.path.join(OUT, f'{n}-{fmt}.webp')
                im.save(dest, 'WEBP', quality=80, method=6)
                print(f'{n} · {fmt}: {os.path.getsize(dest) // 1024} KB')
        nav.close()


def subir():
    """Todo lo de .cache/carga/out/ a R2, carga/<temporada>/. La página lo pide de ahí (web/montar.py)."""
    import requests
    import bienvenida_video as bv          # token() y la API de R2, los mismos que sube el video de la bienvenida
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + bv.token()
    for f in sorted(os.listdir(OUT)):
        if not f.endswith('.webp'):
            continue
        r = s.put(f'{bv.API_R2}/objects/carga/{TEMP}/{f}', data=open(os.path.join(OUT, f), 'rb').read(),
                  headers={'Content-Type': 'image/webp'}, timeout=120)
        print('%-26s %s' % (f, 'ok' if r.status_code < 300 else '%s %s' % (r.status_code, r.text[:120])))
        if r.status_code >= 300:
            sys.exit(1)


if __name__ == '__main__':
    if '--batallas' in sys.argv:
        bajar_batallas()
        for b in CONF['batallas']:
            for fmt in FORMATOS:
                print(batalla(b, fmt))
    elif '--subir' in sys.argv:
        subir()
    else:
        cuales = [a for a in sys.argv[1:] if a in ('1', '3', '4')] or ['1', '3', '4']
        render([c for c in cuales if c in HTML])
        if '3' in cuales:
            tarjetas_3d()
