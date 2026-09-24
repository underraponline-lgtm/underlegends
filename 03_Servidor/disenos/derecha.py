"""LA DERECHA: preview de lo planeado. Solo la zona del costado.

⚠️ LOS TRES NUMEROS SON INVENTADOS. Ninguno existe todavia en ningun pool.
Esto es la maqueta de donde van, no datos.

QUE LLEVA Y POR QUE ESOS TRES
-----------------------------
La columna es la zona del SERVIDOR y mide ACUMULACION. Por eso lleva:

    OVR del servidor   cuanto rendiste aca. Es EL numero de esta carta.
    campeonatos aca    un titulo de ESE servidor. Es lo que un aliado
                       quiere ver de los suyos y no esta en ninguna otra
                       carta.
    racha aca          dice que estas jugando AHORA, no que jugaste alguna
                       vez. Es lo mas "de este servidor" que hay.

⚠️ Y NO LLEVA PUESTO, aunque la primera version que propuse si lo tenia.
El puesto vive en el pie y se calcula POR SCORE (pos_sv). Si la columna
tuviera otro por acumulacion, la carta mostraria dos puestos del mismo
servidor que se contradicen: medido, el 78% de la gente cambia de puesto
entre los dos ordenes y el peor caso va de 36º a 11º.

⚠️ Y NO LLEVA EVENTOS NI PODIOS: el OVR ya los contiene, con peso 20% y 16%.
Ponerlos al lado muestra el mismo hecho dos veces.

EL LAVADO es la opcion B, las paradas originales de normal_card.css:253
invertidas. Medido contra la D: las dos dan mas de 13:1 de contraste sobre
foto clara —cuatro veces lo que hace falta— asi que la D solo compra 6.1%
mas de avatar tapado por contraste que no se usa.
"""
import asyncio
import base64
import json
import os
import re
import sys

from PIL import Image
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema, divisor as DIV, brillo as BRI, nombre as NOM
from comun import rangos as RG, pie as PIE, iconos as ICO
from comun import marco as MK
from los_nueve import defs
from paneles import borde
import avatares

RG.verificar()
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

LAVADO = (13, 25, 43)        # la B, medida
CX = W - 40                  # el eje de la columna
RECORTE = (0, MARGEN - 34, W, ALTO - 14)   # el pie tambien entra

# (nombre, sv, rango, cc, pos_sv, de, OVR sv, titulos, racha) — REALES salvo
# los tres ultimos, que no existen
GENTE = [('KONAN', 'TWR', 'SSS', 'ar', 1, 18, 94, 3, '8/12', '9/14', 27),
         ('AXINU', 'TFC', 'SS', 'co', 1, 79, 91, 2, '5/9', '6/11', 22),
         ('MAKI', 'TFC', 'B', 'mx', 27, 79, 66, 0, '2/6', '3/8', 14),
         ('BENJA', 'TFC', 'E', 'cl', 77, 79, 48, 0, '0/0', '0/0', 8)]


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


def pieza(k, v, i, apagado):
    """Una fila chica: icono + numero arriba, etiqueta abajo.

    ⚠️ La etiqueta va DEBAJO y no al lado: al lado desbordaba los 56 px de la
    columna ("8/12 RACHA" medía 79). Y es el patron que el OVR ya usaba.
    """
    op = '.34' if apagado else '.95'
    cy = PIE.COL_Y0 + i * PIE.COL_PASO
    return (f'<div class="mini" style="top:{y(cy)-9:.0f}px;opacity:{op}">'
            f'<div class="lin">{ICO.svg(k, 15)}<b>{v}</b></div>'
            f'<span>{ICO.ETIQUETA[k]}</span></div>')


def columna(ovr, tit, rch, duel, evt):
    return (f'<div class="ovr"><b>{ovr}</b></div>'
            + pieza('titulos', tit, 0, tit == 0)
            + pieza('racha', rch, 1, rch == '0/0')
            + pieza('duelos', duel, 2, duel == '0/0')
            + pieza('eventos', evt, 3, evt == 0))


