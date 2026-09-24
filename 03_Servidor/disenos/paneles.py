"""Los paneles de la carta, con las cuatro correcciones de Dlx.

LO QUE ESTABA MAL EN LA VUELTA ANTERIOR:

1. ⚠️ "NO SON LINEAS". Yo separaba las zonas con un filete de 1.5px. En la
   referencia no hay ninguna linea: hay PANELES CON RELLENO PROPIO. Lo que
   separa una zona de otra es que tienen distinto material, no que haya un
   trazo entre ellas.

2. ⚠️ EL PANEL DEL PIE NO ES UN RECTANGULO. Es lo que Dlx marco en azul: su
   contorno ES EL DE LA CARTA. Los lados y el fondo siguen la silueta, con
   su merma y su punta. Por eso no se puede hacer con una caja de CSS: hay
   que armar el path leyendo la silueta.

   Se calcula, no se dibuja: para cada altura se resuelve donde cae el borde
   izquierdo y el derecho de PICO, y con eso se cierra el panel. Si la
   silueta cambia, el panel la sigue solo.

3. LOS PANELES SE FUNDEN CON EL FONDO. No son bloques opacos pegados
   encima: llevan degrade y transparencia, asi que el fondo del servidor se
   sigue viendo a traves. Es la misma logica que hizo que el escudo tomara
   el tono de su carta en vez de traer el suyo.

4. LA COLUMNA VA A LA DERECHA, no a la izquierda, para que no se lea igual
   que las cartas de las que salio la idea.
"""
import asyncio
import base64
import os
import re
import sys

from playwright.async_api import async_playwright

# 🔴 SE CALCULA, NO SE CLAVA. Aca habia una ruta absoluta a la
# maquina de Dlx, y este archivo NO es exploracion: esta en el camino
# vivo de `03_Servidor/generar.py`. Lo destapo la primera corrida del
# ciclo en Actions con trabajo de verdad -- 12 cartas de 13 con
# FileNotFoundError y una ruta de Windows adentro de un runner Linux.
# Ver la nota larga en `todos_sv.py`.
SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(os.path.dirname(SCR))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema
from los_nueve import defs

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
SV = 'TFC'
B, A, FONDO, EXTRA, REMATE, _ = defs()[SV]
t = emblema.tono

# ── LA SILUETA, LEIDA ────────────────────────────────────────────────────
# Los vertices de PICO en coordenadas de la carta. El panel del pie se
# calcula de aca: asi sigue la silueta sola si algun dia esta cambia.
PTS = [tuple(float(v) for v in par.split(','))
       for par in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]
DER = [p for p in PTS if p[0] > 150]          # 170.8,0 · 296.7,30.4 · 300,356.5 ...
IZQ = [p for p in PTS if p[0] < 150]


def borde(y, lado):
    """Donde cae el borde de la silueta a la altura y."""
    ps = sorted(DER if lado == 'der' else IZQ, key=lambda p: p[1])
    for (x0, y0), (x1, y1) in zip(ps, ps[1:]):
        if y0 <= y <= y1:
            k = 0 if y1 == y0 else (y - y0) / (y1 - y0)
            return x0 + (x1 - x0) * k
    return ps[-1][0]


def yy(v):
    return v + MARGEN


def panel_pie(y0):
    """EL TRAZO AZUL: su contorno es el de la carta, no una caja.

    Arranca recto a la altura y0 y de ahi baja siguiendo la silueta: la
    merma de los costados y la punta del fondo salen de PICO, no de valores
    escritos a mano.
    """
    d = ['M%.1f,%.1f' % (borde(y0, 'izq'), yy(y0)),
         'L%.1f,%.1f' % (borde(y0, 'der'), yy(y0))]
    for x, y in sorted([p for p in DER if p[1] > y0], key=lambda p: p[1]):
        d.append('L%.1f,%.1f' % (x, yy(y)))
    for x, y in sorted([p for p in IZQ if p[1] > y0],
                       key=lambda p: p[1], reverse=True):
        d.append('L%.1f,%.1f' % (x, yy(y)))
    return ' '.join(d) + ' Z'


