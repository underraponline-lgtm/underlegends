"""LA COMPETITIVA Y LA SERVIDOR, LADO A LADO Y MEDIDAS.

Dlx pidio compararlas detalle por detalle.

⚠️ SE COMPARAN A LA MISMA ALTURA EN PANTALLA, NO A SU TAMAÑO DE ARCHIVO. Las
dos cartas miden distinto —485 contra 405— asi que ponerlas a igual escala de
pixeles hace ver la Servidor mas chica y nada de lo que se compare significa
algo. Escaladas al mismo alto, lo que se ve es la PROPORCION, que es lo unico
comparable entre cartas de distinto tamaño. Es la misma leccion del UL.
"""
import asyncio
import base64
import os
import sys

from PIL import Image

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun import pie as PIE
from comun.siluetas import PICO
from comun.emblema import MARGEN

ALTO = 760          # los dos se llevan a este alto


def b64(p):
    return ('data:image/png;base64,'
            + base64.b64encode(open(p, 'rb').read()).decode())


# (que, Competitiva, Servidor) en % del alto de cada carta
H_C, H_S = 485.0, PICO.h


def fila(que, c, s, nota=''):
    d = abs(c - s)
    al = ' style="color:#C98A4B"' if d > .9 else ''
    return (f'<tr{al}><td>{que}</td><td>{c:.2f}%</td><td>{s:.2f}%</td>'
            f'<td>{d:.2f}</td><td class="n">{nota}</td></tr>')


def main():
    comp = b64(os.path.join(BASE, '02_Competitivo', 'Konan_competitivo.png'))
    serv = b64(os.path.join(SCR, '_todos_dF', '0.png'))

    # las alturas de la Servidor salen de pie.py; las de la Competitiva de
    # su card.css, leidas en las tandas anteriores
    filas = ''.join([
        fila('numero grande, tope', 16.50, 100 * (PIE.COL_Y_OVR) / H_S,
             'la Servidor lo pone MAS ARRIBA'),
        fila('fila de circulos', 73.61, 100 * PIE.Y_FILA / H_S,
             'casi identicas'),
        fila('TAG, tope', 81.97, 100 * PIE.TAG_Y / H_S, ''),
        fila('UL, tope', 88.45, 100 * PIE.UL_Y / H_S, ''),
        fila('UL, alto', 4.29, 100 * PIE.UL_H / H_S, 'igualado a proposito'),
        fila('UL al fondo', 7.26, 100 * (H_S - PIE.UL_Y - PIE.UL_H) / H_S,
             'la Servidor cierra en punta: no puede igualarlo'),
    ])

    html = f"""<meta charset="utf-8"><style>
body{{background:#0A0A10;margin:0;padding:26px;font-family:system-ui,sans-serif}}
h1{{color:#EDEDF5;font-size:16px;letter-spacing:1.2px;margin:0 0 8px}}
p{{color:#8A8AA0;font-size:12.5px;max-width:1100px;line-height:1.55;margin:0 0 8px}}
em{{color:#C98A4B;font-style:normal;font-weight:700}}
.par{{display:flex;gap:26px;align-items:flex-start;margin-top:14px}}
.g{{text-align:center}}
.gl{{color:#EDEDF5;font-size:12px;font-weight:800;letter-spacing:1px;
     margin-bottom:8px}}
img{{height:{ALTO}px;display:block}}
table{{border-collapse:collapse;margin-top:6px;font-size:12px;color:#C9C9D8}}
th{{color:#8A8AA0;font-weight:700;text-align:left;padding:5px 12px 5px 0;
    border-bottom:1px solid #2A2A38;font-size:11px;letter-spacing:.6px}}
td{{padding:4px 12px 4px 0;border-bottom:1px solid #1A1A24}}
td.n{{color:#7A7A90;font-size:11px}}
</style>
<h1>COMPETITIVA CONTRA SERVIDOR — DETALLE POR DETALLE</h1>
<p><em>&#9888;</em> Escaladas al <em>mismo alto en pantalla</em>, no a su
tamaño de archivo. Miden 485 y 405: a igual escala de pixeles la Servidor se
ve mas chica y nada de lo que se compare significa algo. Lo comparable entre
cartas de distinto tamaño es la <em>proporcion</em>.</p>
<div class="par">
  <div class="g"><div class="gl">COMPETITIVA · 300×485</div>
    <img src="{comp}"></div>
  <div class="g"><div class="gl">SERVIDOR · 300×405</div>
    <img src="{serv}"></div>
  <div>
    <table>
      <tr><th>pieza</th><th>Competitiva</th><th>Servidor</th><th>dif</th>
          <th>nota</th></tr>
      {filas}
    </table>
    <p style="margin-top:14px;max-width:340px">En <em>naranja</em> las que se
    separan mas de <em>0.9%</em> del alto, que a este tamaño es 1 px de la
    Servidor.</p>
  </div>
</div>"""
    p = os.path.join(SCR, '_comparar.html')
    open(p, 'w', encoding='utf-8').write(html)

    from playwright.async_api import async_playwright

    async def go():
        async with async_playwright() as pw:
            b = await pw.chromium.launch()
            pg = await b.new_page(viewport={'width': 1420, 'height': 900},
                                  device_scale_factor=2)
            await pg.goto('file:///' + p.replace('\\', '/'))
            await pg.wait_for_timeout(600)
            await pg.screenshot(path=os.path.join(SCR, 'comparar_cartas.png'),
                                full_page=True)
            await b.close()
    asyncio.run(go())
    print('comparar_cartas.png')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
