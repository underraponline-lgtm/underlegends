"""Los dos paneles del panel 2, pero armados con la tecnica de la carta vieja.

QUE PASO: en la vuelta anterior movi todo —foto a sangre arriba, nombre al
centro, stats en 2x3— cuando lo unico que faltaba era el DEGRADE. La
estructura elegida sigue siendo la del panel 2: PANEL DERECHO y PANEL DEL
PIE. Aca vuelven, con lo unico que estaba mal corregido.

LA TECNICA, sacada de .c-colwash de normal_card.css:

    background: var(--grad)          el degradado PROPIO de la carta
    mask: linear-gradient(...)       y se desvanece hacia el centro

O sea que un panel no se dibuja con un relleno inventado ni se delimita con
una linea: SE REPINTA EL MATERIAL DE LA CARTA sobre esa zona y se apaga. El
borde es el degradado, no un canto.

Los dos paneles hacen eso:

  PANEL DERECHO   repinta el fondo sobre la franja y se desvanece hacia el
                  centro. Asi el numero queda sobre el material de la carta
                  y no sobre el avatar.
  PANEL DEL PIE   repinta el fondo recortado con el contorno de la carta
                  —el trazo azul— y se separa por un velo, no por un borde.

Y LA FOTO va a sangre por debajo de los dos. No hace falta recortarla contra
ellos: los paneles la tapan al repintarse encima, que es exactamente lo que
hace la carta vieja. Solo lleva mascara abajo, para que no choque de golpe
con el panel del pie.
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
from paneles import panel_pie

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
SV = 'TFC'
B, A, FONDO, EXTRA, REMATE, _ = defs()[SV]
t = emblema.tono
PIE = 296
D_PIE = panel_pie(PIE)


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
# av_valen.png si esta, y un cartel que DICE «MUESTRA» si no.
# Antes era `b64(os.path.join(SCR, 'av_valen.png'))` en 44 archivos,
# y al importar cualquiera de ellos se leia del disco la foto de una
# persona. Ver 03_Servidor/disenos/_muestra.py.
from _muestra import cara_muestra
FOTO = cara_muestra()
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{SV.lower()}.png'))
BAN = 'https://flagcdn.com/w80/ar.png'
STATS = [('11', 'RCH'), ('305K', 'PTS'), ('57.3', 'WR%'),
         ('18', 'DUE'), ('35', 'POD'), ('80', 'EVT')]

# la mascara de la franja derecha: espejo de la de .c-colwash
WASH = ('linear-gradient(270deg,#000 0%,#000 13%,rgba(0,0,0,0.5) 25%,'
        'transparent 43%)')
WASH_ANCHO = ('linear-gradient(270deg,#000 0%,#000 22%,rgba(0,0,0,0.5) 36%,'
              'transparent 58%)')
# la foto se apaga antes de llegar al panel del pie
M_FOTO = 'linear-gradient(180deg,#000 0%,#000 62%,rgba(0,0,0,.5) 84%,transparent 100%)'

VELOS = {
 'suave': 'linear-gradient(180deg,rgba(0,0,0,.10),rgba(0,0,0,.40))',
 'oscuro': 'linear-gradient(180deg,rgba(0,0,0,.28),rgba(0,0,0,.62))',
 'claro': 'linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,.06))',
}

CASOS = [
 ('1 · los dos paneles repintando el material', WASH, 'suave', True),
 ('2 · velo del pie más oscuro', WASH, 'oscuro', True),
 ('3 · velo del pie claro', WASH, 'claro', True),
 ('4 · franja derecha más ancha', WASH_ANCHO, 'suave', True),
 ('5 · SIN foto · 118 de 138', WASH, 'suave', False),
]


def carta(i, etq, wash, velo, hay_foto):
    cid = f'd{i}'
    foto = (f'<div class="foto" style="-webkit-mask-image:{M_FOTO};'
            f'mask-image:{M_FOTO}"><img src="{FOTO}"><div class="velo-ar"></div></div>'
            if hay_foto else
            f'<div class="foto ini" style="-webkit-mask-image:{M_FOTO};'
            f'mask-image:{M_FOTO}"><span>VA</span></div>')
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{FONDO}"></div>
    {f'<div class="cap" style="{EXTRA}"></div>' if EXTRA else ''}
    {f'<div class="rem" style="{REMATE}"></div>' if REMATE else ''}
    {foto}

    <!-- PANEL DERECHO: repinta el material y se desvanece al centro -->
    <div class="wash" style="background:{FONDO};
         -webkit-mask-image:{wash};mask-image:{wash}"></div>

    <!-- PANEL DEL PIE: el material recortado con el contorno de la carta -->
    <div class="pie-fondo" style="background:{FONDO};
         clip-path:path('{D_PIE}')"></div>
    <div class="pie-velo" style="background:{VELOS[velo]};
         clip-path:path('{D_PIE}')"></div>

    <div class="colu">
      <div class="num">81</div><div class="rng">S</div>
      <img class="ban" src="{BAN}">
      <div class="mini"><b>#2</b><u>COMP</u></div>
      <div class="mini"><b>#4</b><u>TEMP</u></div>
    </div>
    <div class="pie{' sobreclaro' if velo == 'claro' else ''}">
      <div class="nom">VALEN</div>
      <div class="seis">""" + ''.join(
        f'<div><b>{v}</b><u>{k}</u></div>' for v, k in STATS) + f"""</div>
    </div>
    <img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'd{i}')}
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
/* la foto va A SANGRE por debajo de los paneles */
.foto{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{PIE + 26}px;
  z-index:3;overflow:hidden}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 16%}}
.velo-ar{{position:absolute;inset:0;background:linear-gradient(180deg,
  rgba(0,0,0,.34) 0%,rgba(0,0,0,.08) 24%,transparent 46%)}}
.foto.ini{{display:flex;align-items:center;justify-content:flex-start;
  padding-left:24px}}
.foto.ini span{{font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;font-size:5rem;
  color:rgba(255,255,255,.13);letter-spacing:-6px}}
/* los dos paneles: material repintado, sin bordes */
.wash{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{PIE}px;
  z-index:4;pointer-events:none;background-repeat:repeat}}
.pie-fondo,.pie-velo{{position:absolute;inset:0;z-index:4;
  pointer-events:none;background-repeat:repeat}}
.pie-velo{{z-index:5}}
.colu{{position:absolute;top:{MARGEN + 30}px;right:16px;width:74px;z-index:6;
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
.pie{{position:absolute;left:0;right:0;top:{MARGEN + PIE + 9}px;z-index:6;
  display:flex;flex-direction:column;align-items:center;gap:5px}}
.nom{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:1.28rem;font-weight:900;
  color:#fff;line-height:1;text-shadow:0 2px 5px rgba(0,0,0,.8)}}
.seis{{display:grid;grid-template-columns:repeat(6,1fr);width:266px}}
.seis div{{display:flex;flex-direction:column;align-items:center;line-height:1}}
.seis b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:.92rem;font-weight:700;
  color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.8)}}
.seis u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.29rem;
  font-weight:900;letter-spacing:.5px;color:#fff;opacity:.74}}
.sobreclaro .nom{{color:{t(A,-.40)};text-shadow:none}}
.sobreclaro .seis b{{color:{t(A,-.44)};text-shadow:none}}
.sobreclaro .seis u{{color:{t(A,-.14)};opacity:.95}}
.ul{{position:absolute;left:50%;top:424px;transform:translateX(-50%);z-index:7;
  height:20.7px;width:auto;opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LOS DOS PANELES, CON EL DEGRADÉ DE LA CARTA VIEJA</div>'
           '<div class="aviso">Vuelve la estructura del panel 2 —<b>panel derecho</b> '
           'y <b>panel del pie</b>— con lo único que estaba mal corregido.<br><br>'
           'Un panel no se dibuja con un relleno inventado ni se delimita con una '
           'línea: <b>se repinta el material de la carta</b> sobre esa zona y se '
           'apaga. El borde es el degradado. El derecho se desvanece hacia el centro; '
           'el del pie va recortado con el contorno de la carta y se separa por un '
           'velo, no por un canto.<br><br>'
           'Y la foto va <b>a sangre por debajo de los dos</b>: no hace falta '
           'recortarla contra ellos, porque los paneles la tapan al repintarse '
           'encima. Es exactamente lo que hace la carta vieja.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'paneles_degrade.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'paneles_degrade.png'),
                            full_page=True)
        await b.close()
    print('-> paneles_degrade.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
