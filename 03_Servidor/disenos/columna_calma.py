"""Calmar la banda del material adentro de la columna.

Dlx: "en la de snake, fontana y FRZ se ve el fondo en el lado del panel
derecho, se ve mal".

⚠️ Y NO ES QUE SE VEA EL FONDO: ES QUE EL FONDO TIENE UN BORDE AHI. El
lavado repinta el material fielmente —que es lo correcto— pero varios
materiales llevan UNA BANDA DIAGONAL FUERTE, y esa banda cruza la columna.
Los numeros quedan mitad sobre claro y mitad sobre oscuro.

Medido, rango de luz del material dentro de la columna:

    SR    152.9      DRA    113.5      TFC    65.5
    TWR   126.8      FRZ     93.6      RZ     48.5
    FTN   120.3      URBF    74.3      FFA    24.6

Los tres que Dlx nombro estan entre los cuatro peores. No los eligio al
azar: son los que tienen la banda mas marcada.

QUE SE PRUEBA. Tres maneras de calmar, y la pregunta no es cual se ve mejor
sino CUANTO BAJA EL RANGO sin perder el color del servidor:

  a) como esta            el material tal cual
  b) mas un velo suave    oscurece parejo, comprime el rango
  c) material simplificado un degrade vertical del color base, sin banda

⚠️ La (c) cambia lo que el lavado significa. Hoy la columna es EL MATERIAL DE
LA CARTA; con (c) pasa a ser EL COLOR de la carta sin su dibujo. Sigue
cumpliendo el trabajo —que los numeros no caigan sobre la foto— y sigue
siendo el color del servidor, pero deja de ser literalmente el mismo
material. Es una decision, no un ajuste.
"""
import asyncio
import base64
import os
import re
import sys

import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema, divisor as DIV, brillo as BRI
from comun import pie as PIE, iconos as ICO, marco as MK
from los_nueve import defs
from paneles import borde
import avatares

W, MARGEN = PICO.w, emblema.MARGEN
DEFS = defs()
BASE_Y = DIV.Y_EXTREMOS * PICO.h
SUBE = DIV.RECORRIDO * PICO.w * 1.3
ALTO_FOTO = round(BASE_Y) + 4
ALTO = PICO.h + MARGEN + 20
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
M_FOTO = ('linear-gradient(180deg,#000 0%,#000 84%,rgba(0,0,0,.55) 95%,'
          'transparent 100%)')
LAVADO = (13, 25, 43)
SVS = ['SR', 'FTN', 'FRZ']
FILAS = [('campeonatos', 1), ('podios', 4), ('racha', '6/10'),
         ('duelos', '5/9'), ('eventos', 22)]
MODOS = [('a · como está', None), ('b · con velo suave', 'velo'),
         ('c · material simplificado', 'plano')]
ZONA = (W - PIE.COL_DER - PIE.COL_ANCHO, MARGEN + PIE.COL_Y_OVR,
        W - PIE.COL_DER, MARGEN + PIE.COL_Y0 + 4 * PIE.COL_PASO)


def y(v):
    return v + MARGEN


def b64(p):
    return ('data:image/png;base64,'
            + base64.b64encode(open(p, 'rb').read()).decode())


def camino(n=90):
    xi, xd = borde(BASE_Y, 'izq'), borde(BASE_Y, 'der')
    return [(xi + (xd - xi) * (i / n), BASE_Y - DIV.altura(i / n) * SUBE)
            for i in range(n + 1)]


def lavado(sv, modo, recorte):
    """Las capas del lavado. `modo` decide si se calma y como."""
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    a, b, c = LAVADO
    m = (f'linear-gradient(270deg,#000 0%,#000 {a}%,'
         f'rgba(0,0,0,.5) {b}%,transparent {c}%)')
    est = (f'-webkit-mask-image:{m};mask-image:{m};'
           f'clip-path:path(\'{recorte}\')')
    if modo == 'plano':
        # ⚠️ el color base ENCENDIDO arriba y apagado abajo: es el color del
        # servidor sin su dibujo, asi que no puede tener banda
        pl = (f'linear-gradient(180deg,{emblema.tono(A, .22)} 0%,'
              f'{emblema.tono(A, -.10)} 55%,{emblema.tono(A, -.42)} 100%)')
        return f'<div class="wash" style="background:{pl};{est}"></div>'
    capas = [f'<div class="wash" style="background:{FONDO};{est}"></div>']
    if EXTRA:
        capas.append(f'<div class="wash" style="{EXTRA};{est}"></div>')
    if modo == 'velo':
        capas.append(f'<div class="wash" style="background:'
                     f'linear-gradient(180deg,rgba(0,0,0,.20),'
                     f'rgba(0,0,0,.34));{est}"></div>')
    return ''.join(capas)


