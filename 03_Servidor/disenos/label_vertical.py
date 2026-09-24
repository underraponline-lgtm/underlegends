"""EL LABEL VERTICAL DEL LADO DERECHO, girado 90 grados. Cuatro formas.

Dlx: "poner el label girando 90 grados en la derecha pero con transparencia
mas o menos, o dependiendo como tu veas".

⚠️ EL DATO QUE LAS ORDENA, medido: la columna de stats va de x=229 a x=285 y
el filo interno del marco esta en 295.5, asi que entre las dos cosas quedan
10.5 px. Un texto girado necesita 14-16 px de caja. NO ENTRA sin convivir con
la columna, y por eso las cuatro se diferencian en COMO conviven, no en donde
van.

Se muestra recortado a la franja derecha y no la carta entera: un texto de
9 px en una carta de 300 no se puede juzgar a tamaño completo.
"""
import asyncio
import base64
import io
import os
import sys

from PIL import Image

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun import pie as PIE, marco as MK
from comun.siluetas import PICO
from comun.emblema import MARGEN
from los_nueve import defs

ESC = 3
TXT = 'T1'

# ⚠️ ADENTRO DE LA CARTA, NO EN EL FILO. Dlx: "no en el borde ni en el
# marco". Y el texto es corto —T1, o PRE en pretemporada— asi que ya no hace
# falta la franja de 300 px de alto que pedia el texto largo: entra en
# cualquier hueco. Eso abre lugares que antes no existian.
#
# La columna de stats va de x=229 a x=285, asi que a su izquierda —right 74 en
# adelante— hay carta libre sobre la foto.
# ⚠️ AL FILO PERO ADENTRO, Y EN BLANCO. Dlx: "tiene que estar al borde para
# dentro de la tarjeta en blanco pero algo transparente".
#
# La franja util es la de siempre: el marco pinta hasta x=295.5 y la columna
# arranca en x=285, o sea right entre 5 y 15. Se elige right:9 —el medio de
# esa franja— para no tocar ninguna de las dos.
#
# Y vuelve el BLANCO, que en la carta se habia sacado de todas las piezas.
# Aca tiene sentido y no contradice aquello: lo que se saco fue el blanco
# OPACO haciendo de color de marca. Esto es blanco TRANSPARENTE haciendo de
# marca de agua sobre una foto que no controlamos, que es justo donde ningun
# color propio funciona —lo acabamos de medir: el claro de DRA es #94A5FF y
# la foto es azul grisaceo—.
# ⚠️ CENTRADO CONTRA LAS STATS, NO CONTRA LA CARTA. Dlx: "tiene que estar en
# el medio centrado al costado del borde por dentro, al costado de las stats".
# Son dos centros distintos y dan lugares distintos:
#
#   centro de la carta   y = 62 + 405/2 = 264.5
#   centro de las stats  las cinco filas van de y=117 a y=243 -> 180
#
# Se usa el de las stats, que es lo que se pidio y ademas es lo que se ve:
# el label acompaña al bloque de numeros, no a la silueta.
CY_STATS = 180
IDEAS = [
    ('A', 'blanco 25%', 'apenas se insinua',
     f'right:9px;top:{CY_STATS}px;font-size:10px;opacity:.25'),
    ('B', 'blanco 38%', 'el punto medio',
     f'right:9px;top:{CY_STATS}px;font-size:10px;opacity:.38'),
    ('C', 'blanco 52%', 'presente; ya discute con el borde',
     f'right:9px;top:{CY_STATS}px;font-size:10px;opacity:.52'),
    ('D', 'blanco 38%, cuerpo 13', 'mismo tono, mas grande',
     f'right:8px;top:{CY_STATS}px;font-size:13px;opacity:.38'),
]
TEXTO = {}


def b64(im):
    b = io.BytesIO()
    im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


