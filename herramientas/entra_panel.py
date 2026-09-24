"""Si el panel de Pais aguanta lo que le metieron, en el peor caso.

    python 04_Pais/maqueta.py --combos
    python herramientas/entra_panel.py            # lee _combos.html
    python herramientas/entra_panel.py 04_Pais/_numeros.html

Mide dos cosas por variante: cuanto sobra entre el numero mas ancho y el
divisor, y cuanto entre el ultimo casillero y el sello UL.

⚠️ EL PEOR CASO NO ES EL DE NADIE. Konan tiene cuatro casilleros y numeros de
una cifra, y asi entra todo con holgura. El que decide es el de SEIS —bandera,
rango, servidor, crew, nacional y mundial— con dos cifras, que hoy no lo tiene
nadie porque la Copa de Naciones arranca en T2. Las hojas lo simulan.

⚠️ EL NOMBRE SALE DEL DOM. La hoja ordena por NUM_MODOS y no por el orden en
que se pidieron con --solo, asi que una lista de nombres escrita a mano se
corre sin avisar: los numeros salen bien y pegados a la variante equivocada.
"""
import asyncio, pathlib, sys
from playwright.async_api import async_playwright
HTML = pathlib.Path(sys.argv[1] if len(sys.argv) > 1
                    else '04_Pais/_combos.html').resolve()

async def m():
    async with async_playwright() as pw:
        br = await pw.chromium.launch()
        pg = await br.new_page(viewport={'width': 1900, 'height': 900})
        await pg.goto(HTML.as_uri()); await pg.wait_for_timeout(1100)
        d = await pg.evaluate("""() => [...document.querySelectorAll('.card')].map(c => {
          const cb = c.getBoundingClientRect(), L = c.querySelector('.lane');
          // el zoom de la tira multiplica todo; se saca de la caja del .ic,
          // que en el codigo mide lo que diga _FORMA
          const bs = [...c.querySelectorAll('.cas .x')],
                cas = [...c.querySelectorAll('.cas')],
                Z = Math.round(c.getBoundingClientRect().width / 300);
          return {nom: [...L.classList].find(x => x !== 'lane' && x !== 'colgado'),
            der: Math.max(...bs.map(b => {
              // ⚠️ LA CAJA DEL NUMERO NO ES SU TINTA. Cuando el numero va
              // centrado debajo del icono su caja ocupa el ancho entero del
              // casillero, asi que su borde derecho cae SIEMPRE en el divisor
              // y el medidor gritaba "0.0 de aire" con el texto a 30 px de
              // ahi. Se mide el rango de texto, que es lo que se ve.
              const r = document.createRange(); r.selectNodeContents(b);
              const t = r.getBoundingClientRect(); r.detach();
              return ((t.width ? t : b.getBoundingClientRect()).right - cb.left)/Z;})),
            div: (c.querySelector('.panel').getBoundingClientRect().right - cb.left)/Z,
            // ⚠️ Y EL ALTO TAMPOCO. Un rombo es un cuadrado girado 45 grados y
            // la rotacion NO cambia la caja de layout: seis rombos de 28
            // miden 28 cada uno para el flujo y pintan 39.6. Medido por caja
            // sobraban 73 px que no sobraban. Se toma el rectangulo pintado.
            abajo: Math.max(...cas.map(e => {
              const r = e.getBoundingClientRect(), ic = e.querySelector('.ic');
              return Math.max(r.bottom, ic ? ic.getBoundingClientRect().bottom : 0);
            }).map(v => (v - cb.top)/Z)),
            ulAr: (c.querySelector('.ul').getBoundingClientRect().top - cb.top)/Z,
            et: [...c.querySelectorAll('.cas i')].filter(e => e.offsetParent).length,
            caja: c.querySelector('.ic').getBoundingClientRect().width/Z};});""")
        await br.close()
    print('  variante        caja  etiq   sobra der.   hasta el UL')
    for x in d:
        v = x['ulAr'] - x['abajo']
        print('  %-14s %4.0f %5d %12.1f %13.1f%s'
              % (x['nom'], x['caja'], x['et'], x['div'] - x['der'], v,
                 '  <- SE PISAN' if v < 0 else ''))

asyncio.run(m())
