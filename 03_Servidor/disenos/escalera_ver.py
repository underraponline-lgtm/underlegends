"""LA ESCALERA DEBAJO DEL NUMERO: solo esa zona, en cuatro formas.

Dlx: "muestrame que propones... quizas por overall? pero necesitamos decidir
tambien que va a medir el overall".

⚠️ NO DIBUJA LA CARTA ENTERA. Solo la columna de arriba —numero, escalera y
las dos primeras filas— porque es lo unico que se esta decidiendo.

Las cuatro formas salen de la medicion de ovr_que_mide.py: la escalera cuelga
del OVR, el OVR son PUNTOS EN ESE SERVIDOR sobre un tope FIJO, y por eso no
se pierde nunca. Lo que falta elegir es como se ve.
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
from comun import pie as PIE, iconos as IC, marco as MK
from los_nueve import defs

DEFS = defs()
# ⚠️ NO usar datos/colores_sv.json: trae RGB de 6 servidores y no los 10, y
# no es la definicion vigente. La canonica es defs() de los_nueve.py, que
# devuelve (acento, propio, fondo, extra, ...) —en ese orden, igual que la
# desarma todos_sv.py:131—.

# ── la escalera propuesta, por OVR ───────────────────────────────────────
# ⚠️ LOS CORTES NO SON REDONDOS A PROPOSITO: salen del reparto real de los
# puntos por servidor (ovr_que_mide.py). Con tope fijo 60 y raiz, la mediana
# de la gente cae en 51-62, asi que los escalones se abren ahi y no en 70-90,
# que estarian casi vacios.
ESCALERA = [(85, 'LEYENDA'), (72, 'MAESTRO'), (62, 'VETERANO'),
            (52, 'HABITUAL'), (0, 'NOVATO')]


def escalon(ovr):
    for lim, nom in ESCALERA:
        if ovr >= lim:
            return nom
    return ESCALERA[-1][1]


# muestra: cuatro servidores distintos para ver la escalera con colores
MUESTRA = [('TFC', 91, 'LEYENDA'), ('SR', 68, 'VETERANO'),
           ('DRA', 57, 'HABITUAL'), ('TWR', 49, 'NOVATO')]

FILAS = [('campeonatos', '7'), ('podios', '19'), ('racha', '8'),
         ('duelos', '12'), ('eventos', '34')]


def col(sv):
    acento, propio = DEFS[sv][0], DEFS[sv][1]
    return propio, acento


# ⚠️ EL RECORTE ES A LA DERECHA DE LA CARTA, no una caja aparte. La carta
# ancla la columna con `right:COL_DER`, asi que si el recorte comparte el
# borde derecho, las mismas reglas caen en el mismo lugar. Antes lo dibuje
# con `left:` en coordenadas de carta dentro de una caja de 96 px y el numero
# quedo afuera del recorte: no se veia ninguno.
CROP_W = 96
Y0_CROP = 28


def y(v):
    return v - Y0_CROP


def columna(sv, ovr, modo):
    """La columna de arriba: numero, escalera y las filas. Solo eso."""
    propio, acento = col(sv)
    nom = escalon(ovr)

    # ⚠️ LA PASTILLA CORRE LAS FILAS, EL TEXTO NO. Ocupa 17 px contra 8, y
    # abajo del numero hay 28 libres: sin correr, se encima con la primera.
    y0 = PIE.COL_Y0 + (8 if modo in 'BC' else 0)

    if modo == 'A':          # texto suelto, como el SSS de la Temporada
        eti = (f'<div class="esct" style="top:{y(PIE.COL_Y_OVR + 44)}px;'
               f'color:{acento}">{nom}</div>')
    elif modo == 'B':        # pastilla llena con el acento
        eti = (f'<div class="escp" style="top:{y(PIE.COL_Y_OVR + 42)}px;'
               f'background:{acento};color:#0B0D12">{nom}</div>')
    elif modo == 'C':        # pastilla de contorno, sin relleno
        eti = (f'<div class="escp" style="top:{y(PIE.COL_Y_OVR + 42)}px;'
               f'color:{acento};box-shadow:inset 0 0 0 1.2px {acento}">'
               f'{nom}</div>')
    else:                    # D: una regla fina arriba y el texto abajo
        eti = (f'<div class="escr" style="top:{y(PIE.COL_Y_OVR + 42)}px;'
               f'background:linear-gradient(90deg,transparent,{acento},'
               f'transparent)"></div>'
               f'<div class="esct" style="top:{y(PIE.COL_Y_OVR + 46)}px;'
               f'color:#FFF">{nom}</div>')

    filas = ''
    for i, (k, v) in enumerate(FILAS):
        filas += (f'<div class="mini" style="top:{y(y0 + i * PIE.COL_PASO) - 9}px">'
                  f'<div class="lin">{IC.svg(k, 15, .92)}<b>{v}</b></div>'
                  f'<span>{IC.ETIQUETA[k]}</span></div>')

    return f'''<div class="cw">
      <div class="col" style="background:{PIE.lavado(propio)}"></div>
      <div class="ovr" style="top:{y(PIE.COL_Y_OVR)}px"><b>{ovr}</b></div>
      {eti}{filas}
      <div class="tag">{modo} · {sv}</div>
    </div>'''


# ⚠️ LOS TAMAÑOS SON LOS DE LA CARTA, copiados de todos_sv.py:221-244. Si se
# los cambia aca, la muestra deja de decir como va a quedar.
CSS = f'''
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&display=swap');
body{{margin:0;background:#11141B;font-family:'Archivo',system-ui,sans-serif;
     display:flex;gap:13px;padding:18px}}
.cw{{position:relative;width:{CROP_W}px;height:214px;overflow:hidden;
    border-radius:9px;background:#0B0D12}}
.col{{position:absolute;top:0;bottom:0;right:{PIE.COL_DER}px;
    width:{PIE.COL_ANCHO}px;opacity:.94}}
.ovr{{position:absolute;right:{PIE.COL_DER}px;width:{PIE.COL_ANCHO}px;
    text-align:center;color:#fff}}
.ovr b{{display:block;font-size:3rem;font-weight:900;line-height:.92;
    -webkit-text-stroke:1.1px rgba(0,0,0,.62);paint-order:stroke fill;
    text-shadow:0 3px 10px rgba(0,0,0,.9)}}
.esct{{position:absolute;right:{PIE.COL_DER}px;width:{PIE.COL_ANCHO}px;
    text-align:center;font-size:.44rem;font-weight:800;letter-spacing:1.1px;
    text-shadow:0 1px 4px #000}}
.escp{{position:absolute;right:{PIE.COL_DER}px;width:{PIE.COL_ANCHO}px;
    font-size:.4rem;font-weight:800;letter-spacing:.7px;text-align:center;
    padding:2.4px 0;border-radius:8px;box-shadow:0 2px 5px rgba(0,0,0,.6)}}
.escr{{position:absolute;right:{PIE.COL_DER + 8}px;width:{PIE.COL_ANCHO - 16}px;
    height:1.2px}}
.mini{{position:absolute;right:{PIE.COL_DER}px;width:{PIE.COL_ANCHO}px;
    color:#fff;text-align:center;text-shadow:0 2px 6px rgba(0,0,0,.9)}}
.lin{{display:flex;align-items:center;justify-content:center;gap:4px;
    white-space:nowrap}}
.lin svg{{flex:none}}
.lin b{{font-size:.9rem;font-weight:900;line-height:1}}
.mini span{{display:block;font-size:.38rem;font-weight:800;letter-spacing:.9px;
    opacity:.68;margin-top:2px}}
.tag{{position:absolute;bottom:3px;left:0;right:0;text-align:center;
    font-size:.4rem;color:#7A8399;letter-spacing:.9px}}
'''


async def main():
    html = '<meta charset="utf-8"><style>%s</style>' % CSS
    for modo in 'ABCD':
        for sv, ovr, _ in MUESTRA:
            html += columna(sv, ovr, modo)
    p = os.path.join(SCR, '_escalera.html')
    open(p, 'w', encoding='utf-8').write(html)

    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 1400, 'height': 300},
                              device_scale_factor=3)
        await pg.goto('file:///' + p.replace('\\', '/'))
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=os.path.join(SCR, 'escalera_ver.png'),
                            full_page=True)
        await b.close()
    print('escalera_ver.png')
    print('  A texto suelto  ·  B pastilla llena  ·  C contorno  ·  D regla')
    for lim, nom in ESCALERA:
        print('  %-9s desde OVR %d' % (nom, lim))
    medir()


def _lum(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]


def contraste(a, b):
    la, lb = _lum(a), _lum(b)
    return (max(la, lb) + .05) / (min(la, lb) + .05)


def medir():
    """⚠️ LA MISMA TRAMPA DEL ACENTO, POR CUARTA VEZ.

    El acento no tiene croma en 3 de 10 y ademas su claridad va de casi negro
    a casi blanco. Ya mordio en el brillo de arriba, en el marco y en el aro
    del emblema. Un texto PINTADO con el acento sobre el lavado del MISMO
    servidor es exactamente el caso donde falla: los dos salen del mismo
    color, asi que se parecen por construccion.

    Se mide el texto contra el lavado que tiene detras (su tramo del medio,
    tono(propio,-.10), que es donde cae la etiqueta).
    """
    from comun.emblema import tono
    print('\n   contraste del texto contra lo que tiene atras (WCAG, >=4.5 pasa)')
    print('   %-6s %7s %7s %7s %7s' % ('sv', 'A texto', 'B llena', 'C cont', 'D blanco'))
    print('   ' + '-' * 42)
    malos = {k: 0 for k in 'ABCD'}
    for sv in DEFS:
        propio, acento = col(sv)
        fondo = tono(propio, -.10)
        v = {'A': contraste(acento, fondo), 'B': contraste('#0B0D12', acento),
             'C': contraste(acento, fondo), 'D': contraste('#FFFFFF', fondo)}
        for k in v:
            if v[k] < 4.5:
                malos[k] += 1
        print('   %-6s %7.1f %7.1f %7.1f %7.1f'
              % (sv, v['A'], v['B'], v['C'], v['D']))
    print('   ' + '-' * 42)
    print('   %-6s %7s %7s %7s %7s' % ('no pasan',
          '%d/10' % malos['A'], '%d/10' % malos['B'],
          '%d/10' % malos['C'], '%d/10' % malos['D']))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(main())
