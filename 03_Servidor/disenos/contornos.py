"""Los CONTORNOS de los paneles: el trazo verde y el trazo azul.

DONDE ME CONFUNDI. Dlx dijo "no son lineas" y yo entendi que no habia
ninguna. No era eso: lo que NO se hace con una linea es SEPARAR las zonas
—eso lo hace el material— pero cada panel SI tiene su CONTORNO, como el
filete que rodea el panel interior en la carta dorada.

Son dos cosas distintas y las estaba mezclando:

    separar zonas    con material repintado y desvanecido   (ya esta)
    delimitar panel  con un contorno que traza su forma     (faltaba)

Los dos que marco:

  VERDE   el panel de la foto. Su contorno la encierra y la separa de la
          franja derecha, que queda AFUERA del panel, sobre el marco.
  AZUL    el panel del pie. Su contorno sigue el de la carta, que es lo que
          ya se calcula de PICO.

El contorno del pie NO se traza entero: el tramo que corre pegado al borde
de la carta queda tapado por el marco. Se traza solo lo que se ve, o sea la
tapa y los costados hasta donde empieza la merma.
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
from paneles import panel_pie, borde

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
SV = 'TFC'
B, A, FONDO, EXTRA, REMATE, _ = defs()[SV]
t = emblema.tono
PIE = 296
D_PIE = panel_pie(PIE)
COL_X = 92          # cuanto entra la franja derecha desde el borde
ARR = 34            # donde arranca el panel de la foto


def y(v):
    return v + MARGEN


def marco_foto(inset=9):
    """EL TRAZO VERDE: encierra la foto y deja la franja derecha AFUERA."""
    xi_ar = borde(ARR, 'izq') + inset
    xi_ab = borde(PIE, 'izq') + inset
    xd = borde(ARR, 'der') - COL_X
    return ('M%.1f,%.1f L%.1f,%.1f L%.1f,%.1f L%.1f,%.1f Z'
            % (xi_ar, y(ARR), xd, y(ARR), xd, y(PIE - 4), xi_ab, y(PIE - 4)))


def tapa_pie():
    """EL TRAZO AZUL, solo la parte que se ve.

    El resto del contorno corre pegado al borde de la carta y lo tapa el
    marco, asi que trazarlo entero es dibujar debajo de algo.
    """
    return ('M%.1f,%.1f L%.1f,%.1f'
            % (borde(PIE, 'izq') + 4, y(PIE), borde(PIE, 'der') - 4, y(PIE)))


def filo_columna():
    """El borde interno de la franja derecha, si se quiere marcado."""
    xd = borde(ARR, 'der') - COL_X
    return 'M%.1f,%.1f L%.1f,%.1f' % (xd, y(ARR + 4), xd, y(PIE - 6))


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
FOTO = b64(os.path.join(SCR, 'av_valen.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{SV.lower()}.png'))
BAN = 'https://flagcdn.com/w80/ar.png'
STATS = [('11', 'RCH'), ('305K', 'PTS'), ('57.3', 'WR%'),
         ('18', 'DUE'), ('35', 'POD'), ('80', 'EVT')]

WASH = ('linear-gradient(270deg,#000 0%,#000 13%,rgba(0,0,0,0.5) 25%,'
        'transparent 43%)')
M_FOTO = 'linear-gradient(180deg,#000 0%,#000 62%,rgba(0,0,0,.5) 84%,transparent 100%)'
VELO = 'linear-gradient(180deg,rgba(0,0,0,.28),rgba(0,0,0,.62))'

# (etiqueta, contorno foto, tapa del pie, filo columna, grosor, color)
CASOS = [
 ('1 · la 2 tal cual, sin contornos', False, False, False, 0, B),
 ('2 · solo la tapa del panel del pie', False, True, False, 1.6, B),
 ('3 · contorno de la foto + tapa del pie', True, True, False, 1.6, B),
 ('4 · los tres: foto, pie y filo de la columna', True, True, True, 1.6, B),
 ('5 · trazo más grueso', True, True, False, 2.6, B),
 ('6 · trazo en blanco puro, más marcado', True, True, True, 2.0, '#FFFFFF'),
]


def carta(i, etq, c_foto, c_pie, c_col, gr, color):
    cid = f'k{i}'
    tr = ''
    if c_foto:
        tr += (f'<path d="{marco_foto()}" fill="none" stroke="{color}" '
               f'stroke-width="{gr}" opacity=".72"/>')
    if c_pie:
        tr += (f'<path d="{tapa_pie()}" fill="none" stroke="{color}" '
               f'stroke-width="{gr}" opacity=".82"/>')
    if c_col:
        tr += (f'<path d="{filo_columna()}" fill="none" stroke="{color}" '
               f'stroke-width="{gr * .8}" opacity=".5"/>')
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
    <div class="pie-fondo" style="background:{FONDO};
         clip-path:path('{D_PIE}')"></div>
    <div class="pie-velo" style="background:{VELO};
         clip-path:path('{D_PIE}')"></div>
    <svg class="tra" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">{tr}</svg>
    <div class="colu">
      <div class="num">81</div><div class="rng">S</div>
      <img class="ban" src="{BAN}">
      <div class="mini"><b>#2</b><u>COMP</u></div>
      <div class="mini"><b>#4</b><u>TEMP</u></div>
    </div>
    <div class="pie"><div class="nom">VALEN</div><div class="seis">""" + ''.join(
        f'<div><b>{v}</b><u>{k}</u></div>' for v, k in STATS) + f"""</div></div>
    <img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'k{i}')}
  {emblema.pieza(SV, A, B, ESC)}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:34px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:28px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:16px;min-height:30px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 8px}}
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 22px;max-width:1010px;line-height:1.55}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;z-index:0}}
.cap{{position:absolute;inset:0;z-index:1;background-repeat:repeat}}
.rem{{position:absolute;inset:0;z-index:2}}
.foto{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{PIE + 26}px;
  z-index:3;overflow:hidden}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 16%}}
.velo-ar{{position:absolute;inset:0;background:linear-gradient(180deg,
  rgba(0,0,0,.34) 0%,rgba(0,0,0,.08) 24%,transparent 46%)}}
.wash{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{PIE}px;
  z-index:4;pointer-events:none;background-repeat:repeat}}
.pie-fondo,.pie-velo{{position:absolute;inset:0;z-index:4;
  pointer-events:none;background-repeat:repeat}}
.pie-velo{{z-index:5}}
.tra{{position:absolute;inset:0;z-index:6;pointer-events:none}}
.colu{{position:absolute;top:{MARGEN + 30}px;right:16px;width:74px;z-index:7;
  display:flex;flex-direction:column;align-items:center;gap:6px}}
.num{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:2.3rem;font-weight:900;
  color:#fff;line-height:.9;text-shadow:0 2px 6px rgba(0,0,0,.8)}}
.rng{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.86rem;font-weight:900;
  color:{B};line-height:1;text-shadow:0 1px 3px rgba(0,0,0,.85)}}
.ban{{width:28px;height:20px;border-radius:3px;object-fit:cover;margin-top:5px;
  box-shadow:0 2px 5px rgba(0,0,0,.7),0 0 0 1.5px rgba(255,255,255,.7)}}
.mini{{display:flex;flex-direction:column;align-items:center;line-height:1}}
.mini b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:.94rem;
  font-weight:700;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.8)}}
.mini u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.3rem;
  font-weight:900;letter-spacing:.6px;color:#fff;opacity:.72}}
.pie{{position:absolute;left:0;right:0;top:{MARGEN + PIE + 9}px;z-index:7;
  display:flex;flex-direction:column;align-items:center;gap:5px}}
.nom{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:1.28rem;font-weight:900;
  color:#fff;line-height:1;text-shadow:0 2px 5px rgba(0,0,0,.8)}}
.seis{{display:grid;grid-template-columns:repeat(6,1fr);width:266px}}
.seis div{{display:flex;flex-direction:column;align-items:center;line-height:1}}
.seis b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:.92rem;font-weight:700;
  color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.8)}}
.seis u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.29rem;
  font-weight:900;letter-spacing:.5px;color:#fff;opacity:.74}}
.ul{{position:absolute;left:50%;top:424px;transform:translateX(-50%);z-index:8;
  height:20.7px;width:auto;opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LOS CONTORNOS · EL TRAZO VERDE Y EL AZUL</div>'
           '<div class="aviso">Donde me confundí: cuando dijiste «no son líneas» '
           'entendí que no había ninguna. Son <b>dos cosas distintas</b> y las '
           'estaba mezclando:<br><br>'
           '<b>separar zonas</b> → con material repintado y desvanecido, sin línea. '
           'Eso ya estaba.<br>'
           '<b>delimitar un panel</b> → con un <b>contorno que traza su forma</b>, '
           'como el filete que rodea el panel interior en la carta dorada. Eso '
           'faltaba.<br><br>'
           'El <b>verde</b> encierra la foto y deja la franja derecha afuera, sobre '
           'el marco. El <b>azul</b> es la tapa del panel del pie. El resto de ese '
           'contorno corre pegado al borde de la carta y lo tapa el marco, así que '
           'trazarlo entero sería dibujar debajo de algo.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'contornos.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'contornos.png'), full_page=True)
        await b.close()
    print('-> contornos.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
