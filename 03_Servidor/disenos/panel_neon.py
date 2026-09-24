"""La colina medida, el panel derecho con neon, y el UL ajustado.

LA CURVA, TRAZADA COLUMNA POR COLUMNA sobre FINAL REFERENCIA:

    y promedio del divisor   64.1% del alto
    punto mas alto           +5.3 px sobre el promedio
    punto mas bajo           -5.8 px
    RECORRIDO TOTAL          11.1 px  =  4.4% del alto

⚠️ Yo venia usando 28 px de flecha sobre una carta de 405, o sea 6.9%. El
real es 4.4%: una vez y media de mas. Por eso se leia como cupula y no como
colina. En nuestra carta son 18 px, no 28.

⚠️ Y ojo con como lo dijo Dlx: "no es solo asi un arco, es una subida
bajada". El perfil trazado da -5.8 -4.6 -2.5 -0.3 +1.8 +3.6 +4.5 +5.3 +4.7
+3.7 +2.0 0.0 -2.4 -4.3 -5.7, o sea una colina simetrica limpia, sin
hombros. La forma SI es de un arco; lo que estaba mal era la ALTURA. Se deja
escrito porque si mañana alguien la vuelve a exagerar, el numero esta.

EL PANEL DERECHO CON NEON. En la referencia el panel no se separa solo por
material: lleva un FILO ENCENDIDO y una SOMBRA por dentro. El filo lo
despega del fondo y la sombra le da espesor, como si el panel estuviera
hundido. Sin la sombra, el filo solo parece una raya pegada.

EL UL: 0.5 mas chico y 0.2 mas abajo, como pidio Dlx.
"""
import asyncio
import base64
import os
import re
import sys

from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema
from los_nueve import defs
from paneles import borde

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN + 20
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
SV = 'TFC'
B, A, FONDO, EXTRA, REMATE, _ = defs()[SV]
t = emblema.tono

DIV = round(PICO.h * .641)              # 260 · el promedio trazado
FLECHA = round(PICO.h * .044)           # 18 · el recorrido medido
DIV2 = DIV + round(PICO.h * .040)       # la segunda linea, 4% mas abajo
COL = round(PICO.w * .30)
UL_H = 25.5                             # 0.5 mas chico
UL_Y = round(PICO.h * .878) - 13 + 0.2  # 0.2 mas abajo
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]


def y(v):
    return v + MARGEN


def curva(yc, f):
    xi, xd = borde(yc, 'izq'), borde(yc, 'der')
    cx = (xi + xd) / 2
    # el pico de una cuadratica queda a f de los extremos si el control va a 2f
    return ('M%.1f,%.1f Q%.1f,%.1f %.1f,%.1f'
            % (xi, y(yc), cx, y(yc - f * 2), xd, y(yc)))


def panel_pie(yc, f):
    xi, xd = borde(yc, 'izq'), borde(yc, 'der')
    cx = (xi + xd) / 2
    d = ['M%.1f,%.1f' % (xi, y(yc)),
         'Q%.1f,%.1f %.1f,%.1f' % (cx, y(yc - f * 2), xd, y(yc))]
    for x, v in sorted([p for p in PTS if p[0] > 150 and p[1] > yc],
                       key=lambda p: p[1]):
        d.append('L%.1f,%.1f' % (x, y(v)))
    for x, v in sorted([p for p in PTS if p[0] < 150 and p[1] > yc],
                       key=lambda p: p[1], reverse=True):
        d.append('L%.1f,%.1f' % (x, y(v)))
    return ' '.join(d) + ' Z'


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
FOTO = b64(os.path.join(SCR, 'av_valen.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{SV.lower()}.png'))
VELO = 'linear-gradient(180deg,rgba(0,0,0,.30),rgba(0,0,0,.64))'
M_FOTO = ('linear-gradient(180deg,#000 0%,#000 70%,rgba(0,0,0,.5) 90%,'
          'transparent 100%)')
WASH = ('linear-gradient(270deg,#000 0%,#000 10%,rgba(0,0,0,0.5) 19%,'
        'transparent 30%)')

XC = round(borde(40, 'der') - COL)       # el filo interno de la columna

# (etiqueta, neon del filo, sombra interna, flecha)
CASOS = [
 ('1 · la colina medida · 18 px, sin neón', 0, 0, FLECHA),
 ('2 · con filo de neón', .85, 0, FLECHA),
 ('3 · neón + sombra interna', .85, .55, FLECHA),
 ('4 · neón fuerte + sombra', 1.0, .70, FLECHA),
 ('5 · igual, con la curva vieja de 28 px', .85, .55, 28),
 ('6 · sin curva, para ver el contraste', .85, .55, 0),
]


