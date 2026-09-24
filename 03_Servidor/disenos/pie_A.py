"""El pie A, ajustado: bandera cuadrada · figura del rango · OVR del servidor.

⚠️ ESTA NO ES LA VERSION FINAL. El LADO DERECHO SIGUE SIN DECIDIRSE.

Dlx eligio la A y pidio cuatro cosas:
  · la gema al tamaño de la bandera        -> 26 px las dos
  · la bandera CUADRADA en vez de redonda  -> con esquinas apenas suaves
  · a la derecha el OVR en el servidor     -> ver el aviso de abajo
  · que la figura cambie segun el rango    -> comun/rangos.py


⚠️ EL OVR DEL SERVIDOR TODAVIA NO EXISTE. LO QUE SE VE ES MUESTRA.
------------------------------------------------------------------
Dlx pregunto bien: "en que estamos midiendo? tendriamos que crear un ranking
separado por cada servidor?". Medido:

El Sheet SI tiene un numero por servidor —son las 7 columnas de la hoja
Ranking Temporada— pero construir_pool_temporada.py las lee SOLO para saber
de cual sos (el argmax, linea 110) y en cuantos jugaste (el conteo, linea
120), Y DESPUES TIRA LOS VALORES. Ningun pool los tiene.

O sea que esto NO es dibujar: hay que tocar el builder primero.

Y hay dos cosas peores que aparecieron midiendo:

⚠️ SOLO 7 DE LOS 10 SERVIDORES TIENEN COLUMNA. Faltan FFA, EFA y RZ. Y como
`sv` sale del argmax de esas 7, NADIE PUEDE QUEDAR ASIGNADO a esos tres: sus
cartas hoy no le tocan a ninguna persona. El pool lo confirma —FFA 0, EFA 0,
RZ 0— y no es que nadie juegue ahi, es que la planilla no puede decirlo.

⚠️ Y EL REPARTO NO DA PARA UN RANKING EN LA MITAD DE LOS SERVIDORES:

    TFC 79 · SR 22 · TWR 18 · FTN 11 · FRZ 5 · URBF 2 · DRA 1

DRA tiene UNA persona y URBF DOS. El proyecto ya tiene una regla para esto
—el umbral de 3 de los circulos de abajo, en CLAUDE.md— y dice que ser "1 de
1" no significa nada. Un OVR renormalizado dentro del servidor le daria 100
al unico de DRA.

LAS TRES MANERAS, y que rompe cada una:

  a) renormalizar el SCORE dentro del servidor
     no toca el builder, pero NO ES COMPARABLE entre servidores: un 99 de
     un servidor de 5 y un 99 de uno de 40 se dibujan igual.
  b) los PUNTOS DE ESE SERVIDOR normalizados contra el maximo del pool
     es de verdad "datos de ese servidor", que es lo que la carta dice que
     mide, y es comparable. Necesita el builder. Sin numero: FFA, EFA, RZ.
  c) el Score global
     ROMPE la regla de que el numero de cada carta mide lo que esa carta
     mide. Eso ya lo dice la Competitiva.

-> (b) es la unica que cumple la regla. Hasta que este, el numero de esta
   hoja es INVENTADO y esta marcado como tal.
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
from comun import rangos as RG
from comun import pie as PIE
from los_nueve import defs
from paneles import borde
import avatares

RG.verificar()          # que la paleta no se haya separado de gencomp.py

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
ZOOM, POS = 115, 0.44          # la foto baja para dejar aire arriba
Y_NOMBRE = NOM.Y['servidor']
UL_Y, UL_H = PIE.UL_Y, PIE.UL_H

LADO, Y_FILA = PIE.LADO, PIE.Y_FILA
X_BAN, X_FIG, X_OVR = PIE.X_BAN, PIE.X_PST, PIE.X_FIG

_EST = json.load(open(os.path.join(BASE, 'datos', 'estrellas.json'),
                      encoding='utf-8'))['estrellas_por_servidor']

# (nombre, servidor, rango, cc, OVR INVENTADO). Uno por rango, para ver las
# ocho figuras. Los servidores son los que SI tienen columna en el Sheet.
GENTE = [('KONAN', 'TWR', 'SSS', 'ar', 94), ('METEORO', 'SR', 'SS', 'mx', 88),
         ('BAU', 'FRZ', 'S', 'cl', 81), ('VALEN', 'TFC', 'A', 'ar', 72),
         ('MARK', 'FTN', 'B', 'uy', 64), ('BLOODY', 'TFC', 'C', 'ar', 55),
         ('PROVENZA', 'URBF', 'D', 'co', 47), ('KRTMAN', 'DRA', 'E', 'pe', 33)]


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


def figura(rg, sufijo, lado=LADO, cx=X_FIG, cy=Y_FILA):
    """La figura del rango. El dibujo entero vive en comun/rangos.py.

    ⚠️ Antes esta funcion lo armaba aca. Con las facetas serian 33 caminos
    duplicados, y basta que se toquen de un lado para que las dos cartas de
    la misma persona salgan con piedras distintas.
    """
    return RG.svg(rg, lado, cx, cy, sufijo)


def bandera(cc, cx=X_BAN, cy=Y_FILA, lado=LADO):
    """CUADRADA, pedido de Dlx. Esquinas apenas suaves: a 26 px una esquina
    viva se ve rota por el antialias, no filosa."""
    return (f'<img class="ban" src="https://flagcdn.com/w80/{cc}.png" '
            f'style="left:{cx - lado/2:.1f}px;top:{cy - lado*.72/2:.1f}px;'
            f'width:{lado}px;height:{lado*.72:.1f}px">')


def ovr(v, acc, cx=X_OVR, cy=Y_FILA):
    return (f'<div class="ovr" style="left:{cx - 34:.1f}px;'
            f'top:{cy - 15:.1f}px;--a:{acc}"><b>{v}</b><span>OVR SV</span></div>')


def carta(i):
    nom, sv, rg, cc, ov = GENTE[i]
    cid = f'A{i}'
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    pts = camino()
    _, av = avatares.para(i)
    lado = W * ZOOM / 100
    foto = (f'<div class="foto" style="-webkit-mask-image:{M_FOTO};'
            f'mask-image:{M_FOTO}"><img src="{av}" style="width:{lado:.0f}px;'
            f'left:{(W-lado)/2:.1f}px;top:{-(lado-ALTO_FOTO)*POS:.1f}px">'
            f'</div>') if av else ''
    return f"""<div class="col">
