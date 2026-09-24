"""Cuantas filas entran en la columna, y si el par 8/12 cabe.

Dlx: "quizas añadir otras cosas que mencione tambien? como hariamos eso por
ejemplo racha de 8/12".

El par actual/maxima es el formato que ya usa la Competitiva —"3/12 R" en su
pastilla de racha— asi que no se inventa nada. Pero UN PAR ES MAS ANCHO QUE
UN NUMERO, y la columna mide 56 px. Antes de decidir hay que medir si entra.

⚠️ Y ESTO NO SE PUEDE MIRAR: a 0.36rem la etiqueta mide unos 6 px de alto y
"casi entra" y "se desborda 2 px" se ven igual en pantalla. Se mide el ancho
real del contenido de cada fila contra los 56 px que hay.

TAMBIEN SE MIDE CUANTAS FILAS CABEN. La columna va del OVR hasta el divisor,
y el divisor NO es horizontal: sube hacia el centro. En el eje de la columna
—x=260— pasa mas abajo que en el medio, asi que el lugar disponible no es el
que se calcularia con la altura del divisor en su cima.
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
from comun import emblema, divisor as DIV, brillo as BRI, nombre as NOM
from comun import rangos as RG, pie as PIE, iconos as ICO
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
M_FOTO = ('linear-gradient(180deg,#000 0%,#000 72%,rgba(0,0,0,.5) 92%,'
          'transparent 100%)')
_EST = json.load(open(os.path.join(BASE, 'datos', 'estrellas.json'),
                      encoding='utf-8'))['estrellas_por_servidor']
LAVADO = (13, 25, 43)
ANCHO_COL = 56
X_COL = W - 12 - ANCHO_COL // 2          # el eje de la columna

TROFEO = ('M6 3 H18 V5 H22 V9 Q22 13 18 14 Q17 17 13 17.5 V20 H16 V22 H8 '
          'V20 H11 V17.5 Q7 17 6 14 Q2 13 2 9 V5 H6 Z')
FUEGO = ('M12 2 Q14 7 17 9.5 Q20 12 20 15 Q20 21 12 22 Q4 21 4 15 '
         'Q4 12 7 9.5 Q9 8 9.5 5.5 Q11 7 12 2 Z')
ESPADAS = ('M3 3 L7 3 L20 16 L20 20 L16 20 L3 7 Z M21 3 L17 3 L4 16 L4 20 '
           'L8 20 L21 7 Z')
DIANA = ('M12 2 A10 10 0 1 1 11.9 2 Z M12 7 A5 5 0 1 1 11.9 7 Z '
         'M12 11 A1 1 0 1 1 11.9 11 Z')

# ⚠️ CON ETIQUETA, pero ABAJO del numero y no al lado. Dlx la queria, y al
# lado era justo lo que desbordaba los 56 px: "8/12 RACHA" medía 79.
# Debajo, la fila mide lo que mide el numero —50 px— y la etiqueta puede ser
# tan larga como quiera. Ademas es el patron que EL OVR YA USA en esta misma
# columna: numero grande arriba, etiqueta chica abajo.
FILAS = [('titulos', '3'), ('racha', '8/12'),
         ('duelos', '9/14'), ('eventos', '27')]

# ⚠️ ARRIBA HAY 48 px MUERTOS. El escudo termina en y=40 y con su contorno de
# dos tonos llega a 48; el OVR arranca en 96. Dlx: "hay espacio arriba, o sea
# podemos poner todo mas arriba si deseamos".
#
# La zona util de la columna va de y=48 (abajo del escudo) a y=265.2, que es
# donde pasa el divisor EN EL EJE DE LA COLUMNA —no en su cima—. Son 217 px
# para un bloque de OVR + 4 filas.
#
# (etiqueta, y del OVR, y de la primera fila, paso entre filas)
# ⚠️ con la etiqueta abajo cada fila mide ~22 px, asi que el paso no puede
# ser 24: se tocarian. El minimo real es 28.
CASOS = [
    ('A · como estaba', 96, 172, 28),
    ('B · todo arriba', 58, 134, 28),
    ('C · centrado', 74, 150, 30),
    ('D · repartido', 58, 132, 34),
]
Y0, PASO = 168, 24


def y(v):
    return v + MARGEN


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


def y_borde(x):
    """A que altura la carta llega a esa x. Es el techo REAL de la columna.

    ⚠️ NO ES EL ESCUDO, y esa fue mi equivocacion. Yo tome como techo el
    borde de abajo del escudo (y=48), pero el escudo va de x=116 a x=184 y la
    columna de x=232 a x=288: NO SE SUPERPONEN. Arriba de la columna no hay
    escudo, hay borde de carta.

    El pico mide 41.6 px planos y se abre 8.28 por cada y, asi que la
    semi-anchura vale 20.8 + 4.14*y. Despejando, la carta recien alcanza
    x=260 en y=21.5. O sea que hay MUCHO mas lugar arriba del que yo habia
    medido, y por eso "todo arriba" no quedaba apretado: mi numero estaba mal.
    """
    return max((abs(x - PICO.w / 2) - 20.8) / 4.14, 0)


def y_divisor(x):
    """A que altura pasa el divisor EN esa x. No es horizontal."""
    xi, xd = borde(BASE_Y, 'izq'), borde(BASE_Y, 'der')
    u = min(max((x - xi) / (xd - xi), 0), 1)
    return BASE_Y - DIV.altura(u) * SUBE


def carta(ci, sufijo):
    etq, y_ovr, y0, paso = CASOS[ci]
    filas = FILAS
    sv, rg, cc, p, tot, ovr = 'TFC', 'SS', 'co', 1, 79, 91
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    pts = camino()
    _, av = avatares.para(1)
    lado = W * 115 / 100
    a, b, c = LAVADO
    m = (f'linear-gradient(270deg,#000 0%,#000 {a}%,'
         f'rgba(0,0,0,.5) {b}%,transparent {c}%)')
    minis = ''.join(
        f'<div class="mini" id="m{sufijo}{k}" style="top:{y(y0+k*paso)-9}px">'
        f'<div class="lin">{ICO.svg(ic, 15)}<b>{v}</b></div>'
        f'<span>{ICO.ETIQUETA[ic]}</span></div>'
        for k, (ic, v) in enumerate(filas))
    return f"""<div class="wrap">
  <svg class="d" width="0" height="0"><defs>
    <clipPath id="{sufijo}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cu" style="clip-path:url(#{sufijo})">
    <div class="f" style="background:{FONDO}"></div>
    {f'<div class="f" style="{EXTRA}"></div>' if EXTRA else ''}
    <div class="foto" style="-webkit-mask-image:{M_FOTO};mask-image:{M_FOTO}">
      <img src="{av}" style="width:{lado:.0f}px;left:{(W-lado)/2:.1f}px;
           top:{-(lado-ALTO_FOTO)*.44:.1f}px"></div>
    <div class="wash" style="background:{FONDO};
         -webkit-mask-image:{m};mask-image:{m}"></div>
    {BRI.arriba(A)}
    <div class="f" style="background:{FONDO};clip-path:path('{panel_pie(pts)}')"></div>
    <div class="f" style="background:{VELO};clip-path:path('{panel_pie(pts)}')"></div>
    <svg class="f" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <path d="{'M' + ' L'.join('%.2f,%.2f' % (x, y(v)) for x, v in pts)}"
            fill="none" stroke="{B}" stroke-width="1.9" opacity=".9"/>
    </svg>
  </div>
  <svg class="bo" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{sufijo})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
    </g>
  </svg>
  <div class="ovr" style="top:{y(y_ovr)}px"><b>{ovr}</b><span>OVR SV</span></div>{minis}
  <div class="nom" style="font-size:{NOM.rem('AXINU', 1.6)}rem">AXINU</div>
  <img class="ban" src="https://flagcdn.com/w80/{cc}.png"
       style="left:{PIE.X_BAN-PIE.LADO/2}px;top:{y(PIE.Y_FILA)-PIE.LADO*.36:.1f}px;
       width:{PIE.LADO}px;height:{PIE.LADO*.72:.1f}px">
  <div class="pst"><b>{p}º</b><span>DE {tot}</span></div>
  {RG.svg(rg, PIE.LADO, PIE.X_FIG, y(PIE.Y_FILA), sufijo, clase='fig')}
  <img class="ul" src="{UL}">
  {emblema.estrellas(int(_EST.get(sv, 0)), W, sufijo=sufijo)}
  {emblema.pieza(sv, A, B, b64(os.path.join(BASE, 'comun', 'escudos_cuad',
                                            f'sv_{sv.lower()}.png')))}