def carta(i, etq, neon, sombra, f):
    cid = f'n{i}'
    dpie = panel_pie(DIV, f)
    filo = ''
    if neon:
        filo = (f'<div class="filo" style="left:{XC}px;opacity:{neon};'
                f'background:{B};box-shadow:0 0 8px {B},0 0 18px {B}"></div>')
    somb = ''
    if sombra:
        somb = (f'<div class="somb" style="left:{XC}px;opacity:{sombra};'
                f'background:linear-gradient(270deg,rgba(0,0,0,.72),transparent)">'
                f'</div>')
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{FONDO}"></div>
    {f'<div class="cap" style="{EXTRA}"></div>' if EXTRA else ''}
    {f'<div class="rem" style="{REMATE}"></div>' if REMATE else ''}
    <div class="foto" style="-webkit-mask-image:{M_FOTO};mask-image:{M_FOTO}">
      <img src="{FOTO}"><div class="velo-ar"></div></div>
    <div class="wash" style="background:{FONDO};
         -webkit-mask-image:{WASH};mask-image:{WASH}"></div>
    {somb}{filo}
    <div class="pie-fondo" style="background:{FONDO};clip-path:path('{dpie}')"></div>
    <div class="pie-velo" style="background:{VELO};clip-path:path('{dpie}')"></div>
    <svg class="tra" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <path d="{curva(DIV, f)}" fill="none" stroke="{B}" stroke-width="1.9"
            opacity=".88"/>
      <path d="{curva(DIV2, f * .8)}" fill="none" stroke="{B}"
            stroke-width="1.1" opacity=".44"/>
    </svg>
    <img class="ul" src="{UL}" style="top:{y(UL_Y)}px;height:{UL_H}px">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'n{i}')}
  {emblema.pieza(SV, A, B, ESC)}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:34px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:28px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:16px;min-height:30px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 8px}}
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 20px;max-width:1010px;line-height:1.55}}
.med{{color:#8A8AA0;font-size:12px;font-family:ui-monospace,monospace;
  white-space:pre;line-height:1.5;margin:0 0 20px}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;z-index:0}}
.cap{{position:absolute;inset:0;z-index:1;background-repeat:repeat}}
.rem{{position:absolute;inset:0;z-index:2}}
.foto{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{DIV + 14}px;
  z-index:3;overflow:hidden}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 12%}}
.velo-ar{{position:absolute;inset:0;background:linear-gradient(180deg,
  rgba(0,0,0,.40) 0%,rgba(0,0,0,.12) 22%,transparent 42%)}}
.wash{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{DIV}px;
  z-index:4;pointer-events:none;background-repeat:repeat}}
/* la sombra le da ESPESOR al panel: sin ella el filo parece una raya pegada */
.somb{{position:absolute;top:{MARGEN + 12}px;width:34px;height:{DIV - 20}px;
  z-index:5;pointer-events:none}}
.filo{{position:absolute;top:{MARGEN + 14}px;width:1.6px;height:{DIV - 26}px;
  z-index:6;pointer-events:none}}
.pie-fondo,.pie-velo{{position:absolute;inset:0;z-index:6;
  pointer-events:none;background-repeat:repeat}}
.pie-velo{{z-index:7}}
.tra{{position:absolute;inset:0;z-index:8;pointer-events:none}}
.ul{{position:absolute;left:50%;transform:translateX(-50%);z-index:9;
  width:auto;opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LA COLINA MEDIDA · Y EL PANEL DERECHO CON NEÓN</div>'
           '<div class="med">TRAZADO columna por columna sobre FINAL REFERENCIA:\n\n'
           '  y promedio del divisor   64.1% del alto\n'
           '  punto mas alto           +5.3 px sobre el promedio\n'
           '  punto mas bajo           -5.8 px\n'
           '  RECORRIDO TOTAL          11.1 px  =  4.4% del alto</div>'
           '<div class="aviso">⚠️ Yo venía usando <b>28 px</b> de flecha sobre una '
           'carta de 405, o sea 6.9%. El real es <b>4.4%</b> — una vez y media de '
           'más. Por eso se leía como cúpula y no como colina. Acá son <b>18 px</b>. '
           'La 5 tiene la vieja de 28 al lado para comparar.<br><br>'
           '⚠️ Sobre «no es solo un arco»: el perfil trazado da −5.8 −4.6 −2.5 −0.3 '
           '+1.8 +3.6 +4.5 +5.3 +4.7 +3.7 +2.0 0.0 −2.4 −4.3 −5.7, o sea una colina '
           '<b>simétrica y limpia, sin hombros</b>. La forma sí era de arco; lo que '
           'estaba mal era la <b>altura</b>.<br><br>'
           '<b>El panel derecho</b> lleva ahora filo de neón y sombra por dentro. La '
           'sombra le da espesor: sin ella el filo parece una raya pegada en vez de '
           'un panel hundido.<br><br>'
           'El UL: 0.5 más chico y 0.2 más abajo.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'panel_neon.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'panel_neon.png'), full_page=True)
        await b.close()
    print('-> panel_neon.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
