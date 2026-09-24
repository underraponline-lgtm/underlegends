"""EL EMBLEMA DE UN SERVIDOR, SUELTO Y EN GRANDE. Para usarlo fuera de la carta.

Dlx pidio el logo "como sale en la tarjeta, con el aro degradado".

⚠️ NO SE RECORTA DE LA CARTA: se vuelve a dibujar. El render de la carta va a
3x, asi que el emblema ahi mide 218 px — recortarlo y agrandarlo lo dejaria
blando, que es exactamente el problema que ya tuvimos con los avatares a 128.
Aca se dibuja a 512 de verdad.

    python 03_Servidor/disenos/emblema_suelto.py DRA
"""
import asyncio
import base64
import os
import sys

from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun import emblema
from los_nueve import defs

LADO = 512          # el diametro final del escudo


def b64(p):
    return ('data:image/png;base64,'
            + base64.b64encode(open(p, 'rb').read()).decode())


async def main(sv):
    cols = defs()
    acento, propio = cols[sv][0], cols[sv][1]
    esc = os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_%s.png' % sv.lower())
    k = LADO / emblema.LADO          # cuanto se agranda respecto de la carta

    if '--cuadrado' in sys.argv:
        # ⚠️ SIN ARO Y A CUADRO. Dlx: "sin el borde ese, y rellena lo demas
        # del cuadrado con ese tono metalico del fondo actual".
        #
        # El "tono metalico" es el degrade DEL ARO, no el del interior del
        # circulo: adentro hoy va un tono plano y lo que brilla es el anillo.
        # Asi que el anillo no se borra, se convierte en el fondo — por eso
        # sigue saliendo del mismo par oscuro/claro que el marco y la linea.
        from comun.marco import claro, oscuro
        o, c = oscuro(propio), claro(propio)
        fondo = f'linear-gradient(148deg,{o} 0%,{c} 46%,{o} 100%)'
        # ⚠️ EL TEXTO NO EMPUJA AL LOGO, SE LE SUPERPONE. Dlx quiere el logo
        # al tamaño del original, asi que achicarlo para hacerle lugar a T1
        # deshace lo que acaba de pedir. Va encima, abajo del todo, sobre la
        # parte del degrade que ahi ya es oscura.
        # ⚠️ SIN LA T. Dlx eligio la opcion 6. Y tiene una razon medida
        # detras: a 48 px —el tamaño al que Discord muestra el icono— la T
        # no se distinguia igual, asi que sacarla no pierde nada y quita
        # ruido. El numero solo tambien deja mas aire entre las puntas de los
        # microfonos, que es donde aterriza.
        txt = next((a.split('=')[1] for a in sys.argv
                    if a.startswith('--texto=')), '1')
        pie = '' if txt == '-' else (
            f'<b>{txt}</b>')
        html = f"""<meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@900&display=swap');
html,body{{margin:0;background:transparent}}
#w{{position:relative;width:{LADO}px;height:{LADO}px;overflow:hidden;
   background:{fondo};display:flex;align-items:center;justify-content:center}}
/* ⚠️ AL 100%, NO AL 76%. Dlx lo quiere del tamaño del original. El archivo
   de escudos_cuad ya viene normalizado POR TINTA —procesar_logos.py encuadra
   el dibujo, no su caja— asi que a 100% el logo ocupa el cuadro igual que en
   el original y no queda aire falso alrededor. */
#w img{{width:100%;height:100%;object-fit:contain}}
/* ⚠️ SIN SOMBRA NI CONTORNO: Dlx lo quiere "exacto al estilo de los demas",
   o sea tinta plana como la corona y los microfonos. El logo no tiene ni una
   sombra adentro, asi que ponersela al T1 lo delataria como agregado.

   ⚠️ EL TAMAÑO SALE DEL TRAZO, NO DE LA ALTURA. Es la opcion 2 de
   t1_estilos.py, la que Dlx pidio ver. La barra de la corona mide 12 px
   sobre 512 —el 2.3%— y en Archivo 900 el asta de la letra es ~0.19 del
   cuerpo, asi que el cuerpo sale de dividir uno por otro. La letra queda de
   ~45 px, casi tan alta como la corona: ese es el precio de igualar el trazo
   y esta asumido, no es un descuido.

   ⚠️ SIN SOMBRA, EL T1 DESAPARECE SI CAE SOBRE TINTA. En DRA aterriza entre
   las dos puntas de los microfonos, sobre fondo limpio. En otro logo con
   dibujo abajo al centro habria que correrlo o devolverle la sombra. Se
   verifica mirando, no se puede dar por hecho. */
#w b{{position:absolute;left:0;right:0;bottom:{LADO * .05:.0f}px;
   text-align:center;font-family:'Archivo',system-ui,sans-serif;
   font-weight:900;font-size:{LADO * .023 / .19:.1f}px;
   letter-spacing:.06em;color:#fff;line-height:1}}
</style><div id="w"><img src="{b64(esc)}">{pie}</div>"""
        p = os.path.join(SCR, '_emb_suelto.html')
        open(p, 'w', encoding='utf-8').write(html)
        salida = os.path.join(SCR, 'emblema_%s_cuadrado.png' % sv.lower())
        async with async_playwright() as pw:
            b = await pw.chromium.launch()
            pg = await b.new_page(viewport={'width': LADO + 4, 'height': LADO + 4})
            await pg.goto('file:///' + p.replace('\\', '/'))
            await pg.wait_for_timeout(400)
            await pg.locator('#w').screenshot(path=salida)
            await b.close()
        print(salida)
        return

    # la pieza se arma igual que en la carta y se escala entera, asi el aro
    # conserva su proporcion exacta contra el escudo
    pieza = emblema.pieza(sv, propio, acento, b64(esc))
    lado_ext = (emblema.LADO + 6.8) * k

    html = f"""<meta charset="utf-8"><style>
html,body{{margin:0;background:transparent}}
#w{{position:relative;width:{lado_ext}px;height:{lado_ext}px;overflow:hidden}}
#z{{position:absolute;transform:scale({k});transform-origin:0 0;
   width:{emblema.LADO + 6.8}px;height:{emblema.LADO + 6.8}px}}
.aro{{position:absolute;left:0;top:0 !important;border-radius:50%;
   display:flex;align-items:center;justify-content:center}}
.pieza{{border-radius:50%;overflow:hidden;display:flex;
   align-items:center;justify-content:center}}
.pieza img{{width:100%;height:100%;object-fit:contain}}
</style><div id="w"><div id="z">{pieza}</div></div>"""
    p = os.path.join(SCR, '_emb_suelto.html')
    open(p, 'w', encoding='utf-8').write(html)

    salida = os.path.join(SCR, 'emblema_%s.png' % sv.lower())
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': int(lado_ext) + 4,
                                        'height': int(lado_ext) + 4})
        await pg.goto('file:///' + p.replace('\\', '/'))
        await pg.wait_for_timeout(400)
        await pg.locator('#w').screenshot(path=salida, omit_background=True)
        await b.close()
    print(salida)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else 'DRA'))