def panel_col(y0, y1, ancho, lado='der'):
    """La columna, tambien pegada al borde real de la silueta."""
    if lado == 'der':
        x0a, x0b = borde(y0, 'der'), borde(y1, 'der')
        return ('M%.1f,%.1f L%.1f,%.1f L%.1f,%.1f L%.1f,%.1f Z'
                % (x0a - ancho, yy(y0), x0a, yy(y0),
                   x0b, yy(y1), x0b - ancho, yy(y1)))
    x0a, x0b = borde(y0, 'izq'), borde(y1, 'izq')
    return ('M%.1f,%.1f L%.1f,%.1f L%.1f,%.1f L%.1f,%.1f Z'
            % (x0a, yy(y0), x0a + ancho, yy(y0),
               x0b + ancho, yy(y1), x0b, yy(y1)))


PIE = 298
COL = (38, PIE - 6, 74)

STATS = [('11', 'RCH'), ('305K', 'PTS'), ('57.3', 'WR%'),
         ('18', 'DUE'), ('35', 'POD'), ('80', 'EVT')]


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


def _cara():
    """La cara de muestra, una sola vez y sin tocar el disco al importar."""
    global FOTO
    if FOTO is None:
        from los_nueve import cara_muestra
        FOTO = cara_muestra()
    return FOTO


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
# 🔴 PEREZOSA, PORQUE ESTO SE IMPORTA DESDE PRODUCCION. Era
# `FOTO = b64(.../av_valen.png)` aca mismo, y `03_Servidor/generar.py`
# llega hasta este modulo por `from paneles import borde`: sin la foto
# en disco, la carta Servidor de las 59 personas no se dibujaba, con un
# FileNotFoundError adentro de un `import`. Ver `los_nueve.cara_muestra`.
FOTO = None   # se llena en la primera hoja que la pida
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{SV.lower()}.png'))
BAN = 'https://flagcdn.com/w80/ar.png'

# los rellenos: NO son bloques opacos, se funden con el fondo del servidor
RELLENOS = {
 'claro': (f'<linearGradient id="g%s" x1="0" y1="0" x2="0" y2="1">'
           f'<stop offset="0" stop-color="#fff" stop-opacity=".26"/>'
           f'<stop offset="1" stop-color="#fff" stop-opacity=".05"/></linearGradient>'),
 'oscuro': (f'<linearGradient id="g%s" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="#000" stop-opacity=".05"/>'
            f'<stop offset="1" stop-color="#000" stop-opacity=".52"/></linearGradient>'),
 'placa': (f'<linearGradient id="g%s" x1="0" y1="0" x2="0" y2="1">'
           f'<stop offset="0" stop-color="#FFFFFF" stop-opacity=".92"/>'
           f'<stop offset="1" stop-color="#D8D8E4" stop-opacity=".80"/></linearGradient>'),
 'tono': (f'<linearGradient id="g%s" x1="0" y1="0" x2="0" y2="1">'
          f'<stop offset="0" stop-color="{t(A,.30)}" stop-opacity=".72"/>'
          f'<stop offset="1" stop-color="{t(A,-.60)}" stop-opacity=".92"/></linearGradient>'),
}

CASOS = [
 ('1 · panel del pie siguiendo la silueta · claro', 'claro', 'oscuro', True),
 ('2 · el mismo, relleno oscuro', 'oscuro', 'oscuro', True),
 ('3 · placa clara, como la referencia', 'placa', 'oscuro', True),
 ('4 · con el tono del servidor', 'tono', 'tono', True),
 ('5 · placa clara · SIN foto · 118 de 138', 'placa', 'oscuro', False),
 ('6 · placa clara · columna a la IZQUIERDA, para comparar',
  'placa', 'oscuro', True, 'izq'),
]


