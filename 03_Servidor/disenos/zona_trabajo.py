"""SOLO LO QUE ESTAMOS TOCANDO: las figuras, el emblema y el encuadre.

Dlx: "no me mandes toda la tarjeta solo en lo que estamos trabajando".

Esta hoja NO dibuja cartas enteras. Son tres bloques, cada uno recortado a
su zona:

    1. las ocho figuras     grandes, para ver el corte, y al tamaño real
    2. el emblema           antes y ahora, recortado al tope de la carta
    3. el encuadre          antes y ahora, recortado a la foto

⚠️ ESTA NO ES LA VERSION FINAL y el LADO DERECHO SIGUE SIN DECIDIRSE.
"""
import asyncio
import base64
import json
import os
import re
import sys

from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema, divisor as DIV, brillo as BRI, rangos as RG
from los_nueve import defs
import avatares

RG.verificar()

W, MARGEN = PICO.w, emblema.MARGEN
DEFS = defs()
BASE_Y = DIV.Y_EXTREMOS * PICO.h
ALTO_FOTO = round(BASE_Y) + 14
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
_EST = json.load(open(os.path.join(BASE, 'datos', 'estrellas.json'),
                      encoding='utf-8'))['estrellas_por_servidor']

# lo de antes, para poder comparar sin adivinar
ANTES = {'BAJA': 10, 'SEPARA': 1.5, 'POS': 0.62}
POS = 0.44          # el encuadre nuevo: la foto BAJA -> queda aire arriba

ALTO_TOPE = 130     # cuanto se recorta del tope para mirar el emblema


def b64(p):
    return ('data:image/png;base64,'
            + base64.b64encode(open(p, 'rb').read()).decode())


def esc(sv):
    return b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{sv.lower()}.png'))


def tope(sv, n, baja, separa, sufijo):
    """El tope de la carta recortado: escudo + estrellas + el pico."""
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    cy = MARGEN + baja
    # se reescriben las constantes solo para dibujar la comparacion
    v_baja, v_sep = emblema.BAJA, emblema.SEPARA
    emblema.BAJA, emblema.SEPARA = baja, separa
    emblema.CY = cy
    est = emblema.estrellas(n, W, sufijo=sufijo)
    pieza = emblema.pieza(sv, A, B, esc(sv))
    emblema.BAJA, emblema.SEPARA = v_baja, v_sep
    emblema.CY = MARGEN + v_baja
    hueco = (cy - emblema.LADO / 2) - (cy - (emblema.LADO / 2 + separa
                                             + emblema.E + emblema.SUBE))
    return f"""<div class="tope">
  <svg class="d" width="0" height="0"><defs>
    <clipPath id="t{sufijo}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="tc" style="clip-path:url(#t{sufijo})">
    <div class="f" style="background:{FONDO}"></div>
    {f'<div class="f" style="{EXTRA}"></div>' if EXTRA else ''}
    {BRI.arriba(A)}
  </div>
  <svg class="bo" viewBox="0 0 {W} {ALTO_TOPE}" width="{W}" height="{ALTO_TOPE}">
    <g clip-path="url(#t{sufijo})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
    </g>
  </svg>
  {est}{pieza}
</div>"""