</div>"""


UL = b64(os.path.join(BASE, '01_Temporada', 'ul_blanco.png'))

CSS = f"""
body{{margin:0;background:transparent}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.d{{position:absolute}}
.cu{{position:absolute;inset:0}}
.bo{{position:absolute;inset:0;pointer-events:none}}
.f{{position:absolute;inset:0;background-repeat:repeat}}
.foto{{position:absolute;top:{MARGEN}px;left:0;width:{W}px;height:{ALTO_FOTO}px;
  overflow:hidden}}
.foto img{{position:absolute;height:auto;display:block}}
.wash{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{BASE_Y:.0f}px}}
{BRI.css('luz', MARGEN, PICO.h)}
.ovr{{position:absolute;right:12px;width:{ANCHO_COL}px;
  text-align:center;z-index:9;font-family:'Archivo','LigaEmoji',sans-serif;color:#fff}}
.ovr b{{display:block;font-size:2.05rem;font-weight:900;line-height:1;
  text-shadow:0 2px 8px rgba(0,0,0,.9)}}
.ovr span{{display:block;font-size:.44rem;font-weight:800;letter-spacing:1.1px;
  opacity:.75;margin-top:4px}}
/* ⚠️ sin width fijo: se deja crecer para PODER MEDIR si se pasa de 56 */
.mini{{position:absolute;right:12px;z-index:9;width:{ANCHO_COL}px;
  color:#fff;font-family:'Archivo','LigaEmoji',sans-serif;text-align:center;
  text-shadow:0 2px 6px rgba(0,0,0,.9)}}
.lin{{display:flex;align-items:center;justify-content:center;gap:4px;
  white-space:nowrap}}
.lin svg{{flex:none;opacity:.92}}
.lin b{{font-size:.9rem;font-weight:900;line-height:1}}
.mini span{{display:block;font-size:.38rem;font-weight:800;letter-spacing:.9px;
  opacity:.68;margin-top:2px}}
.nom{{position:absolute;left:0;right:0;top:{y(NOM.Y['servidor'])-16}px;
  text-align:center;z-index:9;font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;
  color:#fff;line-height:1;text-shadow:0 2px 6px rgba(0,0,0,.85)}}
.fig{{position:absolute;z-index:9;filter:drop-shadow(0 2px 6px rgba(0,0,0,.75))}}
.ban{{position:absolute;border-radius:2.5px;object-fit:cover;z-index:9;
  box-shadow:0 2px 6px rgba(0,0,0,.8),0 0 0 1.3px rgba(255,255,255,.5)}}
.pst{{position:absolute;left:{PIE.X_PST-34}px;top:{y(PIE.Y_FILA)-15}px;
  width:68px;text-align:center;color:#fff;z-index:9;
  font-family:'Archivo','LigaEmoji',sans-serif;line-height:1}}
.pst b{{display:block;font-size:1.16rem;font-weight:900;
  text-shadow:0 2px 5px rgba(0,0,0,.9)}}
.pst span{{display:block;font-size:.42rem;font-weight:800;letter-spacing:1.1px;
  opacity:.72;margin-top:3px}}
.ul{{position:absolute;left:50%;transform:translateX(-50%);height:{PIE.UL_H}px;
  width:auto;z-index:9;top:{y(PIE.UL_Y)}px}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    tmp = os.path.join(SCR, '_col2')
    os.makedirs(tmp, exist_ok=True)

    yd = y_divisor(X_COL)
    print('CUANTO LUGAR HAY EN LA COLUMNA')
    print('  el eje de la columna esta en x=%d' % X_COL)
    print('  el divisor pasa por ahi en y=%.1f, no en su cima (%.1f)'
          % (yd, BASE_Y - SUBE))
    print('  la ultima fila que entra sin pisarlo: y=%.0f  ->  caben %d filas'
          % (yd - 14, int((yd - 14 - Y0) // PASO) + 1))
    print()
    print('EL ANCHO DE CADA FILA CONTRA LOS %d px DE LA COLUMNA' % ANCHO_COL)
    print()

    anchos = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': W, 'height': ALTO},
                              device_scale_factor=3)
        for ci, (etq, y_ovr, y0, paso) in enumerate(CASOS):
            h = os.path.join(tmp, f'{ci}.html')
            open(h, 'w', encoding='utf-8').write(
                '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
                + fuentes + CSS + '</style></head><body>'
                + carta(ci, f'c{ci}') + '</body></html>')
            await pg.goto('file://' + h)
            await pg.wait_for_timeout(300)
            fin = y0 + (len(FILAS) - 1) * paso + 9
            anchos[ci] = (y_borde(X_COL), y_ovr, fin, y_divisor(X_COL))
            await pg.screenshot(path=os.path.join(tmp, f'{ci}.png'),
                                clip={'x': 0, 'y': MARGEN - 40,
                                      'width': W, 'height': 350},
                                omit_background=True)
        await b.close()

    print('  %-26s %9s %9s   %s' % ('', 'aire', 'aire', ''))
    print('  %-26s %9s %9s   %s' % ('', 'arriba', 'abajo', 'reparto'))
    print('  ' + '-' * 58)
    for ci, (etq, y_ovr, y0, paso) in enumerate(CASOS):
        tope, yo, fin, yd = anchos[ci]
        arr_, ab = yo - tope, yd - fin
        nota = ('parejo' if abs(arr_ - ab) < 12
                else ('cae arriba' if arr_ < ab else 'cae abajo'))
        print('  %-26s %6.0f px %6.0f px   %s' % (etq, arr_, ab, nota))
    print("""
  ⚠️ ESTA TABLA SALIO MAL LA PRIMERA VEZ Y CONVIENE DECIR POR QUE. Yo habia
  tomado como techo el borde de abajo del ESCUDO (y=48), razonando que el
  bloque "limita con una pieza pesada". Pero el escudo va de x=116 a x=184 y
  la columna de x=232 a x=288: NO SE SUPERPONEN. Arriba de la columna no hay
  escudo, hay borde de carta, y la carta recien alcanza x=260 en y=21.5.

  O sea que habia 26 px mas de los que yo habia contado, y mi argumento de
  "dejar mas aire arriba porque el escudo pesa" no aplicaba: el escudo no
  esta arriba de la columna, esta arriba del centro.

  Con el techo correcto, lo que decide es otra cosa: abajo el bloque SI
  limita con el divisor, que cruza justo ahi. Conviene que el aire de abajo
  no sea el mas chico de los dos, para que el ultimo numero no parezca
  apoyado en la curva.
""")

    cel = ''.join(
        f'<div class="g"><div class="gl">{CASOS[ci][0]}</div>'
        f'<img class="z" src="{b64(os.path.join(tmp, f"{ci}.png"))}"></div>'
        for ci in range(len(CASOS)))
    hoja = f"""<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{{background:#0A0A10;margin:0;padding:30px;font-family:system-ui,sans-serif}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:800;letter-spacing:1.3px;margin:0 0 8px}}
.d1{{color:#8A8AA0;font-size:12.5px;margin:0 0 18px;max-width:1180px;line-height:1.55}}
.fila{{display:flex;gap:18px;flex-wrap:wrap}}
.g{{text-align:center}}
.gl{{color:#EDEDF5;font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:7px}}
.z{{display:block;width:{W}px;border-radius:8px;background:#12121A}}
</style></head><body>
<div class="rot">CUÁNTO ENTRA EN LA COLUMNA</div>
<div class="d1">El par <code>8/12</code> es el formato que ya usa la
Competitiva (<code>3/12 R</code>), así que no se inventa nada. Pero <b>un par
es más ancho que un número</b> y la columna mide <b>56 px</b>.<br><br>
⚠️ <b>Esto no se puede mirar</b>: a 0.36rem la etiqueta mide unos 6 px y
«casi entra» y «se desborda 2 px» se ven igual. Los números están en la
consola.<br><br>
⚠️ Y el <b>divisor no es horizontal</b>: sube hacia el centro, así que en el
eje de la columna pasa <b>más abajo</b> que en su cima. El lugar disponible es
mayor de lo que parece — pero ojo, eso también significa que una fila de más
se acerca al borde, no al centro.</div>
<div class="fila">{cel}</div>
</body></html>"""
    out = os.path.join(SCR, 'columna_filas.html')
    open(out, 'w', encoding='utf-8').write(hoja)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1330, 'height': 900},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(1800)
        await pg.screenshot(path=os.path.join(SCR, 'columna_filas.png'),
                            full_page=True)
        await b.close()
    print('\n-> columna_filas.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
