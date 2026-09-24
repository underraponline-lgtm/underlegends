"""El costado: que hace la referencia, que hacen las nuestras, y la hoja.

⚠️ CORRIGE UNA NOTA VIEJA DE ESTADO.md. Ahi decia que la vertical del
costado estaba "al 32.4% del panel" y que "repinta el material de la carta y
se desvanece hacia el centro". Medido de nuevo sobre las SIETE referencias,
el pico fuerte de la mitad derecha cae en 81.9% a 88.1%, promedio 84.3%.

Y el dato que lo cierra: TODAS tienen el pico espejado a la IZQUIERDA en la
posicion complementaria.

    FINAL REFERENCIA   11.9%  /  88.1%
    UCL_ICON_A4        16.7%  /  82.8%
    TOTS_ICON_A4       18.1%  /  81.9%
    ICON_PRIME_5       19.4%  /  83.1%
    TOTS23_EVENT       16.0%  /  84.0%
    UCL23_ICON_5       16.4%  /  82.3%

⚠️ UN PANEL DE CONTENIDO NO ESTA ESPEJADO. Si la misma linea aparece a
izquierda y derecha a la misma distancia del borde, no es una columna de
datos: es EL FILO INTERNO DEL MARCO. Con el zoom 7x se confirma —adentro de
esa linea el campo esta VACIO, solo el material y las chispitas.

O sea que "que ponemos en el panel del costado" estaba mal planteado: en la
referencia NO HAY panel del costado. Lo que hay es marco.
"""
import asyncio
import base64
import io
import os
import re
import sys

from PIL import Image
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema, divisor as DIV, brillo as BRI, nombre as NOM
from los_nueve import defs
from paneles import borde
import avatares

W, MARGEN = PICO.w, emblema.MARGEN
DEFS = defs()
BASE_Y = DIV.Y_EXTREMOS * PICO.h
SUBE = DIV.RECORRIDO * PICO.w * 1.3
ALTO_FOTO = round(BASE_Y) + 14
ALTO = PICO.h + MARGEN + 20
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
VELO = 'linear-gradient(180deg,rgba(0,0,0,.30),rgba(0,0,0,.64))'
FILO = 84.3          # donde cae el filo interno del marco en las referencias


def y(v):
    return v + MARGEN


def uri(im, alto=340):
    k = alto / im.height
    im = im.resize((max(1, int(im.width * k)), alto), Image.LANCZOS)
    b = io.BytesIO()
    im.convert('RGB').save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def der(p, frac=.40):
    """La mitad derecha de un PNG, del 8% al 78% del alto."""
    im = Image.open(p).convert('RGBA')
    w, h = im.size
    return im.crop((int(w * (1 - frac)), int(h * .08), w, int(h * .78)))


def b64(p):
    return ('data:image/png;base64,'
            + base64.b64encode(open(p, 'rb').read()).decode())


def camino(n=90):
    xi, xd = borde(BASE_Y, 'izq'), borde(BASE_Y, 'der')
    return [(xi + (xd - xi) * (i / n), BASE_Y - DIV.altura(i / n) * SUBE)
            for i in range(n + 1)]


def panel_pie(pts):
    # el camino vive en comun/divisor.py: estaba copiado en ocho
    # scripts, todos con el mismo bug de la punta perdida
    return DIV.panel(pts, PTS, W, dy=MARGEN)


def filo(B, pts, hasta, dentro, ancho, sufijo):
    """La U: el divisor Y SUS DOS LADOS, en un solo trazo.

    ⚠️ NO son "dos verticales del costado" mas un divisor: en la referencia
    es UNA SOLA PIEZA de neon que rodea la zona del avatar. Medido por color
    sobre la FINAL REFERENCIA:

        vertical izquierda   x 14.8%   cobertura 95.0%   y 5.6%..69.3%
        vertical derecha     x 84.8%   cobertura 96.2%   y 5.6%..69.7%
        fila con mas neon abajo                          y 62.5%
        -> ESPEJADAS, y la fila de abajo cae justo en el divisor

    O sea que nuestra carta ya dibuja EL FONDO DE ESA U y le faltan los
    lados. Por eso se traza continua y no como tres cosas sueltas: si se
    dibujaran por separado, las uniones se verian.

    `hasta` es hasta que altura suben, y `dentro` cuanto se meten desde el
    borde de la silueta.
    """
    if not ancho:
        return ''
    xi, yi = pts[0]
    xd, yd = pts[-1]
    xi += dentro
    xd -= dentro
    d = (f'M{xi:.1f},{y(hasta):.1f} L{xi:.1f},{y(yi):.1f} '
         + ' '.join('L%.2f,%.2f' % (x, y(v)) for x, v in pts)
         + f' L{xd:.1f},{y(hasta):.1f}')
    return (f'<svg class="filo" viewBox="0 0 {W} {ALTO}" width="{W}" '
            f'height="{ALTO}"><path d="{d}" fill="none" stroke="{B}" '
            f'stroke-width="{ancho}" stroke-linecap="round" '
            f'stroke-linejoin="round" opacity=".92"/></svg>')