def a_128(uri):
    """Devuelve la MISMA foto pasada por 128 px, para mostrar como se veia.

    ⚠️ Hace falta de verdad. Al rebajar los avatares a 512 en disco, el panel
    de "antes" pasaria a leer el archivo NUEVO y mostraria la mejora en los
    dos lados: una comparacion que no compara nada y encima dice que si.
    """
    import io
    from PIL import Image
    cab, dat = uri.split(',', 1)
    im = Image.open(io.BytesIO(base64.b64decode(dat))).convert('RGB')
    im = im.resize((128, 128), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def foto(i, pos, sufijo, degradar=False):
    """La zona de la foto recortada, con el emblema encima para ver el aire."""
    sv = 'TFC'
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    _, av = avatares.para(i)
    if degradar:
        av = a_128(av)
    lado = W * 115 / 100
    return f"""<div class="fz">
  <svg class="d" width="0" height="0"><defs>
    <clipPath id="f{sufijo}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="fc" style="clip-path:url(#f{sufijo})">
    <div class="f" style="background:{FONDO}"></div>
    {f'<div class="f" style="{EXTRA}"></div>' if EXTRA else ''}
    <div class="ft" style="-webkit-mask-image:{M_FOTO};mask-image:{M_FOTO}">
      <img src="{av}" style="width:{lado:.0f}px;left:{(W-lado)/2:.1f}px;
           top:{-(lado-ALTO_FOTO)*pos:.1f}px"></div>
    {BRI.arriba(A)}
  </div>
  <svg class="bo" viewBox="0 0 {W} {ALTO_FOTO+MARGEN}" width="{W}"
       height="{ALTO_FOTO+MARGEN}">
    <g clip-path="url(#f{sufijo})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
    </g>
  </svg>
  {emblema.pieza(sv, A, B, esc(sv))}
</div>"""


M_FOTO = ('linear-gradient(180deg,#000 0%,#000 72%,rgba(0,0,0,.5) 92%,'
          'transparent 100%)')

CSS = f"""
body{{background:#0A0A10;margin:0;padding:30px;font-family:system-ui,sans-serif}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:800;letter-spacing:1.3px;
  margin:26px 0 6px;border-top:1px solid #23232E;padding-top:16px}}
.rot:first-child{{border:0;margin-top:0;padding-top:0}}
.d1{{color:#8A8AA0;font-size:12.5px;margin:0 0 14px;max-width:1120px;line-height:1.55}}
.fila{{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start}}
.g{{text-align:center}}
.gl{{color:#EDEDF5;font-size:11.5px;font-weight:800;letter-spacing:1px;
  margin-bottom:8px}}
.gs{{color:#7A7A90;font-size:10px;letter-spacing:.6px;margin-top:7px}}
.caja{{position:relative;width:126px;height:126px;background:#15151E;
  border-radius:10px}}
.chico{{position:relative;width:52px;height:52px;background:#15151E;
  border-radius:7px;margin:8px auto 0}}
.fig{{position:absolute;filter:drop-shadow(0 2px 6px rgba(0,0,0,.75))}}
.d{{position:absolute}}
.tope{{position:relative;width:{W}px;height:{ALTO_TOPE}px;overflow:hidden;
  background:#0A0A10;border-radius:8px}}
.tc{{position:absolute;left:0;top:0;width:{W}px;height:{PICO.h + MARGEN}px}}
.fz{{position:relative;width:{W}px;height:{ALTO_FOTO + MARGEN}px;
  overflow:hidden;background:#0A0A10;border-radius:8px}}
.fc{{position:absolute;left:0;top:0;width:{W}px;height:{PICO.h + MARGEN}px}}
.f{{position:absolute;left:0;top:0;width:{W}px;height:{PICO.h + MARGEN}px;
  background-repeat:repeat}}
.bo{{position:absolute;left:0;top:0;pointer-events:none}}
.ft{{position:absolute;top:{MARGEN}px;left:0;width:{W}px;height:{ALTO_FOTO}px;
  overflow:hidden}}
.ft img{{position:absolute;height:auto;display:block}}
{BRI.css('luz', MARGEN, PICO.h)}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()

    # ── 1. las ocho figuras ─────────────────────────────────────────────
    gems = []
    for r in RG.ORDEN:
        gems.append(
            f'<div class="g"><div class="gl">{r} · {RG.MATERIAL[r]}</div>'
            f'<div class="caja">{RG.svg(r, 104, 63, 63, "b" + r)}</div>'
            f'<div class="chico">{RG.svg(r, 26, 26, 26, "c" + r)}</div>'
            f'<div class="gs">26 px de verdad</div></div>')

    # ── 2. el emblema ───────────────────────────────────────────────────
    topes = (
        f'<div class="g"><div class="gl">ANTES</div>'
        + tope('TFC', 1, ANTES['BAJA'], ANTES['SEPARA'], 'a1')
        + f'<div class="gs">baja 10 · hueco 2.8 px = 13% de la estrella</div></div>'
        f'<div class="g"><div class="gl">AHORA</div>'
        + tope('TFC', 1, emblema.BAJA, emblema.SEPARA, 'a2')
        + f'<div class="gs">baja {emblema.BAJA} · hueco {emblema.E*emblema.HUECO:.1f} px'
          f' = {emblema.HUECO*100:.0f}%</div></div>'
        f'<div class="g"><div class="gl">AHORA · 3 estrellas</div>'
        + tope('SR', 3, emblema.BAJA, emblema.SEPARA, 'a3')
        + '<div class="gs">el hueco no cambia con la cantidad</div></div>')

    # ── 3. el encuadre ──────────────────────────────────────────────────
    fotos = (f'<div class="g"><div class="gl">ANTES · fuente de 128</div>'
             + foto(0, ANTES['POS'], 'f1', degradar=True)
             + '<div class="gs">se agrandaba 2.7 veces</div></div>'
             f'<div class="g"><div class="gl">AHORA · fuente de 512</div>'
             + foto(0, POS, 'f2')
             + f'<div class="gs">la foto baja: pos {ANTES["POS"]} -> {POS}</div></div>'
             f'<div class="g"><div class="gl">ANTES vs AHORA · otra foto</div>'
             + foto(3, ANTES['POS'], 'f3', degradar=True)
             + '<div class="gs">la misma foto degradada a 128, para comparar</div>'
             '</div>'
             f'<div class="g"><div class="gl">&nbsp;</div>'
             + foto(3, POS, 'f4') + '<div class="gs">y a 512</div></div>')

    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'

           '<div class="rot">1 · LAS OCHO FIGURAS, CON CORTE</div>'
           '<div class="d1">El <b>SS ya no es un rombo</b>: es el '
           '<b>corte brillante de perfil</b> —tabla plana arriba, corona que se '
           'abre hasta el cinturón, pabellón largo a la punta—. Un rombo es un '
           'cuadrado girado; esa asimetría arriba/abajo es lo que lo hace leer '
           'como piedra tallada.<br><br>'
           'Las <b>facetas no cambian la silueta</b>, a propósito: la silueta es '
           'lo único que sobrevive a 26 px sobre un fondo cualquiera y es lo que '
           'se midió con IoU. Las caras son el premio de mirarla de cerca. '
           'Abajo de cada una está el <b>tamaño real</b>.<br><br>'
           'La luz entra de <b>arriba a la izquierda</b>, igual que en las '
           'estrellas del emblema: que dos piezas de la misma carta tengan el '
           'sol en lugares distintos se nota aunque nadie sepa decir por qué. Y '
           'el <b>oro y la plata llevan bisel de metal, no caras de piedra</b> — '
           'no son gemas.</div>'
           '<div class="fila">' + ''.join(gems) + '</div>'

           '<div class="rot">2 · EL EMBLEMA Y LAS ESTRELLAS</div>'
           '<div class="d1">El escudo <b>sube</b>: baja 10 → <b>7</b>. Y las '
           'estrellas se separan más.<br><br>'
           '⚠️ <b>No tengo una foto de camiseta en el repo para medirla</b>, así '
           'que lo que fijé es la <b>proporción</b>, que es lo que de verdad se '
           'copia de una camiseta y lo único que sobrevive a cambiar de tamaño: '
           'el hueco pasa a ser <b>30% del alto de la estrella</b>. Antes eran '
           '2.8 px sobre una estrella de 21 = <b>13%</b>, y por eso se veían '
           '<b>apoyadas</b> sobre el escudo en vez de flotando encima. Si me '
           'pasás una camiseta, la mido y cambio ese número solo — por eso es '
           'una fracción y no un píxel.</div>'
           '<div class="fila">' + topes + '</div>'

           '<div class="rot">3 · EL ENCUADRE, Y POR QUÉ NO SE VEÍA HD</div>'
           '<div class="d1">⚠️ <b>No era el diseño: era la fuente.</b> Los '
           'avatares estaban guardados a <b>128×128</b> y se dibujan a '
           '<b>345 px</b> de ancho — se agrandaban <b>2.7 veces</b>. El pool '
           'trae <code>?size=128</code> clavado en la URL, pero el size <b>no es '
           'parte del hash</b>, así que se puede reescribir a '
           '<code>?size=512</code>.<br><br>'
           # 🔴 ACÁ DECÍA «cuatro veces más grande» Y ES FALSO. Medido el
           # 20/09/2026: `size` es un TOPE, no un pedido — el CDN devuelve lo
           # que la persona subió. El salto real es 128 -> 256, o sea el
           # doble, y 186 de 307 quedan igual por debajo de los 345 px.
           '⚠️ <b>Pero no agranda:</b> <code>size</code> es un <b>tope</b>, no '
           'un pedido. El salto real es 128 → 256 —el doble, no cuatro veces— '
           'así que la carta pasa de agrandar 2.7× a 1.35×. De las 307 fotos '
           'guardadas, <b>186 siguen por debajo de 345 px</b> y salen blandas '
           'igual: el píxel no existe en ningún lado.<br><br>'
           'Y la foto <b>baja</b> para dejar aire arriba: pos 0.62 → 0.52.</div>'
           '<div class="fila">' + fotos + '</div>'

           '</body></html>')
    out = os.path.join(SCR, 'zona_trabajo.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1180, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'zona_trabajo.png'),
                            full_page=True)
        await b.close()
    print('-> zona_trabajo.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
