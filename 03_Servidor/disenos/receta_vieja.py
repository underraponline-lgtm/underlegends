"""La receta de la carta vieja, aplicada a la silueta nueva.

Dlx: "mira como el que dejamos para que sea la tarjeta de pais es con eso de
la imagen y el panel izquierdo". Tenia razon: ESTO YA ESTABA RESUELTO en
03_Servidor/normal_card.css y yo lo estaba reinventando mal.

LO QUE HACE LA CARTA VIEJA, leido de su CSS:

  .c-photo       top:0 left:0 right:0 height:58%
                 La foto va A SANGRE en el tercio superior. No esta metida
                 en una caja: ES el techo de la carta.

  su mascara     linear-gradient(180deg, #000 0%, #000 46%,
                                  rgba(0,0,0,.55) 74%, transparent 100%)
                 Se disuelve hacia abajo hasta desaparecer. Por eso no hay
                 borde inferior: la foto no termina, se acaba.

  .c-photo::after  un velo oscuro arriba, 0.38 a 0, para que el numero se
                 lea sobre la foto sin depender de que la foto sea oscura.

  .c-colwash     ESTO ES EL "PANEL" IZQUIERDO, y no es un panel:
                 background: var(--grad)  <- el degradado PROPIO de la carta
                 mask: linear-gradient(90deg, #000 0%, #000 13%,
                       rgba(0,0,0,.5) 25%, transparent 43%)

                 O sea que REPINTA EL MATERIAL DE LA CARTA sobre la franja y
                 lo desvanece hacia el centro. Su propio comentario lo dice:
                 "Asi el numero queda sobre el material de la carta, no
                 sobre el avatar — que es como funciona la carta de FIFA."

⚠️ POR ESO NO SON LINEAS NI CAJAS. La franja no esta delimitada por nada:
existe porque ahi se repinta el fondo y despues se apaga. El borde es un
degradado, no un canto.

Aca va espejada: la franja se repinta a la DERECHA, que es donde Dlx la
quiere. El unico agregado es el panel del pie que sigue la silueta, porque
la carta vieja era biselada y no tenia merma que seguir.
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


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
FOTO = b64(os.path.join(SCR, 'av_valen.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{SV.lower()}.png'))
BAN = 'https://flagcdn.com/w80/ar.png'
STATS = [('305K', 'PTS'), ('80', 'EVT'), ('57.3', 'WR%'),
         ('35', 'POD'), ('11', 'RCH'), ('18', 'DUE')]

# las mascaras, copiadas de normal_card.css
M_FOTO = ('linear-gradient(180deg,#000 0%,#000 46%,rgba(0,0,0,0.55) 74%,'
          'transparent 100%)')
# espejada: en la carta vieja iba 90deg (izquierda), aca 270deg (derecha)
M_WASH = ('linear-gradient(270deg,#000 0%,#000 13%,rgba(0,0,0,0.5) 25%,'
          'transparent 43%)')
M_WASH_ANCHO = ('linear-gradient(270deg,#000 0%,#000 22%,rgba(0,0,0,0.5) 36%,'
                'transparent 56%)')
M_WASH_FINO = ('linear-gradient(270deg,#000 0%,#000 8%,rgba(0,0,0,0.5) 17%,'
               'transparent 30%)')
PIE = 296

# (etiqueta, alto de la foto en %, mascara del wash, hay foto)
CASOS = [
 ('1 · la receta tal cual, espejada · 58%', 58, M_WASH, True),
 ('2 · foto más alta · 68%', 68, M_WASH, True),
 ('3 · franja más ancha', 58, M_WASH_ANCHO, True),
 ('4 · franja más angosta', 58, M_WASH_FINO, True),
 ('5 · sin franja repintada · para ver qué aporta', 58, None, True),
 ('6 · SIN foto · 118 de 138', 58, M_WASH, False),
]


def carta(i, etq, alto_foto, m_wash, hay_foto):
    cid = f'v{i}'
    h = round(PICO.h * alto_foto / 100)
    wash = ('' if not m_wash else
            f'<div class="wash" style="height:{h}px;background:{FONDO};'
            f'-webkit-mask-image:{m_wash};mask-image:{m_wash}"></div>')
    foto = (f'<div class="foto" style="height:{h}px;'
            f'-webkit-mask-image:{M_FOTO};mask-image:{M_FOTO}">'
            f'<img src="{FOTO}"><div class="velo"></div></div>'
            if hay_foto else
            f'<div class="foto ini" style="height:{h}px;'
            f'-webkit-mask-image:{M_FOTO};mask-image:{M_FOTO}">'
            f'<span>VA</span></div>')
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{FONDO}"></div>
    {f'<div class="cap" style="{EXTRA}"></div>' if EXTRA else ''}
    {f'<div class="rem" style="{REMATE}"></div>' if REMATE else ''}
    {foto}{wash}
    <svg class="pan" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <defs><linearGradient id="gp{i}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".42"/>
      </linearGradient></defs>
      <path d="{panel_pie(PIE)}" fill="url(#gp{i})"/>
    </svg>
    <div class="colu">
      <div class="num">81</div><div class="rng">S</div>
      <img class="ban" src="{BAN}">
      <div class="mini"><b>#2</b><u>COMP</u></div>
      <div class="mini"><b>#4</b><u>TEMP</u></div>
    </div>
    <div class="nom">VALEN</div>
    <div class="seis">""" + ''.join(
        f'<div><b>{v}</b><u>{k}</u></div>' for v, k in STATS) + f"""</div>
    <img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'v{i}')}
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
/* la foto va A SANGRE arriba y se disuelve hacia abajo */
.foto{{position:absolute;top:{MARGEN}px;left:0;right:0;z-index:3;overflow:hidden}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 22%}}
/* velo arriba, para que el numero se lea sin depender de la foto */
.velo{{position:absolute;inset:0;background:linear-gradient(180deg,
  rgba(0,0,0,.38) 0%,rgba(0,0,0,.10) 22%,transparent 45%)}}
.foto.ini{{display:flex;align-items:center;justify-content:flex-start;
  padding-left:26px}}
.foto.ini span{{font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;font-size:5rem;
  color:rgba(255,255,255,.13);letter-spacing:-6px}}
/* la franja: el material de la carta repintado y desvanecido al centro */
.wash{{position:absolute;top:{MARGEN}px;left:0;right:0;z-index:4;
  pointer-events:none;background-repeat:repeat}}
.pan{{position:absolute;inset:0;z-index:4;pointer-events:none}}
.colu{{position:absolute;top:{MARGEN + 22}px;right:20px;z-index:5;
  display:flex;flex-direction:column;align-items:center}}
.num{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:2.7rem;font-weight:900;
  color:#fff;line-height:.86;text-shadow:0 3px 8px rgba(0,0,0,.85)}}
.rng{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:1rem;font-weight:900;
  color:#fff;line-height:1;margin-top:2px;text-shadow:0 2px 5px rgba(0,0,0,.85)}}
.ban{{width:30px;height:22px;border-radius:3px;object-fit:cover;margin-top:14px;
  box-shadow:0 2px 6px rgba(0,0,0,.7)}}
.mini{{display:flex;flex-direction:column;align-items:center;line-height:1;
  margin-top:9px}}
.mini b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:.98rem;
  font-weight:700;color:#fff;text-shadow:0 2px 5px rgba(0,0,0,.85)}}
.mini u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.3rem;
  font-weight:900;letter-spacing:.6px;color:#fff;opacity:.72}}
.nom{{position:absolute;left:0;right:0;top:{MARGEN + 214}px;text-align:center;
  z-index:5;font-family:'Archivo','LigaEmoji',sans-serif;font-size:1.9rem;font-weight:900;
  color:#fff;text-shadow:0 3px 10px rgba(0,0,0,.7)}}
.seis{{position:absolute;left:26px;right:26px;top:{MARGEN + 262}px;z-index:5;
  display:grid;grid-template-columns:1fr 1fr;row-gap:8px;column-gap:6px}}
.seis div{{display:flex;align-items:baseline;justify-content:center;gap:5px}}
.seis b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:1.34rem;
  font-weight:700;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.7)}}
.seis u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.5rem;
  font-weight:900;letter-spacing:1px;color:#fff;opacity:.88}}
.ul{{position:absolute;left:50%;top:424px;transform:translateX(-50%);z-index:6;
  height:20.7px;width:auto;opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LA RECETA DE LA CARTA VIEJA, EN LA SILUETA NUEVA</div>'
           '<div class="aviso">Esto ya estaba resuelto en '
           '<code>normal_card.css</code> y yo lo estaba reinventando mal.<br><br>'
           '<b>La foto va a sangre en el 58% de arriba</b>, no metida en una caja: '
           '<i>es</i> el techo de la carta. Su máscara la disuelve hacia abajo hasta '
           'desaparecer, así que no hay borde inferior — la foto no termina, se '
           'acaba.<br><br>'
           '<b>Y la franja no es un panel.</b> Es <code>.c-colwash</code>: repinta el '
           '<b>degradado propio de la carta</b> sobre la franja y lo desvanece hacia '
           'el centro. Su propio comentario lo dice: «así el número queda sobre el '
           'material de la carta, no sobre el avatar — que es como funciona la carta '
           'de FIFA». Por eso no hay líneas ni cajas: el borde <b>es</b> un '
           'degradado.<br><br>'
           'Acá va espejada a la derecha. Lo único agregado es el panel del pie que '
           'sigue la silueta, porque la carta vieja era biselada y no tenía merma '
           'que seguir.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'receta_vieja.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'receta_vieja.png'), full_page=True)
        await b.close()
    print('-> receta_vieja.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