def carta(i, etq, rel_pie, rel_col, hay_foto, lado='der'):
    cid = f'p{i}'
    dpie, dcol = panel_pie(PIE), panel_col(*COL, lado)
    izq_col = lado == 'izq'
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{FONDO}"></div>
    {f'<div class="cap" style="{EXTRA}"></div>' if EXTRA else ''}
    {f'<div class="rem" style="{REMATE}"></div>' if REMATE else ''}
    <div class="foto{'' if hay_foto else ' vacia'}"
         style="{'right' if izq_col else 'left'}:12px;
                {'left' if izq_col else 'right'}:96px">
      {f'<img src="{_cara()}">' if hay_foto else ''}</div>
    <svg class="pan" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <defs>{RELLENOS[rel_pie] % f'p{i}'}{RELLENOS[rel_col] % f'c{i}'}</defs>
      <path d="{dcol}" fill="url(#gc{i})"/>
      <path d="{dpie}" fill="url(#gp{i})"/>
    </svg>
    <div class="colu" style="{'left' if izq_col else 'right'}:14px">
      <div class="num">81</div><div class="rng">S</div>
      <img class="ban" src="{BAN}">
      <div class="mini"><b>#2</b><u>COMP</u></div>
      <div class="mini"><b>#4</b><u>TEMP</u></div>
    </div>
    <div class="pie {'sobreclaro' if rel_pie == 'placa' else ''}">
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
  {emblema.estrellas(1, W, sufijo=f'p{i}')}
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
.foto{{position:absolute;top:{MARGEN + 40}px;height:250px;z-index:3;
  overflow:hidden;border-radius:3px}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 14%}}
.foto.vacia{{background:repeating-linear-gradient(45deg,
  rgba(255,255,255,.05) 0 8px,transparent 8px 16px)}}
.pan{{position:absolute;inset:0;z-index:4;pointer-events:none}}
.colu{{position:absolute;top:{MARGEN + 44}px;width:74px;z-index:5;
  display:flex;flex-direction:column;align-items:center;gap:5px}}
.num{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:2.1rem;font-weight:900;
  color:#fff;line-height:.9;text-shadow:0 2px 5px rgba(0,0,0,.95)}}
.rng{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.82rem;font-weight:900;
  color:{B};line-height:1;text-shadow:0 1px 3px rgba(0,0,0,.95)}}
.ban{{width:26px;height:19px;border-radius:3px;object-fit:cover;margin-top:3px;
  box-shadow:0 2px 5px rgba(0,0,0,.8),0 0 0 1.5px rgba(255,255,255,.75)}}
.mini{{display:flex;flex-direction:column;align-items:center;line-height:1}}
.mini b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:.92rem;
  font-weight:700;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.95)}}
.mini u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.3rem;
  font-weight:900;letter-spacing:.6px;color:#fff;opacity:.7}}
.pie{{position:absolute;left:0;right:0;top:{MARGEN + PIE + 8}px;z-index:5;
  display:flex;flex-direction:column;align-items:center;gap:4px}}
.nom{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:1.24rem;font-weight:900;
  color:#fff;line-height:1;text-shadow:0 2px 4px rgba(0,0,0,.9)}}
.seis{{display:grid;grid-template-columns:repeat(6,1fr);width:262px}}
.seis div{{display:flex;flex-direction:column;align-items:center;line-height:1}}
.seis b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:.9rem;font-weight:700;
  color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.9)}}
.seis u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.29rem;
  font-weight:900;letter-spacing:.5px;color:#fff;opacity:.72}}
.sobreclaro .nom{{color:{t(A,-.34)};text-shadow:none}}
.sobreclaro .seis b{{color:{t(A,-.38)};text-shadow:none}}
.sobreclaro .seis u{{color:{t(A,-.06)};opacity:.95}}
.ul{{position:absolute;left:50%;top:424px;transform:translateX(-50%);z-index:6;
  height:20.7px;width:auto;opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LOS PANELES, CON LAS CUATRO CORRECCIONES</div>'
           '<div class="aviso"><b>1. No son líneas.</b> Antes separaba las zonas con '
           'un filete. En la referencia no hay ninguna línea: hay paneles con '
           '<b>relleno propio</b>, y lo que los separa es tener distinto material.'
           '<br><b>2. El panel del pie no es un rectángulo</b> — es lo que marcaste '
           'en azul: <b>su contorno es el de la carta</b>. Los lados y el fondo '
           'siguen la silueta con su merma y su punta. Se calcula leyendo PICO, no '
           'se dibuja: si la silueta cambia, el panel la sigue solo.'
           '<br><b>3. Se funden con el fondo</b>: llevan degradé y transparencia, '
           'así que el wallpaper del servidor se sigue viendo a través.'
           '<br><b>4. La columna va a la derecha</b>. La 6 la deja a la izquierda '
           'para comparar.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'paneles.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'paneles.png'), full_page=True)
        await b.close()
    print('-> paneles.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
