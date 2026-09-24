"""Los fondos de País, recortados con la silueta de verdad.

    python 04_Pais/ver_fondos.py            -> 04_Pais/fondos.png
    python 04_Pais/ver_fondos.py --chequear -> ademas mide si dos se parecen

⚠️ SE MIRAN RECORTADOS Y NO EN UN CUADRADO. Un patron que se ve bien en un
rectangulo puede perder su gracia adentro del escudo: las franjas del pie de
Colombia caen justo donde la silueta se angosta, y una diagonal cambia de
inclinacion aparente cuando los lados se cierran.

⚠️ Y EL CHEQUEO NO ES DECORATIVO. De los 16 paises con carta las paletas
chocan solas —dos amarillos, tres celestes, cinco rojos, dos verdes— asi que
lo unico que los separa es el PATRON. El chequeo compara los dos: si dos
fondos tienen el color parecido Y el patron parecido, avisa.
"""
import argparse
import asyncio
import os
import pathlib
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)

from comun.siluetas import PAIS
from fondos import ORDEN, defs, VELO, MATERIAL

COL = 6
ESCALA = 2
SIN_VELO = '--sin-velo' in sys.argv


def hoja():
    d = defs()
    cel = ''
    for cc in ORDEN:
        a, b, fondo, extra, pais, desc = d[cc]
        capas = ','.join(x for x in (extra, fondo) if x)
        # ⚠️ SE MUESTRA CON EL VELO PUESTO, que es como va a estar en la
        # carta. Sin el, 12 de 17 no aguantan texto blanco: mirar la bandera
        # pelada es mirar algo que nunca se va a ver asi.
        cap2 = ((MATERIAL + ',' + capas) if SIN_VELO
                else VELO + ',' + MATERIAL + ',' + capas)
        cel += (f'<div class="c"><div class="card" style="background:{cap2}">'
                f'<u>NOMBRE</u></div><b>{pais}</b><i>{desc}</i></div>')
    return ('<!DOCTYPE html><meta charset="utf-8"><style>'
            'body{margin:0;background:#0B0B12;padding:26px;'
            "font-family:system-ui}"
            f'.g{{display:grid;grid-template-columns:repeat({COL},1fr);'
            'gap:26px 20px;max-width:%dpx}}' % (COL * (PAIS.w + 20)) +
            '.c{text-align:center;color:#EDEDF5}'
            f'.card{{width:{PAIS.w}px;height:{PAIS.h}px;'
            f'clip-path:{PAIS.css};-webkit-clip-path:{PAIS.css}}}'
            'b{display:block;font-size:13px;letter-spacing:.6px;margin-top:9px}'
            'i{display:block;font-size:10.5px;opacity:.55;font-style:normal;'
            'margin-top:2px;line-height:1.35}'
            '.card u{position:relative;top:76%;display:block;text-align:center;'
            "font-family:Archivo,'LigaEmoji',system-ui;font-weight:900;font-size:26px;"
            'letter-spacing:1px;color:#fff;text-decoration:none}'
            f'</style><div class="g">{cel}</div>')


async def render():
    p = os.path.join(SCR, '_fondos.html')
    open(p, 'w', encoding='utf-8').write(hoja())
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        br = await pw.chromium.launch()
        pg = await br.new_page(
            viewport={'width': COL * (PAIS.w + 20) + 60, 'height': 900},
            device_scale_factor=ESCALA)
        await pg.goto(pathlib.Path(p).as_uri())
        await pg.wait_for_timeout(500)
        salida = os.path.join(SCR, 'fondos.png')
        await pg.screenshot(path=salida, full_page=True)
        await br.close()
    print('-> %s' % os.path.relpath(salida, BASE))
    return salida


async def chequear():
    """Dos fondos con el mismo color Y el mismo patron es un error."""
    import numpy as np
    from PIL import Image
    p = os.path.join(SCR, '_chk.html')
    d = defs()
    cel = ''
    for cc in ORDEN:
        a, b, fondo, extra, _p, _q = d[cc]
        capas = ','.join(x for x in (extra, fondo) if x)
        cel += f'<div class="k" style="background:{capas}"></div>'
    open(p, 'w', encoding='utf-8').write(
        '<!DOCTYPE html><meta charset="utf-8"><style>body{margin:0;'
        'font-size:0;background:#000}'
        f'.k{{display:inline-block;width:{PAIS.w}px;height:{PAIS.h}px}}'
        f'</style>{cel}')
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        br = await pw.chromium.launch()
        pg = await br.new_page(
            viewport={'width': PAIS.w * len(ORDEN), 'height': PAIS.h})
        await pg.goto(pathlib.Path(p).as_uri())
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=os.path.join(SCR, '_chk.png'))
        await br.close()
    im = np.array(Image.open(os.path.join(SCR, '_chk.png')).convert('RGB')).astype(float)
    # ⚠️ LA PRIMERA VERSION DE ESTA MEDICION NO SERVIA PARA BANDERAS. Comparaba
    # "cuanto varia por fila y por columna", y eso distingue rayado horizontal
    # de vertical pero NO distingue amarillo-azul-rojo de rojo-amarillo-verde:
    # los dos son tres bandas horizontales. Daba por parecidos a Colombia y
    # Bolivia, que no se parecen en nada, y por distintos a pares que si.
    #
    # Lo que separa dos banderas es EL ORDEN DE SUS COLORES. Asi que la firma
    # es el PERFIL: el color medio de 16 fajas horizontales y 8 verticales.
    # Dos banderas iguales tienen el mismo perfil; dos con los mismos colores
    # en otro orden, no.
    FH, FV = 16, 8
    firmas = {}
    for i, cc in enumerate(ORDEN):
        c = im[:, i * PAIS.w:(i + 1) * PAIS.w]
        h = np.array([c[int(k * c.shape[0] / FH):int((k + 1) * c.shape[0] / FH)]
                      .reshape(-1, 3).mean(axis=0) for k in range(FH)])
        v = np.array([c[:, int(k * c.shape[1] / FV):int((k + 1) * c.shape[1] / FV)]
                      .reshape(-1, 3).mean(axis=0) for k in range(FV)])
        firmas[cc] = (np.concatenate([h.ravel(), v.ravel()]),
                      c.reshape(-1, 3).mean(axis=0))
    print('  LOS PARES MAS PARECIDOS (mismo perfil de color):')
    pares = []
    for i, x in enumerate(ORDEN):
        for y in ORDEN[i + 1:]:
            dp = np.abs(firmas[x][0] - firmas[y][0]).mean()
            dc = np.abs(firmas[x][1] - firmas[y][1]).mean()
            pares.append((dp, x, y, dc))
    pares.sort()
    for dp, x, y, dc in pares[:6]:
        mal = '  <- SE PARECEN' if dp < 22 else ''
        print('     %-3s vs %-3s   perfil %5.1f · color medio %5.1f%s'
              % (x, y, dp, dc, mal))
    print()
    print('  ⚠️ el perfil compara EL ORDEN de los colores, no cuanta variacion')
    print('     hay. Colombia y Ecuador tienen LA MISMA BANDERA y el unico')
    print('     que los separa es el escudo del medio: ahi el numero tiene')
    print('     que salir chico, y esta bien que salga.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--chequear', action='store_true')
    ap.add_argument('--sin-velo', action='store_true',
                    help='mira la bandera pelada; NO es como se va a ver')
    a = ap.parse_args()
    asyncio.run(render())
    if a.chequear:
        asyncio.run(chequear())


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
