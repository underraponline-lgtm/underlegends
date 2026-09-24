"""Como aguantan las texturas del panel de Pais cuando la carta se achica.

    python herramientas/textura_al_achicar.py

⚠️ ES LA PRUEBA QUE DECIDE ENTRE DOS TEXTURAS QUE A TAMAÑO ENTERO SE VEN IGUAL
DE BIEN. Dlx estaba entre 'trama' y 'puntos'. A 300 px 'puntos' es 58% mas
fuerte —3.44 contra 2.18 de desvio de luz— y parece la mejor. Al achicar se da
vuelta:

  textura   amplitud   al 25% queda   mancha al 25%
  trama       2.18         45%            0.36
  puntos      3.44         25%            0.61

En absoluto al 25%: trama 0.98 y puntos 0.86, o sea que la mas debil a tamaño
entero es la MAS presente a tamaño chico. Y ademas 'puntos' deja 1.7 veces mas
mancha: su grilla tiene una frecuencia propia que bate con la del remuestreo y
se convierte en parches grandes en vez de en ruido parejo.

En Discord la carta no se ve a 300 px: el feed la escala. Una trama diagonal y
una grilla de puntos se ven parecidas a tamaño entero y se comportan MUY
distinto al bajar, porque la grilla tiene una frecuencia propia que puede
batir con la del remuestreo y aparecer como manchas.
"""
import asyncio, io, os, pathlib, sys
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

BASE = r'C:/Users/tonyd/Downloads/LigaGlobal_Tarjetas'
sys.path.insert(0, BASE)
MODOS = ['plano', 'trama', 'puntos', 'rango', 'vertical', 'rayado']
ZONA = (6, 66, 100, 300)      # el panel, sin el 92 ni el sello


async def cartas():
    import importlib.util as u
    sp = u.spec_from_file_location('mq', BASE + '/04_Pais/maqueta.py')
    m = u.module_from_spec(sp); sp.loader.exec_module(m)
    LW = round(m.W * 23 / 100)
    h = m.alto_de('recta')
    sil = "path('%s')" % m.silueta(0, 'recta')
    css = m.css_base(h, sil) + m.css_num('combo-r2')
    cuerpo = ''.join(m.carta(0, LW, 'B', True, 0, 'recta', 'colgado', 'E',
                             'combo-r2', 'panel', 'final', 'centro', x)
                     for x in MODOS)
    html = ('<!DOCTYPE html><meta charset="utf-8"><style>' + css
            + '.rack{display:flex;gap:20px}</style>'
            + '<div class="rack">' + cuerpo + '</div>')
    p = BASE + '/04_Pais/_tex.html'
    open(p, 'w', encoding='utf-8').write(html)
    async with async_playwright() as pw:
        br = await pw.chromium.launch()
        pg = await br.new_page(viewport={'width': len(MODOS) * 330 + 60,
                                         'height': h + 60},
                               device_scale_factor=1)
        await pg.goto(pathlib.Path(p).as_uri())
        await pg.wait_for_timeout(1100)
        out = []
        for el in await pg.query_selector_all('.card'):
            out.append(Image.open(io.BytesIO(
                await el.screenshot(omit_background=True))).convert('RGB'))
        await br.close()
    os.remove(p)
    return out


def manchas(d, lado=8):
    """Cuanta de la variacion es de MANCHA y no de trama.

    Se promedia el ruido en bloques de 8x8. Una trama fina promedia a cero
    en cualquier bloque; si al achicar aparece una figura de baja frecuencia
    —el batido entre la grilla y el remuestreo— los bloques dejan de dar cero
    y su desvio lo delata.
    """
    h, w = d.shape
    h, w = h // lado * lado, w // lado * lado
    b = d[:h, :w].reshape(h // lado, lado, w // lado, lado).mean(axis=(1, 3))
    return b.std()


def main():
    ims = asyncio.run(cartas())
    base = np.array(ims[0]).astype(float)
    x0, y0, x1, y1 = ZONA
    print('  textura     amplitud       al 60%        al 40%        al 25%')
    print('              (0-255)     queda / mancha  queda / mancha  '
          'queda / mancha')
    for nom, im in zip(MODOS, ims):
        if nom == 'plano':
            continue
        fila = ['  %-10s' % nom]
        for k, esc in ((1, 1.0), (2, .60), (3, .40), (4, .25)):
            a, b = im, ims[0]
            if esc < 1:
                s = (int(a.width * esc), int(a.height * esc))
                a = a.resize(s, Image.LANCZOS)
                b = b.resize(s, Image.LANCZOS)
            A = np.array(a).astype(float).mean(axis=2)
            B = np.array(b).astype(float).mean(axis=2)
            d = (A - B)[int(y0 * esc):int(y1 * esc),
                        int(x0 * esc):int(x1 * esc)]
            if k == 1:
                amp0 = d.std()
                fila.append('%10.3f' % amp0)
            else:
                fila.append('%7.0f%% %4.2f' % (100 * d.std() / max(amp0, 1e-9),
                                               manchas(d)))
        print(''.join(fila))


main()