def carta(sv, i, hasta, dentro, ancho, etq, sufijo):
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    pts = camino()
    _, av = avatares.para(i)
    lado = W * 115 / 100
    nom = 'VALEN'
    foto = (f'<div class="foto" style="-webkit-mask-image:{M_FOTO};'
            f'mask-image:{M_FOTO}"><img src="{av}" style="width:{lado:.0f}px;'
            f'left:{(W-lado)/2:.1f}px;top:{-(lado-ALTO_FOTO)*.44:.1f}px">'
            f'</div>') if av else ''
    return f"""<div class="g"><div class="gl">{etq}</div>
<div class="wrap">
  <svg class="d" width="0" height="0"><defs>
    <clipPath id="{sufijo}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cu" style="clip-path:url(#{sufijo})">
    <div class="f" style="background:{FONDO}"></div>
    {f'<div class="f" style="{EXTRA}"></div>' if EXTRA else ''}
    {foto}
    {BRI.arriba(A)}
    {filo(B, pts, hasta, dentro, ancho, sufijo)}
    <div class="f" style="background:{FONDO};clip-path:path('{panel_pie(pts)}')"></div>
    <div class="f" style="background:{VELO};clip-path:path('{panel_pie(pts)}')"></div>
    {'' if ancho else f'''<svg class="f" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <path d="{'M' + ' L'.join('%.2f,%.2f' % (x, v + MARGEN) for x, v in pts)}"
            fill="none" stroke="{B}" stroke-width="1.9" opacity=".9"/></svg>'''}
  </div>
  <svg class="bo" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{sufijo})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
    </g>
  </svg>
  <div class="nom" style="font-size:{NOM.rem(nom, 1.6)}rem">{nom}</div>
  {emblema.estrellas(1, W, sufijo=sufijo)}
  {emblema.pieza(sv, A, B, b64(os.path.join(BASE, 'comun', 'escudos_cuad',
                                            f'sv_{sv.lower()}.png')))}
</div></div>"""


M_FOTO = ('linear-gradient(180deg,#000 0%,#000 72%,rgba(0,0,0,.5) 92%,'
          'transparent 100%)')

