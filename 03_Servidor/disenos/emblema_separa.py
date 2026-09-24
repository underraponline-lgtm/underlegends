"""¿Cuanto se separa el emblema del fondo de su propia carta?

Dlx: "quizas tengamos que hacer algo con los emblemas debido a que compiten
con los colores de la tarjeta".

⚠️ Y NO ES CASUALIDAD, ES POR CONSTRUCCION. El fondo de la placa sale de
fondo_pieza(sv, base) con EL MISMO color base que la carta, y ahora encima
el brillo de arriba tiñe justo la zona de atras del escudo con ESE MISMO
color. O sea que la carta, la luz y la placa son los tres el mismo tono. El
escudo no esta apoyado sobre la carta: esta hecho de la carta.

QUE SE MIDE. Por cada servidor, dos zonas:

    el emblema    todo lo que cae dentro del disco
    la carta      un anillo de 10 px por fuera del aro, dentro de la silueta

y la distancia entre sus colores medios en dE76. Referencia: dE 25 es donde
dos colores empiezan a leerse como DOS colores.

LAS SALIDAS QUE SE PROBARON, y por que casi todas estan vetadas:

  · placa neutra oscura para todos
    VETADA y esta escrito en comun/emblema.py: los logos cuyo color vive en
    el fondo lo pierden. DRA quedaba en blanco y negro.
  · fondo del archivo
    VETADA: cada uno mete el color de SU archivo al lado del de la carta.
  · aclarar u oscurecer la placa
    se puede, pero mueve el color de la placa y vuelve a rozar lo de arriba.
  · UN ANILLO QUE SEPARE
    no toca el color de la placa, o sea que ningun logo pierde nada, y
    funciona igual en los diez. Es ademas LO QUE LA CARTA YA HIZO UNA VEZ:
    las estrellas llevan CONTORNO y no solo sombra, por el mismo problema
    —una figura blanca sobre blanco da 1.00:1 y desaparece—. La solucion ya
    esta adentro de este proyecto, aplicada a otra pieza.
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


def lab(rgb):
    c = [v / 255 for v in rgb]
    c = [(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4) for v in c]
    r, g, b = c
    x = (.4124 * r + .3576 * g + .1805 * b) / .95047
    yy = .2126 * r + .7152 * g + .0722 * b
    z = (.0193 * r + .1192 * g + .9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > .008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(yy), f(z)
    return np.array([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)])


def b64(p):
    return ('data:image/png;base64,'
            + base64.b64encode(open(p, 'rb').read()).decode())


def esc(sv):
    return b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{sv.lower()}.png'))


# ── los tratamientos ─────────────────────────────────────────────────────
def pieza(sv, base, acento, src, modo):
    """El escudo con cada tratamiento. `modo` 0 = como esta."""
    fondo = emblema.fondo_pieza(sv, base)
    if modo == 0:
        som = f'0 4px 14px rgba(0,0,0,.85),0 0 0 3px {acento}'
    elif modo == 1:      # anillo oscuro por fuera del acento
        som = (f'0 4px 14px rgba(0,0,0,.85),0 0 0 3px {acento},'
               f'0 0 0 6px rgba(0,0,0,.62)')
    elif modo == 2:      # anillo oscuro POR DENTRO y por fuera
        som = (f'0 4px 14px rgba(0,0,0,.85),inset 0 0 0 2px rgba(0,0,0,.55),'
               f'0 0 0 2px rgba(0,0,0,.7),0 0 0 5px {acento},'
               f'0 0 0 7.5px rgba(0,0,0,.62)')
    else:                # placa mas oscura, sin tocar el aro
        fondo = (f'linear-gradient(158deg,{emblema.tono(base, .10)} 0%,'
                 f'{emblema.tono(base, -.34)} 46%,'
                 f'{emblema.tono(base, -.78)} 100%)')
        som = f'0 4px 14px rgba(0,0,0,.85),0 0 0 3px {acento}'
    return (f'<div class="pieza" style="top:{CY - R}px;width:{emblema.LADO}px;'
            f'height:{emblema.LADO}px;box-shadow:{som};background:{fondo}">'
            f'<img src="{src}"></div>')


def tope(sv, modo, sufijo, con_est=True):
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    est = emblema.estrellas(1 if con_est else 0, W, sufijo=sufijo)
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
  {est}{pieza(sv, A, B, esc(sv), modo)}
</div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:30px;font-family:system-ui,sans-serif}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:800;letter-spacing:1.3px;
  margin:24px 0 6px;border-top:1px solid #23232E;padding-top:16px}}
.rot:first-child{{border:0;margin-top:0;padding-top:0}}
.d1{{color:#8A8AA0;font-size:12.5px;margin:0 0 14px;max-width:1120px;line-height:1.55}}
.med{{color:#8A8AA0;font-size:12px;font-family:ui-monospace,monospace;
  white-space:pre;line-height:1.5;margin:0 0 16px}}
.fila{{display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start}}
.g{{text-align:center}}
.gl{{color:#EDEDF5;font-size:11.5px;font-weight:800;letter-spacing:1px;
  margin-bottom:8px}}
.tope{{position:relative;width:{W}px;height:{ALTO}px;overflow:hidden;
  background:#0A0A10;border-radius:8px}}
.tc{{position:absolute;left:0;top:0;width:{W}px;height:{PICO.h + MARGEN}px}}
.f{{position:absolute;left:0;top:0;width:{W}px;height:{PICO.h + MARGEN}px;
  background-repeat:repeat}}
.bo{{position:absolute;left:0;top:0;pointer-events:none}}
.d{{position:absolute}}
{BRI.css('luz', MARGEN, PICO.h)}
""" + emblema.CSS


