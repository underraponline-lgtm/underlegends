"""El escudo sobre los fondos que Discord nos da, no sobre la carta.

⚠️ LA TANDA ANTERIOR MIDIO EN EL LUGAR EQUIVOCADO Y HAY QUE DECIRLO.
emblema_separa.py sampleaba solo donde alpha>250, o sea SOLO DONDE HAY
CARTA. Pero el 61% del escudo cae fuera de la carta: medi el anillo justo
donde el anillo importa menos, y por eso los cuatro tratamientos daban
identicos. No era que no sirvieran; era que el numero no los estaba mirando.

QUE ES EL CONTORNO. Las estrellas ya lo tienen:

    stroke="rgba(0,0,0,.66)" stroke-width="1.6" paint-order="stroke"

un filo oscuro NEUTRO pegado a la figura, que existe para que la figura
tenga borde sobre CUALQUIER fondo. Esta escrito en comun/emblema.py por que:
"Sobre blanco una estrella blanca da 1.00:1 y desaparece; la sombra no
alcanza porque es un desplazamiento hacia abajo y deja el borde de arriba
sin nada".

El escudo NO lo tiene. Lo que tiene es:

    box-shadow: 0 4px 14px rgba(0,0,0,.85), 0 0 0 3px {acento}

o sea un aro DEL ACENTO DEL SERVIDOR mas una sombra desplazada hacia abajo.
Las dos cosas fallan por el mismo lado que fallaban en las estrellas:

  · el acento es BLANCO en URBF y DRA y casi blanco en TFC. Un aro blanco
    sobre fondo blanco no es un borde, es nada.
  · la sombra va hacia abajo: el borde de ARRIBA queda sin nada. Y el borde
    de arriba del escudo es justo el que esta 100% fuera de la carta.

QUE SE MIDE ACA. El PNG se compone sobre los fondos de verdad —blanco,
negro, los dos temas de Discord— y se mide el CONTRASTE entre el filo del
escudo y el fondo, solo en la parte que NO tiene carta detras. Contraste
WCAG, que es la misma unidad con la que este proyecto ya midio las
estrellas: 1.00:1 es "desaparecio", 3:1 es un borde que se ve.
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
from comun import emblema, brillo as BRI
from los_nueve import defs

W, MARGEN = PICO.w, emblema.MARGEN
DEFS = defs()
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
ALTO = 130
CY, R = emblema.CY, emblema.LADO / 2

FONDOS = [('blanco', (255, 255, 255)), ('Discord claro', (242, 243, 245)),
          ('Discord oscuro', (49, 51, 56)), ('negro', (0, 0, 0))]

# (etiqueta, box-shadow). El acento entra como {a}.
TRATOS = [
    ('como está', '0 4px 14px rgba(0,0,0,.85),0 0 0 3px {a}'),
    ('contorno fino', '0 4px 14px rgba(0,0,0,.85),0 0 0 3px {a},'
                      '0 0 0 4.5px rgba(0,0,0,.85)'),
    ('contorno normal', '0 4px 14px rgba(0,0,0,.85),0 0 0 3px {a},'
                        '0 0 0 6px rgba(0,0,0,.9)'),
    ('contorno + filo interno',
     'inset 0 0 0 1.5px rgba(0,0,0,.5),0 4px 14px rgba(0,0,0,.85),'
     '0 0 0 1.5px rgba(0,0,0,.9),0 0 0 4.5px {a},0 0 0 6.5px rgba(0,0,0,.9)'),
    # ⚠️ DE DOS TONOS, y es la unica que puede funcionar en los dos extremos.
    # Un contorno de un solo tono no alcanza: el oscuro arregla el fondo
    # claro y se pierde en el oscuro. Con un filo oscuro Y una linea clara
    # por fuera, SIEMPRE hay uno de los dos que contrasta, sea cual sea el
    # fondo. Es lo que hace un rotulista con un doble filete, y es el mismo
    # principio que ya usan las estrellas —solo que ellas se lo ahorran
    # porque su relleno es blanco fijo y les alcanza con el filo oscuro.
    ('contorno de dos tonos',
     'inset 0 0 0 1.5px rgba(0,0,0,.45),0 4px 14px rgba(0,0,0,.85),'
     '0 0 0 2px rgba(0,0,0,.92),0 0 0 4.5px {a},'
     '0 0 0 6.2px rgba(0,0,0,.92),0 0 0 7.6px rgba(255,255,255,.72)'),
]


def b64(p):
    return ('data:image/png;base64,'
            + base64.b64encode(open(p, 'rb').read()).decode())


def esc(sv):
    return b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{sv.lower()}.png'))


def tope(sv, som, sufijo):
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    pieza = (f'<div class="pieza" style="top:{CY - R}px;width:{emblema.LADO}px;'
             f'height:{emblema.LADO}px;box-shadow:{som.format(a=B)};'
             f'background:{emblema.fondo_pieza(sv, A)}">'
             f'<img src="{esc(sv)}"></div>')
    return f"""<div class="tope">
  <svg class="d" width="0" height="0"><defs>
    <clipPath id="t{sufijo}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="tc" style="clip-path:url(#t{sufijo})">
    <div class="f" style="background:{FONDO}"></div>
    {f'<div class="f" style="{EXTRA}"></div>' if EXTRA else ''}
    {BRI.arriba(A)}
  </div>
  <svg class="bo" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#t{sufijo})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=sufijo)}{pieza}
</div>"""


CSS = f"""
body{{margin:0;background:transparent}}
.tope{{position:relative;width:{W}px;height:{ALTO}px}}
.tc{{position:absolute;left:0;top:0;width:{W}px;height:{PICO.h + MARGEN}px}}
.f{{position:absolute;left:0;top:0;width:{W}px;height:{PICO.h + MARGEN}px;
  background-repeat:repeat}}
.bo{{position:absolute;left:0;top:0;pointer-events:none}}
.d{{position:absolute}}
{BRI.css('luz', MARGEN, PICO.h)}
""" + emblema.CSS


def lum(c):
    v = [x / 255 for x in c]
    v = [(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4) for x in v]
    return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]


def contraste(a, b):
    l1, l2 = sorted((lum(a), lum(b)), reverse=True)
    return (l1 + .05) / (l2 + .05)


def medir(png, fondo):
    """El MEJOR contraste que ofrece el filo contra el fondo, donde no hay carta.

    ⚠️ TERCERA VERSION DE ESTA MEDICION, y las tres veces el error fue el
    mismo: el numero miraba al costado de lo que se estaba probando.

      1. Primero compare el color medio del emblema con el de la carta. Eso
         DIAGNOSTICA —dio 6.0 y confirmo que son el mismo color— pero un
         anillo no cambia ninguno de los dos, mete un tercero en el medio.
      2. Despues mire el filo contra el fondo, pero PROMEDIANDO la banda
         entera. Eso castiga justo al contorno de dos tonos: un filo negro
         mas uno blanco promedian gris, y contra un fondo gris el promedio
         dice "no se ve" cuando en pantalla se ven las dos lineas.
      3. Lo que corresponde es el MAXIMO: si CUALQUIER anillo de la banda
         contrasta con el fondo, hay borde. Un borde no necesita que toda la
         banda contraste; necesita una linea que si.

    La leccion que queda: cuando lo que se prueba es una ESTRUCTURA de
    varias capas, un promedio la borra. Hay que preguntar por el extremo.
    """
    im = Image.open(png).convert('RGBA')
    base = Image.new('RGBA', im.size, fondo + (255,))
    comp = np.array(Image.alpha_composite(base, im).convert('RGB')).astype(float)
    yy, xx = np.mgrid[0:comp.shape[0], 0:comp.shape[1]]
    d = ((xx - W / 2) ** 2 + (yy - CY) ** 2) ** .5
    # ⚠️ SOLO donde no hay carta detras: es el 61% del escudo y es justo lo
    # que la primera tanda se salteo entera.
    sin_carta = yy < MARGEN - 1
    lejos = sin_carta & (d > R + 16) & (d < R + 26)
    if lejos.sum() < 40:
        return None
    cl = [comp[:, :, i][lejos].mean() for i in range(3)]
    mejor = 1.0
    for r0 in np.arange(R, R + 9, 1.0):
        m = sin_carta & (d >= r0) & (d < r0 + 1)
        if m.sum() < 25:
            continue
        cf = [comp[:, :, i][m].mean() for i in range(3)]
        mejor = max(mejor, contraste(cf, cl))
    return mejor


async def main():
    tmp = os.path.join(SCR, '_fon')
    os.makedirs(tmp, exist_ok=True)
    orden = ['URBF', 'DRA', 'TFC', 'FRZ', 'SR', 'RZ']
    res = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': W, 'height': ALTO})
        for ti, (etq, som) in enumerate(TRATOS):
            for sv in orden:
                h = os.path.join(tmp, f'{sv}_{ti}.html')
                open(h, 'w', encoding='utf-8').write(
                    '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
                    + CSS + '</style></head><body>'
                    + tope(sv, som, f'f{ti}{sv}') + '</body></html>')
                await pg.goto('file://' + h)
                await pg.wait_for_timeout(170)
                png = os.path.join(tmp, f'{sv}_{ti}.png')
                await pg.screenshot(path=png, omit_background=True)
                for fn, fc in FONDOS:
                    res[(sv, ti, fn)] = medir(png, fc)
        await b.close()

    print('EL FILO DEL ESCUDO CONTRA EL FONDO, donde NO hay carta detras')
    print('  contraste WCAG. 1.00 = desaparecio.  3.00 = borde que se ve.\n')
    for fn, _ in FONDOS:
        print('  --- sobre %s ---' % fn)
        print('  %-6s' % 'sv' + ''.join('%14s' % t[0][:13] for t in TRATOS))
        for sv in orden:
            v = [res[(sv, t, fn)] for t in range(len(TRATOS))]
            print('  %-6s' % sv + ''.join('%14.2f' % x for x in v))
        m = [sum(res[(s, t, fn)] for s in orden) / len(orden)
             for t in range(len(TRATOS))]
        print('  %-6s' % 'MEDIA' + ''.join('%14.2f' % x for x in m) + '\n')

    print('  LO QUE MANDA ES EL PEOR CASO DE CADA UNO SOBRE TODOS LOS FONDOS:')
    print('  la carta cae sobre uno solo y no elegimos cual.\n')
    for t, (etq, _) in enumerate(TRATOS):
        pares = [(res[(s, t, f)], s, f) for s in orden for f, _ in FONDOS]
        peor = min(pares)
        print('    %-24s peor %.2f   (%s sobre %s)'
              % (etq, peor[0], peor[1], peor[2]))
    print('\n  ⚠️ Un contorno de UN SOLO TONO no puede ganar en los dos')
    print('     extremos: el oscuro arregla el fondo claro y se pierde en el')
    print('     oscuro. Por eso el de dos tonos, que siempre tiene uno de los')
    print('     dos filos contrastando sea cual sea el fondo.')

    # ── la hoja: el escudo sobre blanco y sobre negro ────────────────────
    bloques = []
    for ti, (etq, som) in enumerate(TRATOS):
        filas = []
        for fn, fc in FONDOS:
            cel = ''.join(
                f'<div class="g"><div class="gl">{sv}</div>'
                f'<div class="pv" style="background:rgb{fc}">'
                f'<img src="{b64(os.path.join(tmp, f"{sv}_{ti}.png"))}">'
                f'</div><div class="gs">{res[(sv, ti, fn)]:.2f}:1</div></div>'
                for sv in orden[:4])
            filas.append(f'<div class="sub">{fn}</div>'
                         f'<div class="fila">{cel}</div>')
        bloques.append(f'<div class="rot">{etq.upper()}</div>'
                       + ''.join(filas))

    hoja = f"""<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{{background:#0A0A10;margin:0;padding:30px;font-family:system-ui,sans-serif}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:800;letter-spacing:1.3px;
  margin:26px 0 4px;border-top:1px solid #23232E;padding-top:16px}}
.rot:first-child{{border:0;margin-top:0;padding-top:0}}
.sub{{color:#7A7A90;font-size:11px;font-weight:700;letter-spacing:1.2px;
  margin:12px 0 6px;text-transform:uppercase}}
.d1{{color:#8A8AA0;font-size:12.5px;margin:0 0 10px;max-width:1120px;line-height:1.55}}
.fila{{display:flex;gap:14px;flex-wrap:wrap}}
.g{{text-align:center}}
.gl{{color:#EDEDF5;font-size:10.5px;font-weight:800;letter-spacing:.9px;
  margin-bottom:5px}}
.gs{{color:#7A7A90;font-size:10px;font-family:ui-monospace,monospace;margin-top:4px}}
.pv{{width:{W}px;height:{ALTO}px;border-radius:6px;overflow:hidden}}
.pv img{{display:block;width:{W}px}}
</style></head><body>
<div class="rot">EL CONTORNO DEL ESCUDO</div>
<div class="d1">⚠️ <b>La tanda anterior midió en el lugar equivocado.</b>
Sampleaba solo donde <code>alpha&gt;250</code>, o sea <b>solo donde hay
carta</b> — pero el <b>61% del escudo cae fuera</b>. Medí el anillo justo
donde el anillo importa menos, y por eso los cuatro tratamientos daban
idénticos. No era que no sirvieran: <b>el número no los estaba mirando</b>.
<br><br>
<b>Qué es el contorno.</b> Las estrellas ya lo tienen:
<code>stroke="rgba(0,0,0,.66)" paint-order="stroke"</code> — un filo oscuro
<b>neutro</b> pegado a la figura, que existe para que tenga borde sobre
<b>cualquier</b> fondo. Está escrito en <code>comun/emblema.py</code> por qué:
«sobre blanco una estrella blanca da 1.00:1 y desaparece; la sombra no
alcanza porque es un desplazamiento hacia abajo y deja el borde de arriba sin
nada».<br><br>
<b>El escudo no lo tiene.</b> Tiene <code>0 0 0 3px {{acento}}</code> más una
sombra desplazada. Las dos fallan igual que fallaban en las estrellas: el
acento es <b>blanco en URBF y DRA</b> y casi blanco en TFC —un aro blanco
sobre fondo blanco no es un borde, es nada—, y la sombra va <b>hacia abajo</b>,
así que el borde de <b>arriba</b> queda sin nada. Y el borde de arriba del
escudo es justo el que está <b>100% fuera de la carta</b>.<br><br>
Acá el PNG se compone sobre los fondos de verdad y se mide el contraste del
filo <b>solo donde no hay carta detrás</b>. Es la misma unidad con la que este
proyecto ya midió las estrellas.</div>
{''.join(bloques)}
</body></html>"""
    out = os.path.join(SCR, 'emblema_fondos.html')
    open(out, 'w', encoding='utf-8').write(hoja)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1330, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2200)
        await pg.screenshot(path=os.path.join(SCR, 'emblema_fondos.png'),
                            full_page=True)
        await b.close()
    print('\n-> emblema_fondos.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