CSS = f"""
body{{background:#0A0A10;margin:0;padding:30px;font-family:system-ui,sans-serif}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:800;letter-spacing:1.3px;
  margin:26px 0 6px;border-top:1px solid #23232E;padding-top:16px}}
.rot:first-child{{border:0;margin-top:0;padding-top:0}}
.d1{{color:#8A8AA0;font-size:12.5px;margin:0 0 14px;max-width:1180px;line-height:1.55}}
.med{{color:#8A8AA0;font-size:12px;font-family:ui-monospace,monospace;
  white-space:pre;line-height:1.5;margin:0 0 16px}}
.fila{{display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start}}
.g{{text-align:center}}
.gl{{color:#EDEDF5;font-size:11.5px;font-weight:800;letter-spacing:1px;
  margin-bottom:8px;max-width:300px}}
.gs{{color:#7A7A90;font-size:10.5px;margin-top:7px;max-width:300px;line-height:1.4}}
.rec{{border-radius:8px;overflow:hidden;background:#15151E}}
.rec img{{display:block;height:340px;width:auto}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.d{{position:absolute}}
.cu{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.bo{{position:absolute;inset:0;pointer-events:none}}
.f{{position:absolute;inset:0;background-repeat:repeat}}
.filo{{position:absolute;inset:0;pointer-events:none}}
.foto{{position:absolute;top:{MARGEN}px;left:0;width:{W}px;height:{ALTO_FOTO}px;
  overflow:hidden}}
.foto img{{position:absolute;height:auto;display:block}}
{BRI.css('luz', MARGEN, PICO.h)}
.nom{{position:absolute;left:0;right:0;top:{y(NOM.Y['servidor'])-16}px;
  text-align:center;z-index:9;font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;
  color:#fff;line-height:1;text-shadow:0 2px 6px rgba(0,0,0,.85)}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    REF = os.path.join(BASE, '03_Servidor', 'referencia', 'estructura')
    recortes = [
        ('FINAL REFERENCIA', os.path.join(REF, 'FINAL REFERENCIA.png'), .42,
         'la vertical cae al <b>88.1%</b> y tiene su espejo al <b>11.9%</b>. '
         'Adentro, el campo está <b>vacío</b>.'),
        ('UCL_ICON_A4', os.path.join(REF, 'backgrounds_21_UCL_ICON_A4.png'), .42,
         '82.8% y espejo al 16.7%'),
        ('nuestra TEMPORADA', os.path.join(BASE, '01_Temporada',
                                           'Konan_temporada.png'), .42,
         '<b>nada</b> en el costado. Solo el <b>#11</b> arriba, que es el puesto.'),
        ('nuestra COMPETITIVA', os.path.join(BASE, '02_Competitivo',
                                             'Konan_competitivo.png'), .42,
         '<b>pastillas colgadas del borde</b>, en <code>right:-11px</code>: '
         'sobresalen de la silueta. No es un panel.'),
    ]
    cel = []
    for etq, p, fr, nota in recortes:
        if not os.path.exists(p):
            continue
        cel.append(f'<div class="g"><div class="gl">{etq}</div>'
                   f'<div class="rec"><img src="{uri(der(p, fr))}"></div>'
                   f'<div class="gs">{nota}</div></div>')

    ops = ''.join([
        carta('TFC', 0, 0, 0, 0, 'A · como está: solo el divisor', 'o1'),
        carta('TFC', 1, 24, 0, 1.9, 'B · la U, al borde', 'o2'),
        carta('TFC', 2, 24, 11, 1.9, 'C · la U, metida 11 px', 'o3'),
        carta('TFC', 3, 24, 11, 2.8, 'D · la U metida, más marcada', 'o4'),
    ])

    med = ('             izquierda   derecha\n'
           'FINAL REFERENCIA  11.9%     88.1%\n'
           'UCL_ICON_A4       16.7%     82.8%\n'
           'TOTS_ICON_A4      18.1%     81.9%\n'
           'ICON_PRIME_5      19.4%     83.1%\n'
           'TOTS23_EVENT      16.0%     84.0%\n'
           'UCL23_ICON_5      16.4%     82.3%\n'
           '                            -------\n'
           '                  promedio   84.3%')

    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">EL COSTADO: LA REFERENCIA Y LAS NUESTRAS</div>'
           '<div class="d1">⚠️ <b>Esto corrige una nota vieja.</b> En '
           '<code>ESTADO.md</code> quedó escrito que la vertical del costado '
           'estaba «al 32.4% del panel». Medido de nuevo sobre las <b>siete</b> '
           'referencias, el pico fuerte de la mitad derecha cae entre '
           '<b>81.9%</b> y <b>88.1%</b>.<br><br>'
           '⚠️ <b>Y el dato que lo cierra: todas tienen el pico espejado a la '
           'izquierda.</b> Un panel de contenido <b>no está espejado</b>. Si la '
           'misma línea aparece a izquierda y derecha a la misma distancia del '
           'borde, no es una columna de datos: es <b>el filo interno del '
           'marco</b>. Con zoom 7x se confirma — adentro de esa línea el campo '
           'está <b>vacío</b>, solo el material y las chispitas.<br><br>'
           'O sea que «qué ponemos en el panel del costado» estaba mal '
           'planteado: <b>en la referencia no hay panel del costado. Hay '
           'marco.</b><br><br>'
           '⚠️ Y <b>ninguna de nuestras dos cartas tiene panel lateral</b>: la '
           'Competitiva usa el <b>borde como perchero</b> —pastillas que '
           'sobresalen— y la Temporada <b>no usa el costado</b>. Si la Servidor '
           'estrena un panel de contenido, estrena un lenguaje que no existe en '
           'el juego, y encima en la única carta que va a vivir en servidores '
           'ajenos.</div>'
           '<div class="med">' + med + '</div>'
           '<div class="fila">' + ''.join(cel) + '</div>'
           '<div class="rot">LAS OPCIONES PARA LA SERVIDOR</div>'
           '<div class="d1">Si el costado es <b>marco</b> y no datos, la '
           'decisión no es «qué dato va ahí» sino <b>cuánto se marca ese '
           'filo</b>. Y eso conecta con el marco, que es lo que falta.<br><br>'
           '⚠️ El filo va en <b>los dos lados</b>, no solo a la derecha: así lo '
           'hacen las seis referencias. Ponerlo solo a la derecha es lo que lo '
           'convertiría en un panel, que es justo lo que no son.</div>'
           '<div class="fila">' + ops + '</div>'
           '</body></html>')
    out = os.path.join(SCR, 'lado_comparar.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1420, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'lado_comparar.png'),
                            full_page=True)
        await b.close()
    print('-> lado_comparar.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