async def main(sv='DRA', idx=6):
    cols = defs()
    claro = MK.claro(cols[sv][1])
    base = os.path.join(SCR, '_todos_dF', '%d.png' % idx)
    carta = b64(Image.open(base).convert('RGBA'))

    cel = ''
    for k, nom, nota, css in IDEAS:
        # el color claro del logo en vez de blanco: la carta ya no lleva
        # blancos sueltos en ninguna pieza
        cel += (f'<div class="g"><div class="gl">{k} · {nom}</div>'
                f'<div class="cw"><div class="cu"><img src="{carta}">'
                f'<div class="lb" style="{css};color:#fff">'
                f'{TEXTO.get(k, TXT)}</div>'
                f'</div></div><div class="gs">{nota}</div></div>')

    # solo la franja derecha de la carta, ampliada
    x0 = 190
    html = f"""<meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&display=swap');
body{{background:#0A0A10;margin:0;padding:24px;font-family:system-ui,sans-serif}}
h1{{color:#EDEDF5;font-size:15px;letter-spacing:1.2px;margin:0 0 6px}}
p{{color:#8A8AA0;font-size:12.5px;max-width:1180px;line-height:1.55;margin:0 0 14px}}
em{{color:#C98A4B;font-style:normal;font-weight:700}}
.fila{{display:flex;gap:16px}}
.g{{width:{(PICO.w - x0) * 2}px}}
.gl{{color:#EDEDF5;font-size:11.5px;font-weight:800;letter-spacing:.8px;
     margin-bottom:6px}}
.gs{{color:#7A7A90;font-size:11px;margin-top:6px;line-height:1.45}}
/* ⚠️ EL RECORTE VA EN UN PADRE CON overflow, no en el elemento escalado.
   La primera version puso el scale y el margen negativo en el mismo div que
   recortaba, y el resultado se desbordo: las cuatro cartas se pisaron entre
   si y los labels quedaron pintados FUERA de la carta, sobre el fondo. */
.cw{{position:relative;width:{(PICO.w - x0) * 2}px;
    height:{(PICO.h + MARGEN) * 2}px;overflow:hidden}}
.cu{{position:absolute;left:-{x0 * 2}px;top:0;
    width:{PICO.w}px;height:{PICO.h + MARGEN}px;
    transform:scale(2);transform-origin:0 0}}
.cu img{{position:absolute;left:0;top:0;width:{PICO.w}px}}
/* ⚠️ writing-mode EN VEZ DE rotate + translate. La version con
   transform-origin y translateY(-100%) me dejo el texto fuera de la caja y
   no habia forma de razonarla; vertical-rl gira el texto SIN mover su caja,
   asi que top/right significan lo que parece. */
/* ⚠️ translateY(-50%) para que el `top` sea EL CENTRO del label y no su
   tope. Con writing-mode el texto crece hacia abajo, asi que sin esto el
   label arrancaria en el centro de las stats en vez de quedar centrado en
   ellas — y el error crece con el largo del texto: T1 se corre 5 px, PRE
   se correria 8. */
.lb{{position:absolute;transform:translateY(-50%);
    margin-top:{MARGEN}px;
    writing-mode:vertical-rl;white-space:nowrap;letter-spacing:.20em;
    font-family:'Archivo','LigaEmoji',sans-serif;font-weight:800;line-height:1;
    text-transform:uppercase}}
</style>
<h1>EL LABEL VERTICAL A LA DERECHA — CUATRO FORMAS</h1>
<p><em>&#9888;</em> Medido: la columna de stats termina en <em>x=285</em> y el
filo interno del marco esta en <em>295.5</em>. Quedan <em>10.5 px</em>. Un
texto girado necesita 14-16 de caja, asi que no entra sin convivir con la
columna — por eso las cuatro se diferencian en <em>como conviven</em>.</p>
<p>Recortado a la franja derecha y al doble: un texto de 6.5 px en una carta
de 300 no se puede juzgar a tamaño completo.</p>
<div class="fila">{cel}</div>"""
    p = os.path.join(SCR, '_label_v.html')
    open(p, 'w', encoding='utf-8').write(html)

    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 1080, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file:///' + p.replace('\\', '/'))
        await pg.wait_for_timeout(700)
        await pg.screenshot(path=os.path.join(SCR, 'label_vertical.png'),
                            full_page=True)
        await b.close()
    print('label_vertical.png')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(main())