<div class="et">{rg} · {RG.MATERIAL[rg]}</div>
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
  <div class="zona">{bandera(cc)}{figura(rg, cid)}{ovr(ov, B)}</div>
  <img class="ul" src="{UL}">
  {emblema.estrellas(int(_EST.get(sv, 0)), W, sufijo=cid)}
  {emblema.pieza(sv, A, B, b64(os.path.join(BASE, 'comun', 'escudos_cuad',
                                            f'sv_{sv.lower()}.png')))}
</div></div>"""


M_FOTO = ('linear-gradient(180deg,#000 0%,#000 72%,rgba(0,0,0,.5) 92%,'
          'transparent 100%)')
VELO = 'linear-gradient(180deg,rgba(0,0,0,.30),rgba(0,0,0,.64))'
UL = b64(os.path.join(BASE, '01_Temporada', 'ul_blanco.png'))

CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:30px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:26px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:12px}}
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
{BRI.css('luz', MARGEN, PICO.h)}
.pie{{position:absolute;inset:0;background-repeat:repeat}}
.tra{{position:absolute;inset:0;pointer-events:none}}
.nom{{position:absolute;left:0;right:0;top:{y(Y_NOMBRE)-16}px;text-align:center;
  z-index:9;font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;color:#fff;
  line-height:1;text-shadow:0 2px 6px rgba(0,0,0,.85)}}
.zona{{position:absolute;left:0;top:{MARGEN}px;width:{W}px;height:{PICO.h}px;z-index:9}}
.fig{{position:absolute;filter:drop-shadow(0 2px 6px rgba(0,0,0,.75))}}
.ban{{position:absolute;border-radius:2.5px;object-fit:cover;z-index:9;
  box-shadow:0 2px 6px rgba(0,0,0,.8),0 0 0 1.3px rgba(255,255,255,.5)}}
.ovr{{position:absolute;width:68px;text-align:center;color:#fff;
  font-family:'Archivo','LigaEmoji',sans-serif;line-height:1}}
.ovr b{{display:block;font-size:1.28rem;font-weight:900;
  text-shadow:0 2px 5px rgba(0,0,0,.9)}}
.ovr span{{display:block;font-size:.44rem;font-weight:800;letter-spacing:1.1px;
  opacity:.72;margin-top:3px}}
.ul{{position:absolute;left:50%;transform:translateX(-50%);height:{UL_H}px;
  width:auto;z-index:9;top:{y(UL_Y):.1f}px}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i) for i in range(len(GENTE)))
    med = ('gente por servidor, de las 138\n'
           '   TFC 79 · SR 22 · TWR 18 · FTN 11 · FRZ 5 · URBF 2 · DRA 1\n'
           '   FFA 0 · EFA 0 · RZ 0   <- sin columna en el Sheet\n\n'
           'gente por rango\n'
           '   SSS  1 (0.7%)   ·  A  27 (19.6%)\n'
           '   SS   5 (3.6%)   ·  B  25 (18.1%)\n'
           '   S    8 (5.8%)   ·  C  36 (26.1%)\n'
           '   E   10 (7.2%)   ·  D  26 (18.8%)')
    aviso = (
        'Bandera <b>cuadrada</b> y figura <b>del mismo tamaño</b>, 26 px las '
        'dos. Una por rango, para ver las ocho.<br><br>'
        '⚠️ <b>El OVR del servidor todavía no existe: el número que se ve es '
        'inventado.</b> El Sheet sí tiene un número por servidor —las 7 '
        'columnas de Ranking Temporada— pero el builder las lee solo para '
        'saber <b>de cuál sos</b> y <b>en cuántos jugaste</b>, y <b>tira los '
        'valores</b>. Ponerlo no es dibujar: hay que tocar el builder.<br><br>'
        '⚠️ <b>Solo 7 de los 10 servidores tienen columna</b> — faltan FFA, '
        'EFA y RZ. Y como <code>sv</code> sale del argmax de esas 7, <b>nadie '
        'puede quedar asignado a esos tres</b>: sus cartas hoy no le tocan a '
        'ninguna persona.<br><br>'
        '⚠️ <b>Y la mitad de los servidores no da para un ranking.</b> DRA '
        'tiene <b>1</b> persona y URBF <b>2</b>. El proyecto ya tiene la regla '
        '—el umbral de 3 de los círculos de abajo— y dice que ser «1 de 1» no '
        'significa nada. Un OVR renormalizado dentro del servidor le daría '
        '<b>100</b> al único de DRA.<br><br>'
        '<b>Sobre la figura:</b> ⚠️ la medición dio vuelta mi primer argumento. '
        'Yo iba a decir que los colores se confunden y <b>no se confunden</b>: '
        'de 28 pares, <b>cero</b> bajan de dE 20. Lo que sí pasa es otra cosa: '
        '<b>nunca se ven dos juntos</b> —la carta cae sola en Discord, así que '
        'el trabajo es nombrar uno de ocho <b>de memoria</b>—, y <b>en '
        'claro/oscuro se apelmazan</b>: A vs SSS <b>0.7</b> de L*, SS vs D '
        '<b>0.9</b>, S vs SS <b>1.4</b>. La figura se lee sin color.<br><br>'
        '⚠️ Por eso <b>D es cuadrado y no rombo</b>: rombo y cuadrado son la '
        'misma figura girada, y D es justo el rango más parecido a SS en luz. '
        'Habría sido la peor combinación posible sin darse cuenta.<br><br>'
        '⚠️ <b>Esta no es la versión final</b> y el <b>lado derecho sigue sin '
        'decidirse</b>.')
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">EL PIE A · BANDERA CUADRADA · FIGURA POR RANGO · '
           'OVR DEL SERVIDOR</div>'
           '<div class="aviso">' + aviso + '</div>'
           '<div class="med">' + med + '</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'pie_A.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1362, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(3000)
        await pg.screenshot(path=os.path.join(SCR, 'pie_A.png'), full_page=True)
        await b.close()
    print('-> pie_A.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