def carta(sv, modo, sufijo, con_texto=True):
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    pts = camino()
    _, av = avatares.para(1)
    lado = W * 115 / 100
    rec = DIV.arriba(pts, W, ALTO, dy=MARGEN)
    minis = ''.join(
        f'<div class="mini" style="top:{y(PIE.COL_Y0 + k * PIE.COL_PASO) - 9:.0f}px">'
        f'<div class="lin">{ICO.svg(ic, 15)}<b>{v}</b></div>'
        f'<span>{ICO.ETIQUETA[ic]}</span></div>'
        for k, (ic, v) in enumerate(FILAS)) if con_texto else ''
    num = (f'<div class="ovr" style="top:{y(PIE.COL_Y_OVR)}px">66</div>'
           if con_texto else '')
    return f"""<div class="wrap">
  <svg class="d" width="0" height="0"><defs>
    <clipPath id="{sufijo}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
    {MK.defs_svg(A, B, sufijo)}
  </defs></svg>
  <div class="cu" style="clip-path:url(#{sufijo})">
    <div class="f" style="background:{FONDO}"></div>
    {f'<div class="f" style="{EXTRA}"></div>' if EXTRA else ''}
    <div class="foto" style="-webkit-mask-image:{M_FOTO};mask-image:{M_FOTO};
         clip-path:path('{rec}')">
      <img src="{av}" style="width:{lado:.0f}px;left:{(W-lado)/2:.1f}px;
           top:{MARGEN-(lado-ALTO_FOTO)*.44:.1f}px"></div>
    {lavado(sv, modo, rec)}
    {BRI.arriba(A)}
    <div class="f" style="background:{FONDO};clip-path:path('{DIV.panel(pts, PTS, W, dy=MARGEN)}')"></div>
    {f'<div class="f" style="{EXTRA};clip-path:path(&quot;{DIV.panel(pts, PTS, W, dy=MARGEN)}&quot;)"></div>' if EXTRA else ''}
    <svg class="f" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <path d="{'M' + ' L'.join('%.2f,%.2f' % (x, y(v)) for x, v in pts)}"
            fill="none" stroke="{B}" stroke-width="1.9" opacity=".9"/></svg>
  </div>
  <svg class="bo" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{sufijo})">
      <path d="{SIL}" fill="none" stroke="{MK.stroke(sufijo)}"
            stroke-width="9" opacity=".95"/></g>
  </svg>
  {num}{minis}
</div>"""


