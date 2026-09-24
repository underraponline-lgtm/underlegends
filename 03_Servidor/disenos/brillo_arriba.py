"""El brillo de arriba, a la intensidad elegida, en los DIEZ servidores.

⚠️ ESTA NO ES LA VERSION FINAL DE LA CARTA. El brillo si esta cerrado; el
LADO DERECHO SIGUE SIN DECIDIRSE.

QUE MUESTRA. La intensidad quedo elegida —Dlx sobre la tanda anterior:
"como estan los de abajo estan perfecto", que eran los cuatro servidores a
intensidad media— asi que esta hoja ya no compara intensidades: compara
SERVIDORES. La pregunta que queda abierta es si la tonalidad de cada uno se
lee, porque el brillo sale del color propio y ese color no vale lo mismo en
los diez.

⚠️ EL CASO DE RIESGO ES FFA, croma 42, menos de la cuarta parte que DRA
(194). Si la regla se rompe en alguno, se rompe ahi. Por eso esta la tabla
de croma abajo de la hoja y no solo las cartas.

LA DEFINICION NO VIVE ACA. Esta en comun/brillo.py, con la medicion que la
justifica. Este script solo la dibuja. Si alguna vez la copia, vuelve el
problema que el proyecto ya pago tres veces: dos copias, se arregla una y la
otra no.
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
from comun import emblema, divisor as DIV, nombre as NOM, brillo as BRI
from los_nueve import defs
from paneles import borde
import avatares

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN + 20
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
DEFS = defs()
BASE_Y = DIV.Y_EXTREMOS * PICO.h
SUBE = DIV.RECORRIDO * PICO.w * 1.3
ALTO_FOTO = round(BASE_Y) + 14
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]
ZOOM, POS = 115, 0.62                      # el encuadre elegido
Y_NOMBRE = NOM.Y['servidor']               # 280 -> 281 -> 281.6, dos pedidos
NOMBRES = ('VALEN', 'KONAN', 'BAU', 'HUMILDAD', 'BLOODY', 'JUASMIO',
           'MARK', 'PROVENZA', 'METEORO', 'KRTMAN')

_EST = json.load(open(os.path.join(BASE, 'datos', 'estrellas.json'),
                      encoding='utf-8'))['estrellas_por_servidor']


def n_est(sv):
    """Cuantos Interserver gano ese servidor.

    ⚠️ Sale de la clave estrellas_por_servidor, no de la raiz del JSON: el
    archivo tiene tambien las ediciones y los servidores eliminados. Leer la
    raiz devuelve 0 para todos EN SILENCIO y las estrellas desaparecen de la
    hoja sin que nada avise.
    """
    return int(_EST.get(sv, 0))


def y(v):
    return v + MARGEN


def rgba(hexc, a):
    h = hexc.lstrip('#')
    return 'rgba(%d,%d,%d,%.3f)' % (int(h[0:2], 16), int(h[2:4], 16),
                                    int(h[4:6], 16), a)


def croma(c):
    h = c.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return max(r, g, b) - min(r, g, b)


def b64(p):
    return ('data:image/png;base64,'
            + base64.b64encode(open(p, 'rb').read()).decode())


def esc(sv):
    return b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{sv.lower()}.png'))


M_FOTO = ('linear-gradient(180deg,#000 0%,#000 72%,rgba(0,0,0,.5) 92%,'
          'transparent 100%)')
VELO = 'linear-gradient(180deg,rgba(0,0,0,.30),rgba(0,0,0,.64))'

# Los diez, a la intensidad elegida. FFA va PRIMERO a proposito: es el de
# menos croma (42) y por lo tanto el que puede no llegar a teñir.
ORDEN = ['FFA', 'TFC', 'URBF', 'DRA', 'SR', 'TWR', 'FTN', 'FRZ', 'EFA', 'RZ']


def camino(n=90):
    xi, xd = borde(BASE_Y, 'izq'), borde(BASE_Y, 'der')
    return [(xi + (xd - xi) * (i / n), BASE_Y - DIV.altura(i / n) * SUBE)
            for i in range(n + 1)]


def panel_pie(pts):
    # el camino vive en comun/divisor.py: estaba copiado en ocho
    # scripts, todos con el mismo bug de la punta perdida
    return DIV.panel(pts, PTS, W, dy=MARGEN)


def carta(i, sv):
    cid = f'b{i}'
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    etq = f'{sv} · croma {croma(A)}'
    pts = camino()
    _, av = avatares.para(i)
    lado = W * ZOOM / 100
    nom = NOMBRES[i % len(NOMBRES)]
    foto =(f'<div class="foto" style="-webkit-mask-image:{M_FOTO};'
            f'mask-image:{M_FOTO}"><img src="{av}" style="width:{lado:.0f}px;'
            f'left:{(W-lado)/2:.1f}px;top:{-(lado-ALTO_FOTO)*POS:.1f}px">'
            f'</div>') if av else ''
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{FONDO}"></div>
    {f'<div class="cap" style="{EXTRA}"></div>' if EXTRA else ''}
    {foto}
    {BRI.arriba(A)}
    <div class="pie" style="background:{FONDO};clip-path:path('{panel_pie(pts)}')"></div>
    <div class="pie" style="background:{VELO};clip-path:path('{panel_pie(pts)}')"></div>
    <svg class="tra" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <path d="{'M' + ' L'.join('%.2f,%.2f' % (x, y(v)) for x, v in pts)}"
            fill="none" stroke="{B}" stroke-width="1.9" opacity=".9"
            stroke-linejoin="round"/>
    </svg>
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
    </g>
  </svg>
  <div class="nom" style="font-size:{NOM.rem(nom, 1.6)}rem">{nom}</div>
  {emblema.estrellas(n_est(sv), W, sufijo=cid)}
  {emblema.pieza(sv, A, B, esc(sv))}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:32px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:26px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:14px;min-height:18px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 8px}}
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 14px;max-width:1290px;line-height:1.55}}
.med{{color:#8A8AA0;font-size:12px;font-family:ui-monospace,monospace;
  white-space:pre;line-height:1.5;margin:0 0 18px}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0}}
.cap{{position:absolute;inset:0;background-repeat:repeat}}
.foto{{position:absolute;top:{MARGEN}px;left:0;width:{W}px;height:{ALTO_FOTO}px;
  overflow:hidden}}
.foto img{{position:absolute;height:auto;display:block}}
/* la luz va ENCIMA de la foto: debajo, la foto la tapa entera */
{BRI.css('luz', MARGEN, PICO.h)}
.pie{{position:absolute;inset:0;background-repeat:repeat}}
.tra{{position:absolute;inset:0;pointer-events:none}}
.nom{{position:absolute;left:0;right:0;top:{y(Y_NOMBRE)-16}px;text-align:center;
  z-index:9;font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;color:#fff;
  line-height:1;text-shadow:0 2px 6px rgba(0,0,0,.85)}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, sv) for i, sv in enumerate(ORDEN))
    fil = ['sv     acento    crom   propio    crom   encendido',
           '-' * 51]
    for sv in ORDEN:
        B, A = DEFS[sv][0], DEFS[sv][1]
        fil.append('%-6s %-9s %4d   %-9s %4d   %s'
                   % (sv, B, croma(B), A, croma(A), BRI.encender(A)))
    med = '\n'.join(fil)
    aviso = (
        'La intensidad quedó elegida —<b>media</b>: tiñe .55, llega al 24%, '
        'velo .30— así que esta hoja ya no compara intensidades: compara '
        '<b>servidores</b>. El brillo sale del <b>color propio</b>, y ese '
        'color no vale lo mismo en los diez.<br><br>'
        '⚠️ <b>FFA va primero a propósito</b>: es el de menos croma (<b>42</b>, '
        'contra 194 de DRA). Si la regla se rompe en alguno, se rompe ahí. '
        'Por eso está la tabla y no solo las cartas.<br><br>'
        'El <b>acento</b> no serviría para esto: es blanco o casi en tres de '
        'diez —TFC croma 9, URBF y DRA croma <b>0</b>— y ahí el brillo '
        '<b>no podría teñir nada</b>. El propio tiene croma en los diez.<br><br>'
        'La definición vive en <code>comun/brillo.py</code>, con la medición '
        'que la justifica. Este script solo la dibuja.<br><br>'
        '⚠️ <b>El brillo está cerrado; la carta no.</b> El <b>lado derecho '
        'sigue sin decidirse</b>. El nombre bajó 1 px, de y=280 a <b>y=281</b>.')
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">EL BRILLO DE ARRIBA EN LOS DIEZ SERVIDORES</div>'
           '<div class="aviso">' + aviso + '</div>'
           '<div class="med">' + med + '</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'brillo_arriba.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1362, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'brillo_arriba.png'),
                            full_page=True)
        await b.close()
    print('-> brillo_arriba.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
