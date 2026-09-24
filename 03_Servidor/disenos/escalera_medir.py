"""LA PASTILLA A TAMAÑO DE LA COMPETITIVA: ¿entra en la carta?

Dlx: "ajusta bien su posicion y tiene que estar mas centrado como esta el de
competitivo... asi mismo o el mismo tamaño si es posible".

⚠️ "SI ES POSIBLE" ES LA PARTE MEDIBLE, y no es obvia. La .rkbox de la
Competitiva vive en un escudo de 300 px de ancho y arranca en left:8%, o sea
con toda la carta a su derecha. Acá la pastilla va centrada en la columna, a
28 px del borde derecho, y la silueta es un PICO: arriba es angosta y se abre
hacia abajo. A la altura de la pastilla la carta puede no llegar.

Este script mide tres cosas sobre el render real:

    1. el ancho de la pastilla en cada uno de los diez
    2. si sus dos bordes caen DENTRO de la silueta a esa altura
    3. el hueco contra el numero de arriba y contra la primera fila
"""
import asyncio
import os
import sys

from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import pie as PIE


# ⚠️ EL LIMITE NO ES LA SILUETA, ES EL MARCO. La primera version de este
# script comparaba contra el borde de la silueta y daba "0 px fuera" con la
# pastilla llegando a x=297.9 sobre 300: cierto y sin valor. El marco se pinta
# con stroke-width 9 recortado a la silueta, o sea 4.5 px HACIA ADENTRO, asi
# que lo que la pastilla no puede pisar empieza en 295.5.
GROSOR_MARCO = 9.0
AIRE = 2.0          # que no quede pegada al filo tampoco


def borde_der(yy):
    """Hasta donde puede llegar algo dibujado, a esa altura."""
    silueta = PICO.w / 2 + min(20.8 + yy * 4.14, PICO.w / 2)
    return silueta - GROSOR_MARCO / 2 - AIRE


async def main():
    # ⚠️ NO SIRVE todos_sv.html: la hoja EMBEBE los PNG ya capturados, asi que
    # ahi no hay ningun elemento que medir. Las cartas vivas quedan sueltas en
    # _todos/{i}.html, una por servidor, y son esas las que hay que abrir.
    tmp = os.path.join(SCR, '_todos')
    hs = sorted((f for f in os.listdir(tmp) if f.endswith('.html')),
                key=lambda f: int(f.split('.')[0])) if os.path.isdir(tmp) else []
    if not hs:
        print('faltan _todos/*.html: correr todos_sv.py primero')
        return
    datos = []
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': PICO.w, 'height': 460})
        for f in hs:
            await pg.goto('file:///' + os.path.join(tmp, f).replace('\\', '/'))
            await pg.wait_for_timeout(250)
            datos.append(await pg.evaluate("""() => {
              const w = document.querySelector('.wrap');
              const r = e => { if (!e) return null;
                const a = e.getBoundingClientRect(), b = w.getBoundingClientRect();
                return {x: a.left - b.left, y: a.top - b.top,
                        w: a.width, h: a.height}; };
              const p = w.querySelector('.escp');
              return {pas: r(p), num: r(w.querySelector('.ovr b')),
                      fila: r(w.querySelector('.mini')),
                      txt: p ? p.textContent.trim() : ''};
            }"""))
        await b.close()

    # ⚠️ el margen de la silueta: la carta se dibuja con MARGEN arriba, asi
    # que la y del DOM no es la y de la silueta. Se resta.
    from comun.emblema import MARGEN
    print('   %-9s %6s %8s %8s %7s %7s' %
          ('escalon', 'ancho', 'izq', 'der', 'tope', 'a fila'))
    print('   ' + '-' * 52)
    peor_out, peor_num, peor_fila = 0.0, 999.0, 999.0
    for d in datos:
        if not d['pas']:
            continue
        a = d['pas']
        x0, x1 = a['x'], a['x'] + a['w']
        ys = a['y'] - MARGEN + a['h'] / 2
        lim = borde_der(ys)
        fuera = max(0.0, x1 - lim)
        peor_out = max(peor_out, fuera)
        hn = a['y'] - (d['num']['y'] + d['num']['h'])
        hf = d['fila']['y'] - (a['y'] + a['h']) if d['fila'] else 999
        peor_num, peor_fila = min(peor_num, hn), min(peor_fila, hf)
        print('   %-9s %6.1f %8.1f %8.1f %7.1f %7.1f%s'
              % (d['txt'], a['w'], x0, x1, hn, hf,
                 '   <- SE SALE %.1f' % fuera if fuera > 0 else ''))
    print('   ' + '-' * 52)
    print('   pisa el marco:            %.1f px' % peor_out)
    print('   hueco minimo al numero:   %.1f px  (la .rkbox usa 7)' % peor_num)
    print('   hueco minimo a la fila:   %.1f px' % peor_fila)
    if peor_out > 0:
        print('\n   ⚠️ NO ENTRA AL TAMAÑO EXACTO DE LA COMPETITIVA, y el motivo')
        print('   es la forma: la .rkbox arranca en left:8% con TODA la carta a')
        print('   su derecha, mientras que esta va centrada a 28 px del borde.')
        ancho_max = 2 * (borde_der(100) - (PICO.w - PIE.COL_DER - PIE.COL_ANCHO / 2))
        print('   Centrada ahi, lo mas ancho que entra son %.0f px.' % ancho_max)
        may = max(d['pas']['w'] for d in datos if d['pas'])
        print('   La mas larga mide %.1f: hay que bajarla un %.0f%%.'
              % (may, 100 * (1 - ancho_max / may)))

    # ⚠️ EL HUECO DE ARRIBA SE MIDE CONTRA LA TINTA, NO CONTRA LA CAJA. La
    # .rkbox usa margin-top 7 debajo de un numero con line-height 0.78, que es
    # una caja apretada: la tinta termina casi donde termina la caja. El
    # nuestro tiene line-height 0.92, asi que entre el ultimo pixel del numero
    # y el fondo de su caja hay aire que la caja no muestra. Copiar el 7 no
    # copia el hueco que se ve.
    tinta(datos)