def carta(i, sufijo):
    nom, sv, rg, cc, p, tot, ovr, tit, rch, duel, evt = GENTE[i]
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    pts = camino()
    _, av = avatares.para(i)
    lado = W * 115 / 100
    a, b, c = LAVADO
    m = (f'linear-gradient(270deg,#000 0%,#000 {a}%,'
         f'rgba(0,0,0,.5) {b}%,transparent {c}%)')
    foto = (f'<div class="foto" style="-webkit-mask-image:{M_FOTO};'
            f'mask-image:{M_FOTO}"><img src="{av}" style="width:{lado:.0f}px;'
            f'left:{(W-lado)/2:.1f}px;top:{MARGEN-(lado-ALTO_FOTO)*.44:.1f}px">'
            f'</div>') if av else ''
    ban = (f'<img class="ban" src="https://flagcdn.com/w80/{cc}.png" '
           f'style="left:{PIE.X_BAN-PIE.LADO/2}px;'
           f'top:{y(PIE.Y_FILA)-PIE.LADO*.36:.1f}px;'
           f'width:{PIE.LADO}px;height:{PIE.LADO*.72:.1f}px">')
    return f"""<div class="wrap">
  <svg class="d" width="0" height="0"><defs>
    <clipPath id="{sufijo}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
    {MK.defs_svg(A, B, sufijo)}
  </defs></svg>
  <div class="cu" style="clip-path:url(#{sufijo})">
    <div class="f" style="background:{FONDO}"></div>
    {f'<div class="f" style="{EXTRA}"></div>' if EXTRA else ''}
    {foto}
    <div class="wash" style="background:{PIE.lavado(A)};
         -webkit-mask-image:{m};mask-image:{m};
         clip-path:path('{DIV.arriba(pts, W, ALTO, dy=MARGEN)}')"></div>
    {BRI.arriba(A)}
    <div class="f" style="background:{FONDO};clip-path:path('{panel_pie(pts)}')"></div>
    {f'<div class="f" style="{EXTRA};clip-path:path(&quot;{panel_pie(pts)}&quot;)"></div>' if EXTRA else ''}
    <div class="f" style="background:{VELO};clip-path:path('{panel_pie(pts)}')"></div>
    <svg class="f" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <path d="{'M' + ' L'.join('%.2f,%.2f' % (x, y(v)) for x, v in pts)}"
            fill="none" stroke="{B}" stroke-width="1.9" opacity=".9"/>
    </svg>
  </div>
  <svg class="bo" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{sufijo})">
      <path d="{SIL}" fill="none" stroke="{MK.stroke(sufijo)}"
            stroke-width="9" opacity=".95"/>
    </g>
  </svg>
  {columna(ovr, tit, rch, duel, evt)}
  <div class="nom" style="font-size:{NOM.rem(nom, 1.6)}rem">{nom}</div>
  {ban}
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
.foto{{position:absolute;top:0;left:0;width:{W}px;height:{ALTO}px;
  overflow:hidden}}
.foto img{{position:absolute;height:auto;display:block}}
/* ⚠️ EL LAVADO VA EN LA MISMA CAJA QUE EL FONDO, no en una propia.
   Antes era top:MARGEN con height:BASE_Y, o sea una caja de 300x269 contra
   la de 300x487 del fondo. Las dos pintan el MISMO degrade a 158 grados, y
   un degrade se reparte sobre la diagonal de SU caja: 402.8 px contra 572.0.
   O sea que el lavado mostraba el degrade de la carta COMPRIMIDO UN 30% y
   corrido, y donde la foto se desvanece se veian los dos a la vez.
   Dlx: "el panel derecho tiene como una reflexion media rara". No era un
   reflejo: era el degrade de la carta duplicado y desalineado.
   Ahora comparte la caja y se limita con un RECORTE, que no toca el
   degrade. Y se repinta tambien la capa EXTRA, por lo mismo. */
.wash{{position:absolute;inset:0;background-repeat:repeat}}
{BRI.css('luz', MARGEN, PICO.h)}
.ovr{{position:absolute;right:{PIE.COL_DER}px;top:{y(PIE.COL_Y_OVR)}px;
  width:{PIE.COL_ANCHO}px;text-align:center;z-index:9;
  font-family:'Archivo','LigaEmoji',sans-serif;color:#fff}}
.ovr b{{display:block;font-size:2.05rem;font-weight:900;line-height:1;
  text-shadow:0 2px 8px rgba(0,0,0,.9)}}
.ovr span{{display:block;font-size:.44rem;font-weight:800;letter-spacing:1.1px;
  opacity:.75;margin-top:4px}}
.mini{{position:absolute;right:{PIE.COL_DER}px;width:{PIE.COL_ANCHO}px;
  z-index:9;color:#fff;font-family:'Archivo','LigaEmoji',sans-serif;text-align:center;
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
    tmp = os.path.join(SCR, '_der')
    os.makedirs(tmp, exist_ok=True)
    x0, y0, x1, y1 = RECORTE
    fila = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': W, 'height': ALTO},
                              device_scale_factor=3)
        for i in range(len(GENTE)):
            h = os.path.join(tmp, f'{i}.html')
            open(h, 'w', encoding='utf-8').write(
                '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
                + fuentes + CSS + '</style></head><body>'
                + carta(i, f'd{i}') + '</body></html>')
            await pg.goto('file://' + h)
            await pg.wait_for_timeout(260)
            f = os.path.join(tmp, f'{i}.png')
            await pg.screenshot(path=f, clip={'x': x0, 'y': y0,
                                              'width': x1 - x0,
                                              'height': y1 - y0},
                                omit_background=True)
            fila.append(f)
        await b.close()

    cel = ''.join(
        f'<div class="g"><div class="gl">{GENTE[i][0]} · {GENTE[i][1]}</div>'
        f'<img class="z" src="{b64(f)}"></div>' for i, f in enumerate(fila))

    hoja = f"""<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{{background:#0A0A10;margin:0;padding:30px;font-family:system-ui,sans-serif}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:800;letter-spacing:1.3px;margin:0 0 8px}}
.d1{{color:#8A8AA0;font-size:12.5px;margin:0 0 18px;max-width:1180px;line-height:1.55}}
.fila{{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start}}
.g{{text-align:center}}
.gl{{color:#EDEDF5;font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:7px}}
.z{{display:block;width:{W}px;border-radius:8px;background:#12121A}}
</style></head><body>
<div class="rot">LA DERECHA · PREVIEW</div>
<div class="d1">⚠️ <b>Los tres números de la columna son inventados.</b>
Ninguno existe todavía en ningún pool — el OVR del servidor, los títulos y la
racha necesitan que el builder guarde los datos por servidor. Esto es la
maqueta de <b>dónde van</b>, no datos.<br><br>
La columna es <b>la zona del servidor</b> y mide <b>acumulación</b>:
<b>OVR</b> (cuánto rendiste acá) · <b>títulos</b> (lo que un aliado quiere ver
de los suyos, y no está en ninguna otra carta) · <b>racha</b> (dice que estás
jugando <i>ahora</i>, no que jugaste alguna vez).<br><br>
⚠️ <b>No lleva puesto</b>, aunque mi primera versión sí lo tenía: ése vive en
el pie y se calcula por Score. Dos puestos del mismo servidor con criterios
distintos se contradicen —78% de la gente cambia, el peor caso va de 36º a
11º—.<br><br>
⚠️ <b>No lleva eventos ni podios</b>: el OVR ya los contiene con peso 20% y
16%. Ponerlos al lado muestra el mismo hecho dos veces.<br><br>
Los títulos y la racha en <b>0 se apagan</b> en vez de desaparecer: si la
pieza se fuera, la columna cambiaría de alto según la persona y las cartas no
se verían iguales entre sí. Se ve en Maki y Benja.<br><br>
El lavado es la <b>B</b> medida. Lo de abajo es lo ya decidido: bandera ·
puesto en el servidor · figura del rango.</div>
<div class="fila">{cel}</div>
</body></html>"""
    out = os.path.join(SCR, 'derecha.html')
    open(out, 'w', encoding='utf-8').write(hoja)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1330, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2000)
        await pg.screenshot(path=os.path.join(SCR, 'derecha.png'),
                            full_page=True)
        await b.close()
    print('-> derecha.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
