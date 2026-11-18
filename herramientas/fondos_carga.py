# -*- coding: utf-8 -*-
"""LOS FONDOS DE LA PANTALLA DE CARGA (Dlx, 12/11/2026).

Cinco fondos por temporada, cada uno con la misma chance; la página elige uno al azar en cada entrada (web/montar.py).
Qué fondos hay y cómo se arma cada uno vive en `web/carga.json`.

    1  Afiches       los de la Liga como tapas de disco pintadas a mano y pegadas con cinta (sale del ranking)
    2  La batalla    un momento real de cada video que pasó Dlx; cada video tiene su parte del 20 %
    3  La pared      las tarjetas de verdad del top, pegadas con cinta en una pared con grafitis (desde el 17/11/2026;
                     antes, en 3D con Blender: queda en `--3d`)
    4  Competitivo   los mejores del Competitivo que tienen una foto suya de avatar, con la cara a la vista
    5  VS de la Liga espera su imagen de IA

    python herramientas/fondos_carga.py              arma 1, 3 y 4 en .cache/carga/out/ (Playwright)
    python herramientas/fondos_carga.py 1 4          sólo esos
    python herramientas/fondos_carga.py --batallas   los momentos de «La batalla» (yt-dlp + ffmpeg + Real-ESRGAN, con
                                                    tarjeta de video; cuando cambia un momento en web/carga.json)
    python herramientas/fondos_carga.py --batallas sol4 makma3   sólo esos (y `--subir 2-sol4- 2-makma3-` los sube)
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
from comun import foco_carga  # noqa: E402

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

CONF = json.load(io.open(os.path.join(BASE, 'web', 'carga.json'), encoding='utf-8'))
TEMP = CONF['temporada']
CACHE = os.path.join(BASE, '.cache', 'carga')
OUT, TMP, CARTAS, BAT = (os.path.join(CACHE, d) for d in ('out', 'tmp', 'cartas', 'bat'))
FOTOS = os.path.join(BASE, 'comun', 'fotos', ACTUAL)
#: css de ancho y alto, y la densidad: 2880×1620 en la compu, 1296×2808 en el teléfono
#: 🔍 EN HD (Dlx, 13/11/2026: «esos 5 fondos no los veo en buena calidad, ¿están en HD?»). Eran 1920×1080 y 1080×2340
#: a calidad 80 —«La batalla» pesaba 46 KB—, y su pantalla tiene ~1850 px de ancho con densidad alta: se estiraban.
#: La regla de la Liga es guardar al doble de lo que se dibuja; 2880 es 1,5× y es lo que entra en los 4–5 s de la
#: primera carga (~450 KB cada uno)
FORMATOS = {'pc': (1600, 900, 1.8), 'cel': (432, 936, 3.0)}
# la forma de cada uno la usa también la página para encuadrar la cara (comun/foco_carga.py): tienen que ser la misma
#: 📐 «La batalla» trae además la tablet parada (1800×2400) y las pantallas grandes (3840×2160): ver comun/foco_carga.py.
#: Los otros fondos, no (lo del Competitivo no se toca, Dlx, 17/11/2026)
FORMATOS_BATALLA = dict(FORMATOS, tab=(600, 800, 3.0), hd=(1600, 900, 2.4))
assert all(abs(w / h - foco_carga.ASPECTO[f]) < 1e-6 for f, (w, h, _) in FORMATOS_BATALLA.items()), 'FORMATOS y foco_carga.ASPECTO no coinciden'
CALIDAD = 88
#: las caras del Competitivo en HD (ver `caras_hd()`), en R2 junto a los fondos
R2 = __import__('re').search(r"^R2 = '([^']+)'", io.open(os.path.join(BASE, 'bot', 'subir_web.py'), encoding='utf-8').read(), __import__('re').M).group(1)
ESRGAN = os.environ.get('ESRGAN_DIR') or os.path.join(os.environ.get('LOCALAPPDATA', ''), 'realesrgan-ncnn-vulkan-20220424')
FUENTES = ("<link href='https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wdth,wght@100..125,800;100..125,900"
           "&family=Barlow+Condensed:wght@600;700&family=Bungee&family=Permanent+Marker&family=Shrikhand&family=Righteous"
           "&family=Rubik+Mono+One&family=Bowlby+One+SC&family=Rock+Salt&family=Sedgwick+Ave+Display"
           "&family=Black+Ops+One&display=swap' rel='stylesheet'>")
#: las marcas de agua de los canales: se borronean (no se recorta: correría la persona)
#: (`dn`: el logo de «Desastres Naturales», que el video de Makma lleva abajo al centro en su primera mitad)
MARCAS = {'bvs': [(.40, .93, .60, .99)], 'ko': [(.43, .80, .57, .96)], 'dn': [(.38, .71, .62, .93)]}
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
def caras_hd(ks):
    """🔍 LA CARA DE CADA UNO EN HD, de R2 (`carga/<temporada>/caras/<clave>.webp`). Las fotos de perfil de Discord
    miden 256 px de verdad —34 de los 40 primeros del Competitivo, medido el 13/11/2026 pidiéndolas a 1024— y cada franja
    la dibuja a toda la altura: se pixelaban (Dlx: «no los veo en buena calidad»). Las de R2 son esas mismas fotos
    agrandadas ×4 con Real-ESRGAN, o un cuadro 1080p de un video suyo (Oasis: Dlx confirmó cuál es, 13/11/2026). Las arma
    `--caras`, en una máquina con tarjeta de video; el ciclo diario sólo las baja. Quien no tiene, sale con la de 256"""
    import requests
    d = os.path.join(CACHE, 'caras')
    os.makedirs(d, exist_ok=True)
    sal = {}
    for k in ks:
        p = os.path.join(d, k + '.webp')
        try:
            r = requests.get(f'{R2}/carga/{TEMP}/caras/{k}.webp', timeout=30)
            if r.status_code == 200 and len(r.content) > 5000:
                open(p, 'wb').write(r.content)
                sal[k] = p
        except requests.RequestException:
            if os.path.exists(p):
                sal[k] = p
    return sal


def armar_caras(forzar=False):
    """`--caras`: agranda ×4 con Real-ESRGAN la foto del espejo de cada uno del Competitivo de `web/carga.json` y la sube
    a R2. Una cara que ya está arriba no se toca (sin `--forzar`): la de Oasis sale de su video y se subió a mano"""
    import subprocess, requests
    import bienvenida_video as bv
    exe = os.path.join(ESRGAN, 'realesrgan-ncnn-vulkan.exe')
    if not os.path.exists(exe):
        raise SystemExit('🔴 falta Real-ESRGAN en %s (o ESRGAN_DIR)' % ESRGAN)
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + bv.token()
    fotos = fotos_buenas()
    for k in [k for k in CONF['competitivo'] if not k.startswith('_')]:
        if not forzar and requests.head(f'{R2}/carga/{TEMP}/caras/{k}.webp', timeout=20).status_code == 200:
            print('  ya está:', k)
            continue
        if k not in fotos:
            print('  🔴 sin foto en el espejo:', k)
            continue
        png_in, png_out = os.path.join(TMP, k + '_in.png'), os.path.join(TMP, k + '_x4.png')
        Image.open(fotos[k]).convert('RGB').save(png_in)
        subprocess.run([exe, '-i', png_in, '-o', png_out, '-n', 'realesrgan-x4plus', '-s', '4'], cwd=ESRGAN, check=True, capture_output=True)
        buf = io.BytesIO()
        Image.open(png_out).convert('RGB').save(buf, 'WEBP', quality=90, method=6)
        r = s.put(f'{bv.API_R2}/objects/carga/{TEMP}/caras/{k}.webp', data=buf.getvalue(), headers={'Content-Type': 'image/webp'}, timeout=120)
        print('  %s %s (%d KB)' % ('✅' if r.status_code < 300 else '🔴 %d' % r.status_code, k, len(buf.getvalue()) // 1024))


# (el texto de las franjas, más grande desde el 13/11/2026: Dlx, «quizás hacer ese texto más grande, nada más»)
def competitivo(fmt):
    caras = {k: v for k, v in CONF['competitivo'].items() if not k.startswith('_')}
    fotos = fotos_buenas()
    fotos.update(caras_hd(list(caras)))
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
        fx, fy, z = caras[k][:3]
        luz = caras[k][3] if len(caras[k]) > 3 else 1   # (una foto de noche, más clara)
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
        pos = f"width:{lado:.0f}px;height:{lado:.0f}px;left:{izq:.0f}px;top:{arr:.0f}px" + (f";filter:grayscale(1) contrast(1.18) brightness({.82 * luz:.2f})" if luz != 1 else '')
        paneles.append(f"<div class=pan style='{estilo}'><img src='{url(fotos[k])}' style='{pos}'><i class=trama></i>"
                       f"<i class=tinte></i>{dato}</div>")
    if fmt == 'pc':
        lineas = ''.join(f"<line x1='{x + 4}' y1='0' x2='{x - 4}' y2='100'/>" for x in [i * 100 / n for i in range(1, n)])
        css = """.cp .dato{position:absolute;left:var(--x);bottom:13%;translate:-50% 0;display:grid;justify-items:center;gap:8px;text-align:center}