def tinta(datos):
    """Donde termina LA TINTA del numero, no su caja.

    ⚠️ COPIAR EL 7 DE LA .rkbox NO COPIA EL HUECO QUE SE VE. Su numero tiene
    line-height 0.78 —caja apretada, la tinta llega casi al fondo— y el
    nuestro 0.92, asi que abajo del ultimo pixel del numero sobra caja que no
    se ve. El mismo margen de caja da un hueco visual MAS GRANDE acá.

    Se mide sobre el PNG: el numero es blanco, asi que la ultima fila con
    pixeles casi blancos dentro de la columna es su tinta.
    """
    import numpy as np
    from PIL import Image
    tmp = os.path.join(SCR, '_todos')
    esc = 3                      # device_scale_factor de todos_sv.py
    x0 = int((PICO.w - PIE.COL_DER - PIE.COL_ANCHO) * esc)
    x1 = int((PICO.w - PIE.COL_DER) * esc)
    print('\n   donde termina la TINTA del numero (y de silueta):')
    peor = 0.0
    for i, d in enumerate(datos):
        f = os.path.join(tmp, '%d.png' % i)
        if not d['pas'] or not os.path.exists(f):
            continue
        a = np.array(Image.open(f).convert('RGB')).astype(int)
        # solo entre el tope del numero y el tope de la pastilla
        ya = int(d['num']['y'] * esc)
        yb = int(d['pas']['y'] * esc)
        reg = a[ya:yb, x0:x1]
        blanco = (reg > 235).all(axis=2)
        filas = np.where(blanco.any(axis=1))[0]
        if not len(filas):
            continue
        fin = (ya + filas[-1]) / esc          # en px de carta
        hueco = d['pas']['y'] - fin
        peor = max(peor, hueco)
        if i < 3:
            print('      carta %d  tinta hasta %.1f  ->  hueco real %.1f px'
                  % (i, fin, hueco))
    print('      ⚠️ el hueco de caja daba 1.8; el de tinta es %.1f' % peor)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(main())