CSS = f"""
body{{margin:0;background:transparent}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.d{{position:absolute}} .cu{{position:absolute;inset:0}}
.bo{{position:absolute;inset:0;pointer-events:none}}
.f{{position:absolute;inset:0;background-repeat:repeat}}
.foto{{position:absolute;top:0;left:0;width:{W}px;height:{ALTO}px;overflow:hidden}}
.foto img{{position:absolute;height:auto;display:block}}
.wash{{position:absolute;inset:0;background-repeat:repeat}}
{BRI.css('luz', MARGEN, PICO.h)}
.ovr{{position:absolute;right:{PIE.COL_DER}px;width:{PIE.COL_ANCHO}px;
  text-align:center;z-index:9;font-family:'Archivo','LigaEmoji',sans-serif;color:#fff;
  font-weight:900;line-height:.92;font-size:3rem;
  -webkit-text-stroke:1.1px rgba(0,0,0,.62);paint-order:stroke fill;
  text-shadow:0 3px 10px rgba(0,0,0,.9)}}
.mini{{position:absolute;right:{PIE.COL_DER}px;width:{PIE.COL_ANCHO}px;
  z-index:9;color:#fff;font-family:'Archivo','LigaEmoji',sans-serif;text-align:center;
  text-shadow:0 2px 6px rgba(0,0,0,.9)}}
.lin{{display:flex;align-items:center;justify-content:center;gap:4px;
  white-space:nowrap}}
.lin svg{{flex:none}}
.lin b{{font-size:.9rem;font-weight:900;line-height:1}}
.mini span{{display:block;font-size:.38rem;font-weight:800;letter-spacing:.9px;
  opacity:.68;margin-top:2px}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    tmp = os.path.join(SCR, '_cal'); os.makedirs(tmp, exist_ok=True)
    x0, y0, x1, y1 = ZONA
    rango = {}
    fs = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': W, 'height': ALTO},
                              device_scale_factor=3)
        for sv in SVS:
            for mi, (etq, modo) in enumerate(MODOS):
                # sin texto para medir SOLO el material
                for txt in (False, True):
                    h = os.path.join(tmp, f'{sv}{mi}{int(txt)}.html')
                    open(h, 'w', encoding='utf-8').write(
                        '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
                        + fuentes + CSS + '</style></head><body>'
                        + carta(sv, modo, f'k{sv}{mi}{int(txt)}', txt)
                        + '</body></html>')
                    await pg.goto('file://' + h); await pg.wait_for_timeout(240)
                    f = os.path.join(tmp, f'{sv}{mi}{int(txt)}.png')
                    await pg.screenshot(path=f)
                    if not txt:
                        a = np.array(Image.open(f).convert('RGB')
                                     .resize((W, ALTO), Image.LANCZOS)).astype(float)
                        z = a[y0:y1, x0:x1]
                        L = .2126*z[:,:,0] + .7152*z[:,:,1] + .0722*z[:,:,2]
                        rango[(sv, mi)] = L.max() - L.min()
                    else:
                        fs[(sv, mi)] = f
        await b.close()

    print('RANGO DE LUZ DEL MATERIAL DENTRO DE LA COLUMNA')
    print('  (mas bajo = mas parejo. Medido SIN texto encima.)\n')
    print('  %-6s' % 'sv' + ''.join('%22s' % e for e, _ in MODOS))
    print('  ' + '-' * 72)
    for sv in SVS:
        print('  %-6s' % sv + ''.join('%22.1f' % rango[(sv, i)]
                                      for i in range(len(MODOS))))
    print()
    for i, (etq, _) in enumerate(MODOS):
        m = sum(rango[(sv, i)] for sv in SVS) / len(SVS)
        print('  %-26s promedio %6.1f' % (etq, m))

    cel = ''
    for sv in SVS:
        for i, (etq, _) in enumerate(MODOS):
            cel += (f'<div class="g"><div class="gl">{sv} · {etq}</div>'
                    f'<img class="z" src="{b64(fs[(sv, i)])}">'
                    f'<div class="gs">rango {rango[(sv, i)]:.0f}</div></div>')
    hoja = f"""<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{{background:#0A0A10;margin:0;padding:30px;font-family:system-ui,sans-serif}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:800;letter-spacing:1.3px;margin:0 0 8px}}
.d1{{color:#8A8AA0;font-size:12.5px;margin:0 0 18px;max-width:1180px;line-height:1.55}}
.fila{{display:flex;gap:16px;flex-wrap:wrap}}
.g{{text-align:center;margin-bottom:14px}}
.gl{{color:#EDEDF5;font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:7px}}
.gs{{color:#7A7A90;font-size:10.5px;margin-top:5px}}
.z{{display:block;width:{W}px}}
</style></head><body>
<div class="rot">CALMAR LA BANDA DE LA COLUMNA</div>
<div class="d1">⚠️ <b>No es que se vea el fondo: es que el fondo tiene un
borde ahí.</b> El lavado repinta el material fielmente —que es lo correcto—
pero varios materiales llevan <b>una banda diagonal fuerte</b>, y esa banda
cruza la columna. Los números quedan mitad sobre claro y mitad sobre
oscuro.<br><br>
Rango de luz del material dentro de la columna, en los diez:
<code>SR 152.9 · TWR 126.8 · FTN 120.3 · DRA 113.5 · FRZ 93.6 · URBF 74.3 ·
TFC 65.5 · RZ 48.5 · FFA 24.6</code>. <b>Los tres que nombraste están entre
los cuatro peores</b> — no los elegiste al azar.<br><br>
⚠️ <b>La (c) cambia lo que el lavado significa.</b> Hoy la columna es <b>el
material de la carta</b>; con (c) pasa a ser <b>el color</b> de la carta sin
su dibujo. Sigue cumpliendo el trabajo y sigue siendo el color del servidor,
pero deja de ser literalmente el mismo material. Es una decisión, no un
ajuste.</div>
<div class="fila">{cel}</div></body></html>"""
    out = os.path.join(SCR, 'columna_calma.html')
    open(out, 'w', encoding='utf-8').write(hoja)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1010, 'height': 900},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2200)
        await pg.screenshot(path=os.path.join(SCR, 'columna_calma.png'),
                            full_page=True)
        await b.close()
    print('\n-> columna_calma.png')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(main())