.cp .nom{font:400 50px/1 Anton;color:#fff;letter-spacing:.02em;text-shadow:3px 3px 0 #111;white-space:nowrap}
.cp .pos{font:900 28px/1 Archivo;font-stretch:120%;color:var(--c);text-shadow:2px 2px 0 #111}
.cp .rg{font:900 24px/1 Archivo;font-stretch:120%;color:#111;padding:5px 13px;transform:skewX(-10deg);border:2px solid #111}
.cp .sc{font:700 22px/1 'Barlow Condensed';letter-spacing:.2em;color:#fff;text-shadow:1px 1px 0 #111}"""
    else:
        lineas = ''.join(f"<line x1='0' y1='{y + 2.5}' x2='100' y2='{y - 2.5}'/>" for y in [22 + i * 70 / n for i in range(0, n + 1)])
        css = """.cp .dato{position:absolute;right:6%;top:calc(var(--y) + 1%);display:flex;align-items:center;gap:8px}
.cp .nom{font:400 30px/1 Anton;color:#fff;text-shadow:2px 2px 0 #111;white-space:nowrap}
.cp .pos{font:900 18px/1 Archivo;font-stretch:120%;color:var(--c);text-shadow:2px 2px 0 #111}
.cp .rg{font:900 15px/1 Archivo;font-stretch:120%;color:#111;padding:4px 8px;transform:skewX(-10deg);border:2px solid #111}
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
def ffmpeg():
    ff = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe')
    return ff if os.path.exists(ff) else 'ffmpeg'


def cuadro(b, x4=False):
    """El archivo del cuadro de ese momento (en el nombre va el segundo: si el momento cambia, se baja otro)."""
    return os.path.join(BAT, '%s-%s%s.png' % (b['id'], b['seg'], '-x4' if x4 else ''))


def bajar_batallas(solo=()):
    """El cuadro de cada momento, SIN PÉRDIDA y agrandado ×4 (17/11/2026). Dlx: *«a veces sale borrosa, no se ve al MC»*.

    🔴 ANTES SE PERDÍA NITIDEZ EN DOS PASOS. yt-dlp cortaba un tramo de 2 s con `--force-keyframes-at-cuts`, que VUELVE
    A COMPRIMIR el video, y del tramo salía un JPG. Ahora ffmpeg lee el video directo de YouTube (la dirección que da
    `yt-dlp -g`), va al cuadro exacto y lo guarda en PNG. Y del mejor video que haya: el de Makma está en 1440p.
    🔍 Y ×4 CON REAL-ESRGAN, como las caras del Competitivo (aprobado por Dlx el 13/11/2026): el fondo del teléfono es
    una franja de 498 px de ancho del cuadro de 1080p estirada a 1296 —2,6 veces—, y eso era lo borroso en el celular.
    Sin la tarjeta de video (o sin Real-ESRGAN) sale sin agrandar, y lo avisa.

    ⚠️ Los momentos se eligieron midiendo la nitidez cuadro por cuadro en la caja del MC, ±4 s alrededor del de antes,
    y mirando que la cara quede a la vista (el registro está en NOVEDADES.md: «La pantalla de carga: «La batalla» nítida…»). Ver `cara` y `baja` en carga.json."""
    ff = ffmpeg()
    exe = os.path.join(ESRGAN, 'realesrgan-ncnn-vulkan.exe')
    for b in CONF['batallas']:
        if solo and b['id'] not in solo:
            continue
        dest = cuadro(b)
        if not os.path.exists(dest):
            r = subprocess.run([sys.executable, '-m', 'yt_dlp', '-g', '--no-warnings', '-f',
                                'bv*[height<=1440][ext=mp4]/bv*[height<=1440]', f"https://www.youtube.com/watch?v={b['video']}"],
                               capture_output=True, text=True, check=True)
            subprocess.run([ff, '-loglevel', 'error', '-y', '-ss', '%.3f' % float(b['seg']), '-i', r.stdout.strip().splitlines()[0],
                            '-frames:v', '1', dest], check=True)
            print('✓', b['id'], Image.open(dest).size)
        x4 = cuadro(b, True)
        if not os.path.exists(x4):
            if not os.path.exists(exe):
                print('⚠️  sin Real-ESRGAN (%s): %s sale sin agrandar' % (ESRGAN, b['id']))
                continue
            subprocess.run([exe, '-i', dest, '-o', x4, '-n', 'realesrgan-x4plus', '-s', '4'], cwd=ESRGAN, check=True, capture_output=True)
            print('✓ ×4', b['id'])


def batalla(b, fmt):
    """Un momento real en blanco y negro de cine: contraste, un poco más oscuro y viñeta. La franja del teléfono va
    centrada en la cara, y el cuadro se baja (`baja`) si la cara quedaría debajo del título: ver comun/foco_carga.py."""
    im = Image.open(cuadro(b, True) if os.path.exists(cuadro(b, True)) else cuadro(b)).convert('L')
    w, h = im.size
    for x0, y0, x1, y1 in MARCAS.get(b.get('marca'), []):
        r = (int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))
        im.paste(im.crop(r).filter(ImageFilter.GaussianBlur(18 * w / 1920)), r[:2])
    fw, fh, dpr = FORMATOS_BATALLA[fmt]
    tam = (round(fw * dpr), round(fh * dpr))
    x0, ancho = foco_carga.recorte(b, fmt)
    if ancho < 1:
        cw = round(h * tam[0] / tam[1])
        c0 = int(round(x0 * w))
        im = im.crop((c0, 0, c0 + cw, h))
    im = im.resize(tam, Image.LANCZOS)
    im = ImageEnhance.Brightness(ImageEnhance.Contrast(ImageOps.autocontrast(im, cutoff=1)).enhance(1.2)).enhance(b.get('luz', .8))
    a = np.asarray(im, dtype=np.float32)
    # 🌗 `gamma` (13/11/2026, Dlx: «fíjate que las luces… estén bien»): un cuadro de noche con luces fuertes no se arregla con
    # `luz`, que quema las luces antes de aclarar lo oscuro. La gamma levanta las sombras y deja las luces donde están.
    # Con 1,7 ya se ven los bloques de la compresión en lo oscuro
    if b.get('gamma'):
        a = 255 * (a / 255) ** (1 / float(b['gamma']))
    H, W = a.shape
    # ⬇️ el cuadro BAJADO: la cara estaba tan arriba que caía debajo del título. Se corre para abajo (se pierde el pie
    # del cuadro, que es pecho o público) y arriba queda negro, con un fundido para que no se vea el borde
    dy = int(round(foco_carga.baja(b, fmt) * H))
    if dy:
        a = np.concatenate([np.zeros((dy, W), np.float32), a[:H - dy]])
        f = int(foco_carga.FUNDIDO * H)
        a[dy:dy + f] *= np.linspace(0, 1, f, dtype=np.float32)[:, None] ** 1.5
    # la viñeta, con el centro en la cara (a mitad de camino del centro, para que no quede de un solo lado)
    cx0, cy0, cx1, cy1 = foco_carga.caja(b, fmt)
    vx, vy = .5 + ((cx0 + cx1) / 2 - .5) / 2, (cy0 + cy1) / 2
    yy, xx = np.mgrid[0:H, 0:W]
    v = 1 - .5 * (((xx - W * vx) / (W / 2)) ** 2 + ((yy - H * vy) / (H / 2)) ** 2) ** 1.2
    a = np.clip(a * np.clip(v, .18, 1), 0, 255)
    dest = os.path.join(OUT, f"2-{b['id']}-{fmt}.webp")
    Image.fromarray(a.astype(np.uint8)).convert('RGB').save(dest, 'WEBP', quality=CALIDAD, method=6)
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
            # una que no baja (un corte de la conexión) se saltea: la pared sale con una menos, no se cae el día
            for _ in range(3):
                try:
                    r = s.get(inv[k][t], timeout=30)
                except requests.RequestException:
                    continue
                if r.status_code == 200:
                    open(p, 'wb').write(r.content)
                break
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
        Image.open(png).convert('RGB').save(os.path.join(OUT, f'3-{fmt}.webp'), 'WEBP', quality=CALIDAD, method=6)
        print(f'3 · {fmt}: listo ({motor})')


def pared(fmt):
    """🧱 LAS TARJETAS PEGADAS EN LA PARED (17/11/2026). Dlx, de los fondos: el del Competitivo es el mejor, el de los
    afiches *«looks good as fuck»* y el 3D de tarjetas *«el más feo»*; a «¿qué hago con él?» eligió **rehacerlo como
    pared**. Las mismas tarjetas que el 3D (el top 5 de la Temporada y el del Competitivo, las de hoy), pero en el
    idioma de los afiches: pegadas con cinta sobre papeles de la paleta, en una pared de concreto en blanco y negro con
    grafitis en magenta y celeste, y el sticker de «FREE STYLE». El #1, el más grande, al centro y DEBAJO del título;
    las demás tarjetas de la Liga, chicas, apagadas y en gris, tapizan la pared de atrás.

    El color va sólo en las tarjetas del top y en los toques magenta y celeste, como en los otros fondos. Nada cae en la
    zona del título (arriba al centro) ni en la de la barra (abajo): en el teléfono, la barra va casi de lado a lado."""
    tem, com = bajar_cartas()
    w, h, _ = FORMATOS[fmt]
    pc = fmt == 'pc'
    random.seed(31 if pc else 32)

    def archivo(k, t):
        p = os.path.join(CARTAS, f'{k}__{t}.webp')
        return p if os.path.exists(p) and os.path.getsize(p) else None

    # 🎯 dónde va cada una: (centro x, arriba y, alto) en fracciones de la pantalla, y cuánto se gira
    if pc:
        lugares_t = [tuple(CONF['pared']['uno']['pc']) + (-1.5,), (.305, .40, .37, -5), (.695, .40, .37, 5), (.135, .50, .31, -8), (.865, .50, .31, 8)]
        lugares_c = [(.07, .10, .27, -9), (.93, .08, .27, 8), (.205, .05, .24, 5), (.795, .06, .24, -5), (.955, .69, .21, 10)]
    else:
        lugares_t = [tuple(CONF['pared']['uno']['cel']) + (-1.5,), (.13, .52, .22, -7), (.87, .52, .22, 7), (.15, .71, .16, 5), (.85, .71, .16, -5)]
        lugares_c = [(.09, .215, .17, -10), (.91, .205, .17, 9), (.05, .40, .13, 8), (.95, .39, .13, -8)]
    principales, usadas = [], set()
    for (k, t), (x, y, alto, gira) in list(zip([(k, 'temporada') for k in tem], lugares_t)) + list(zip([(k, 'competitivo') for k in com], lugares_c)):
        p = archivo(k, t)
        if not p:
            continue
        usadas.add(os.path.basename(p))
        principales.append((x, y, alto, gira, p, t == 'temporada' and k == tem[0]))
    # el fondo: las demás tarjetas de la Liga, chicas y en gris
    resto = sorted(f for f in os.listdir(CARTAS) if f.endswith('.webp') and f not in usadas)
    random.shuffle(resto)
    atras = []
    filas, cols = (3, 9) if pc else (6, 4)
    for r in range(filas):
        for c in range(cols):
            if not resto:
                break
            f = resto.pop()
            alto = random.uniform(.17, .23) if pc else random.uniform(.10, .13)
            x = (c + .5 + random.uniform(-.3, .3)) / cols
            y = (r + random.uniform(-.25, .2)) / filas
            atras.append(f"<img class=at src='{url(os.path.join(CARTAS, f))}' style='left:{x * 100:.1f}%;top:{y * 100:.1f}%;"
                         f"height:{alto * 100:.1f}%;rotate:{random.uniform(-14, 14):.1f}deg'>")
    PAPELES = ['#E41373', '#29B298', '#F4F4F0', '#111114', '#E41373']
    piezas = []
    for i, (x, y, alto, gira, p, es1) in enumerate(principales):
        papel = PAPELES[i % len(PAPELES)]
        pg = random.uniform(-6, 6)
        # el papel de atrás asoma con los bordes rotos; la tarjeta va encima, con dos cintas
        rotos = ','.join(f'{a:.0f}% {b:.0f}%' for a, b in (
            (random.uniform(0, 4), random.uniform(0, 5)), (random.uniform(30, 45), random.uniform(0, 3)), (random.uniform(60, 75), random.uniform(1, 5)),
            (random.uniform(96, 100), random.uniform(0, 4)), (random.uniform(97, 100), random.uniform(40, 60)), (random.uniform(95, 100), random.uniform(96, 100)),
            (random.uniform(55, 70), random.uniform(97, 100)), (random.uniform(20, 40), random.uniform(95, 100)), (random.uniform(0, 4), random.uniform(96, 100)),
            (random.uniform(0, 3), random.uniform(45, 60))))
        cintas = ''.join(f"<i class=cinta style='left:{cx:.0f}%;top:{cy:.0f}%;rotate:{cr:.0f}deg'></i>"
                         for cx, cy, cr in ((random.uniform(-8, 6), -2, random.uniform(-45, -30)), (random.uniform(72, 86), -2, random.uniform(30, 45))))
        piezas.append(f"<div class='tj{' uno' if es1 else ''}' style='left:{x * 100:.1f}%;top:{y * 100:.1f}%;height:{alto * 100:.1f}%;"
                      f"rotate:{gira:.1f}deg;z-index:{50 if es1 else 40 - i}'>"
                      f"<i class=papel style='background:{papel};rotate:{pg:.1f}deg;clip-path:polygon({rotos})'></i>"
                      f"<img src='{url(p)}'>{cintas}</div>")
    # ✍️ los grafitis: dónde y qué (fuera del título y de la barra)
    if pc:
        tags = [("TOP 5", "'Sedgwick Ave Display'", '#E41373', 2.5, 74, 100, -7), ("COMPE", "'Permanent Marker'", '#29B298', 75, 76, 60, -6),
]
        stk = (34.5, 73, 120)
    else:
        tags = [("TOP 5", "'Sedgwick Ave Display'", '#E41373', 30, 69, 54, -7)]
        stk = (63, 58, 74)
    grafitis = ''.join(f"<b class=tag style=\"left:{x}%;top:{y}%;font-family:{f};color:{c};font-size:{t}px;rotate:{g}deg;"
                       f"--sp:{c}\">{txt}</b>" for txt, f, c, x, y, t, g in tags)
    chorros = ''.join(f"<i class=chorro style='left:{x:.1f}%;top:{y:.1f}%;height:{l:.0f}px;background:{c}'></i>"
                      for x, y, l, c in ((t[3] + random.uniform(1, 9), t[4] + (7 if pc else 4.5), random.uniform(18, 60), t[2]) for t in tags[:2] for _ in range(3)))
    return f"""<div class=pared>
<i class=muro></i><i class=luz></i>
{''.join(atras)}<i class=velo></i>
{grafitis}{chorros}
{''.join(piezas)}
<div class=stk style='left:{stk[0]}%;top:{stk[1]}%;width:{stk[2]}px;height:{stk[2]}px'>FREE<br>STYLE</div>
<i class=haz></i>
</div>
<style>
.pared{{position:absolute;inset:0;overflow:hidden;background:#141418}}
.pared .muro{{position:absolute;inset:0;background:
  url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><filter id='m'><feTurbulence type='fractalNoise' baseFrequency='.012' numOctaves='4' seed='3'/><feColorMatrix values='0 0 0 0 .55 0 0 0 0 .55 0 0 0 0 .58 0 0 0 .22 0'/></filter><rect width='100%25' height='100%25' filter='url(%23m)'/></svg>"),
  url("{GRANO}"),linear-gradient(152deg,#1c1c22 0 54%,#111114 54% 100%)}}
.pared .luz{{position:absolute;left:50%;top:-30%;width:120%;height:120%;translate:-50% 0;
  background:radial-gradient(ellipse at 50% 40%,rgba(246,246,246,.14),transparent 60%)}}
.pared img.at{{position:absolute;translate:-50% 0;filter:grayscale(1) brightness(.3) contrast(1.15);box-shadow:0 6px 14px rgba(0,0,0,.5)}}
.pared .velo{{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 55%,transparent 30%,rgba(10,10,12,.72) 95%),
  linear-gradient(180deg,rgba(10,10,12,.35),transparent 30% 75%,rgba(10,10,12,.6))}}
.pared .tj{{position:absolute;translate:-50% 0}}
.pared .tj img{{position:relative;display:block;height:100%;width:auto;filter:drop-shadow(0 14px 18px rgba(0,0,0,.7))}}
.pared .tj .papel{{position:absolute;inset:-5% -7%;z-index:-1;box-shadow:0 10px 20px rgba(0,0,0,.55)}}
.pared .tj .cinta{{position:absolute;width:{'70' if pc else '40'}px;height:{'22' if pc else '13'}px;background:rgba(232,232,228,.55);z-index:2}}
.pared .tj.uno img{{filter:drop-shadow(0 18px 26px rgba(0,0,0,.8)) drop-shadow(0 0 22px rgba(255,208,36,.18))}}
/* los grafitis van ENCIMA de las tarjetas, como en una pared de verdad (debajo del #1) */
.pared .tag{{position:absolute;font-weight:400;line-height:.9;white-space:nowrap;z-index:45;opacity:.92;
  text-shadow:0 0 6px var(--sp),0 0 18px var(--sp),0 0 2px #000;filter:blur(.3px)}}
.pared .chorro{{position:absolute;width:{'4' if pc else '3'}px;border-radius:0 0 3px 3px;opacity:.75;z-index:44}}
.pared .stk{{position:absolute;display:grid;place-items:center;text-align:center;border-radius:50%;font:400 {'24' if pc else '15'}px/.95 Bungee;
  background:#E41373;color:#fff;box-shadow:6px 6px 0 #29B298;rotate:-12deg;border:{'5' if pc else '3'}px solid #fff;z-index:60}}
.pared .haz{{position:absolute;left:-10%;top:-30%;width:70%;height:160%;rotate:-38deg;background:linear-gradient(90deg,transparent,
  rgba(246,246,246,.07) 30%,rgba(246,246,246,.07) 70%,transparent);z-index:70;pointer-events:none;mix-blend-mode:screen}}
</style>"""


# ───────────────────────── armar y subir ─────────────────────────
#: el 3 es la pared de tarjetas desde el 17/11/2026; el 3D de Blender (`tarjetas_3d()`) queda para `--3d`
HTML = {'1': afiches, '3': pared, '4': competitivo}


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
                # la pared lleva 10 tarjetas con letra chica y 27 atrás: a 88 pesaba 771 KB (los afiches, 469)
                im.save(dest, 'WEBP', quality=80 if n == '3' else CALIDAD, method=6)
                print(f'{n} · {fmt}: {os.path.getsize(dest) // 1024} KB')
        nav.close()


def subir(solo=()):
    """Todo lo de .cache/carga/out/ a R2, carga/<temporada>/. La página lo pide de ahí (web/montar.py).

    `solo`: sólo los archivos que empiezan así (`--subir 2-` sube las batallas). ⚠️ Desde una PC conviene: en out/ pueden
    quedar el 1, el 3 y el 4 de otro día, y subirlos pisaría los que el ciclo rehízo hoy."""
    import requests
    import bienvenida_video as bv          # token() y la API de R2, los mismos que sube el video de la bienvenida
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + bv.token()
    for f in sorted(os.listdir(OUT)):
        if not f.endswith('.webp') or (solo and not f.startswith(tuple(solo))):
            continue
        r = s.put(f'{bv.API_R2}/objects/carga/{TEMP}/{f}', data=open(os.path.join(OUT, f), 'rb').read(),
                  headers={'Content-Type': 'image/webp'}, timeout=120)
        print('%-26s %s' % (f, 'ok' if r.status_code < 300 else '%s %s' % (r.status_code, r.text[:120])))
        if r.status_code >= 300:
            sys.exit(1)


if __name__ == '__main__':
    if '--batallas' in sys.argv:
        # `--batallas kainheat4 sol5`: sólo esos momentos (sumar uno no tiene que rehacer, agrandar y subir los demás)
        solo = [a for a in sys.argv[sys.argv.index('--batallas') + 1:] if not a.startswith('--')]
        faltan = set(solo) - {b['id'] for b in CONF['batallas']}
        if faltan:
            raise SystemExit('🔴 no están en web/carga.json: %s' % ', '.join(sorted(faltan)))
        bajar_batallas(solo)
        for b in CONF['batallas']:
            if solo and b['id'] not in solo:
                continue
            for fmt in FORMATOS_BATALLA:
                print(batalla(b, fmt))
    elif '--caras' in sys.argv:
        armar_caras(forzar='--forzar' in sys.argv)
    elif '--subir' in sys.argv:
        subir([a for a in sys.argv[sys.argv.index('--subir') + 1:] if not a.startswith('--')])
    else:
        cuales = [a for a in sys.argv[1:] if a in ('1', '3', '4')] or ['1', '3', '4']
        if '--3d' in sys.argv:
            # el 3 de antes, en Blender (hasta el 17/11/2026): Dlx lo encontró «el más feo» y pidió la pared
            render([c for c in cuales if c in HTML and c != '3'])
            if '3' in cuales:
                tarjetas_3d()
        else:
            render([c for c in cuales if c in HTML])