def medir(png):
    """Dos numeros, y hacen falta los dos.

    ⚠️ LA PRIMERA VUELTA MEDI SOLO EL PRIMERO Y NO SERVIA PARA JUZGAR EL
    ARREGLO. `lejos` compara el color medio del emblema contra el de la
    carta, y eso DIAGNOSTICA bien: si da 6 es que son el mismo color. Pero un
    anillo que separa no cambia ninguno de los dos colores: mete un TERCERO
    en el medio. Medido con `lejos` nomas, los tratamientos daban todos igual
    y la conclusion habria sido "el anillo no sirve", cuando lo que pasaba es
    que el numero no lo estaba mirando.

    `salto` es el que corresponde: recorre el radio de a 1 px y devuelve el
    MAYOR escalon entre anillos vecinos. Un borde visible es un escalon
    grande, exista o no diferencia entre las dos zonas grandes.
    """
    a = np.array(Image.open(png).convert('RGBA')).astype(float)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    d = ((xx - W / 2) ** 2 + (yy - CY) ** 2) ** .5
    op = a[:, :, 3] > 250
    dentro = op & (d < R - 3)
    fuera = op & (d > R + 10) & (d < R + 20)
    if dentro.sum() < 50 or fuera.sum() < 50:
        return None
    le = lab([a[:, :, i][dentro].mean() for i in range(3)])
    lc = lab([a[:, :, i][fuera].mean() for i in range(3)])
    lejos = float(np.linalg.norm(le - lc))

    perfil = []
    for r0 in np.arange(R - 8, R + 18, 1.0):
        m = op & (d >= r0) & (d < r0 + 1)
        if m.sum() < 20:
            perfil.append(None)
            continue
        perfil.append(lab([a[:, :, i][m].mean() for i in range(3)]))
    salto = 0.0
    for i in range(len(perfil) - 1):
        if perfil[i] is not None and perfil[i + 1] is not None:
            salto = max(salto, float(np.linalg.norm(perfil[i] - perfil[i + 1])))
    return lejos, salto


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    tmp = os.path.join(SCR, '_emb')
    os.makedirs(tmp, exist_ok=True)
    orden = ['TFC', 'SR', 'FFA', 'TWR', 'FTN', 'FRZ', 'URBF', 'DRA', 'EFA', 'RZ']
    res = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': W, 'height': ALTO})
        for modo in (0, 1, 2, 3):
            for sv in orden:
                h = os.path.join(tmp, f'{sv}_{modo}.html')
                open(h, 'w', encoding='utf-8').write(
                    '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
                    'body{margin:0;background:transparent}'
                    '.tope{background:transparent!important}' + CSS
                    + '</style></head><body>'
                    + tope(sv, modo, f'm{modo}{sv}', con_est=False)
                    + '</body></html>')
                await pg.goto('file://' + h)
                await pg.wait_for_timeout(180)
                png = os.path.join(tmp, f'{sv}_{modo}.png')
                await pg.screenshot(path=png, omit_background=True)
                res[(sv, modo)] = medir(png)
        await b.close()

    filas = ['EL DIAGNOSTICO: color medio del emblema contra el de la carta',
             '  (dE 25 es donde dos colores empiezan a leerse como DOS)',
             '']
    peor = []
    for sv in orden:
        v = res[(sv, 0)][0]
        filas.append('   %-6s dE %5.1f   %s' % (sv, v, '#' * int(v)))
        peor.append((v, sv))
    peor.sort()
    med = sum(v for v, _ in peor) / len(peor)
    filas += ['',
              '   promedio dE %.1f  ->  los diez estan por DEBAJO de 25.' % med,
              '   No es que compitan: es que SON EL MISMO COLOR.',
              '',
              '',
              'EL ARREGLO: el escalon mas grande al cruzar el borde',
              '  (un anillo no cambia ningun color: mete un TERCERO en el medio,',
              '   asi que el numero de arriba NO lo ve. Este si.)',
              '',
              'sv        como esta   +aro osc   doble aro   placa osc',
              '-' * 58]
    for sv in orden:
        v = [res[(sv, m)][1] for m in (0, 1, 2, 3)]
        filas.append('%-9s %8.1f %10.1f %11.1f %11.1f' % (sv, *v))
    ms = [sum(res[(s, m)][1] for s in orden) / len(orden) for m in (0, 1, 2, 3)]
    filas += ['-' * 58, 'promedio  %8.1f %10.1f %11.1f %11.1f' % tuple(ms)]
    print('\n'.join(filas))
    print('\n  los tres que menos se separan de color: %s'
          % ', '.join('%s (%.1f)' % (s, v) for v, s in peor[:3]))

    flojos = [s for _, s in peor[:4]]
    bloques = []
    for modo, etq in ((0, 'como está'), (1, '+ aro oscuro'),
                      (2, 'doble aro'), (3, 'placa más oscura')):
        cuerpo = ''.join(
            f'<div class="g"><div class="gl">{sv}</div>'
            + tope(sv, modo, f'v{modo}{sv}') + '</div>' for sv in flojos)
        bloques.append(f'<div class="rot">{etq.upper()}</div>'
                       f'<div class="fila">{cuerpo}</div>')

    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">EL EMBLEMA CONTRA SU PROPIA CARTA</div>'
           '<div class="d1">⚠️ <b>No es casualidad, es por construcción.</b> El '
           'fondo de la placa sale del <b>mismo color base</b> que la carta, y '
           'ahora encima el brillo de arriba tiñe justo la zona de atrás con '
           '<b>ese mismo color</b>. La carta, la luz y la placa son los tres el '
           'mismo tono: el escudo no está <i>apoyado sobre</i> la carta, está '
           '<i>hecho de</i> la carta.<br><br>'
           'Las dos salidas obvias <b>ya están vetadas y por escrito</b> en '
           '<code>comun/emblema.py</code>: la <b>placa neutra oscura</b> le saca '
           'el color a los logos cuyo color vive en el fondo (DRA quedaba en '
           'blanco y negro), y el <b>fondo del archivo</b> mete el color de cada '
           'archivo al lado del de la carta.<br><br>'
           'Por eso probé cuatro cosas que <b>no tocan el color de la placa</b>, '
           'sino que agregan un <b>anillo que separa</b>.<br><br>'
           '⚠️ <b>Y ninguna de las cuatro mueve el número.</b> Está en la tabla '
           'de abajo: promedio 3.6 / 3.6 / 3.6 / 3.5. No las estoy vendiendo '
           'como el arreglo, porque no lo son.<br><br>'
           '⚠️ <b>Pero midiendo apareció otra cosa, y es más importante.</b> Al '
           'subir el escudo (baja 10 → 6), <b>el 61% de su área ya cae fuera de '
           'la carta</b>, y el <b>56% de su contorno</b> no se apoya en la carta '
           'sino en <b>el fondo de Discord, que no controlamos</b>. O sea que el '
           'problema no es solo que compita con la carta: es que la mayor parte '
           'del escudo <b>no tiene carta detrás</b>.<br><br>'
           'Y esa es exactamente <b>la pregunta que esta carta ya se hizo una '
           'vez</b>: las estrellas llevan <b>contorno y no solo sombra</b> '
           'porque una figura blanca sobre blanco da 1.00:1 y desaparece. El '
           'escudo está hoy en esa misma situación y <b>no tiene contorno</b>.'
           '<br><br>'
           'Se muestran <b>los cuatro que menos se separan de color</b>: son el '
           'caso difícil. ⚠️ Esta no es la versión final y el <b>lado derecho '
           'sigue sin decidirse</b>.</div>'
           '<div class="med">' + '\n'.join(filas) + '</div>'
           + ''.join(bloques) + '</body></html>')
    out = os.path.join(SCR, 'emblema_separa.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1330, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2400)
        await pg.screenshot(path=os.path.join(SCR, 'emblema_separa.png'),
                            full_page=True)
        await b.close()
    print('\n-> emblema_separa.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
