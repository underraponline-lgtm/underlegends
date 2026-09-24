"""COMO ESCRIBIR EL T1 PARA QUE PAREZCA PARTE DEL DIBUJO.

Dlx: "crees que pueda seguir el estilo de lo demas? quizas otras fuentes? que
ideas tienes aparte".

⚠️ LO QUE HACE QUE ALGO SE VEA DEL MISMO DIBUJO ES EL GROSOR DE TRAZO, no la
familia tipografica. Medido sobre el PNG de DRA:

    la corona            54 px de alto  (10.5% del cuadro)
    su barra de abajo    12 px de grosor (2.3%)

⚠️ Y AHI HAY UN CONFLICTO QUE CONVIENE VER ANTES DE ELEGIR FUENTE. Dlx quiere
el T1 mas chico que la corona —quedo en el 55%, o sea ~30 px de alto de letra
sobre 512—. Para que su trazo mida los 12 px del logo, con una grotesca de
peso 900 (asta ~0.19 del cuerpo) haria falta un cuerpo de ~63 px, o sea una
letra de 45 px: casi tan alta como la corona.

O sea que A ESE TAMAÑO NINGUN PESO IGUALA EL TRAZO DEL DIBUJO. Hay que elegir:
la letra chica con trazo mas fino que el logo, o el trazo del logo con la
letra mas grande. Las opciones de abajo se reparten entre esas dos salidas y
una tercera: dibujarlo como forma en vez de escribirlo.
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
from comun.marco import claro, oscuro
from los_nueve import defs

L = 300
CORONA = .105
BARRA = .023        # el trazo fino del logo, medido


def b64(p):
    return ('data:image/png;base64,'
            + base64.b64encode(open(p, 'rb').read()).decode())


def cuerpo(alto_letra):
    return alto_letra / .72


IDEAS = [
    ('1', 'Archivo 900 — lo que hay',
     'la letra al 55% de la corona. Su asta mide ~6 px contra los 12 del logo',
     f"font-family:'Archivo';font-weight:900;"
     f"font-size:{L * cuerpo(CORONA * .55):.1f}px;letter-spacing:.08em"),
    ('2', 'Archivo 900, al trazo del logo',
     'mismo trazo que la corona. El precio: la letra queda casi tan alta como ella',
     f"font-family:'Archivo';font-weight:900;"
     f"font-size:{L * BARRA / .19:.1f}px;letter-spacing:.06em"),
    ('3', 'Barlow Condensed 800',
     'condensada: mas alta sin ocupar mas ancho, y el trazo sube sin agrandar tanto',
     f"font-family:'Barlow Condensed';font-weight:800;"
     f"font-size:{L * cuerpo(CORONA * .80):.1f}px;letter-spacing:.10em"),
    ('4', 'con barra debajo',
     'repite la barra de la corona. La forma la hace parte del dibujo, no la fuente',
     f"font-family:'Archivo';font-weight:900;"
     f"font-size:{L * cuerpo(CORONA * .55):.1f}px;letter-spacing:.10em;"
     f"padding-bottom:{L * .022:.1f}px;"
     f"border-bottom:{L * BARRA:.1f}px solid #fff"),
    ('5', 'numero romano · T I',
     'la I es una barra: ya es la forma del logo, sin imitar nada',
     f"font-family:'Archivo';font-weight:900;"
     f"font-size:{L * cuerpo(CORONA * .62):.1f}px;letter-spacing:.22em"),
    ('6', 'solo el numero',
     'sin la T. Menos ruido y a 48 px es lo unico que igual se iba a leer',
     f"font-family:'Archivo';font-weight:900;"
     f"font-size:{L * cuerpo(CORONA * .70):.1f}px"),
]
TEXTO = {'5': 'T I', '6': '1'}


async def main(sv='DRA'):
    cols = defs()
    pr = cols[sv][1]
    o, c = oscuro(pr), claro(pr)
    fondo = f'linear-gradient(148deg,{o} 0%,{c} 46%,{o} 100%)'
    esc = b64(os.path.join(BASE, 'comun', 'escudos_cuad',
                           'sv_%s.png' % sv.lower()))
    cel = ''
    for k, nom, nota, css in IDEAS:
        t = TEXTO.get(k, 'T1')
        cel += (f'<div class="g"><div class="gl">{k} · {nom}</div>'
                f'<div class="par">'
                f'<div class="cu" style="background:{fondo}">'
                f'<img src="{esc}"><b style="{css}">{t}</b></div>'
                f'<div class="cu ch" style="background:{fondo}">'
                f'<img src="{esc}"><b style="{css};'
                f'font-size:{48 / L * 100:.0f}%">{t}</b></div>'
                f'</div><div class="gs">{nota}</div></div>')

    html = f"""<meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@800;900&family=Barlow+Condensed:wght@700;800&display=swap');
body{{background:#0A0A10;margin:0;padding:24px;font-family:system-ui,sans-serif}}
h1{{color:#EDEDF5;font-size:15px;letter-spacing:1.2px;margin:0 0 6px}}
p{{color:#8A8AA0;font-size:12.5px;max-width:1200px;line-height:1.55;margin:0 0 6px}}
em{{color:#C98A4B;font-style:normal;font-weight:700}}
.fila{{display:flex;gap:16px;flex-wrap:wrap;margin-top:12px}}
.g{{width:{L + 66}px;margin-bottom:12px}}
.gl{{color:#EDEDF5;font-size:11.5px;font-weight:800;letter-spacing:.8px;
     margin-bottom:6px}}
.gs{{color:#7A7A90;font-size:11px;margin-top:6px;line-height:1.45}}
.par{{display:flex;align-items:flex-end;gap:10px}}
.cu{{position:relative;width:{L}px;height:{L}px;overflow:hidden;
    border-radius:{L * .08:.0f}px;flex:none}}
.cu.ch{{width:48px;height:48px;border-radius:4px}}
.cu img{{width:100%;height:100%;object-fit:contain}}
.cu b{{position:absolute;left:50%;transform:translateX(-50%);bottom:5%;
     color:#fff;line-height:1;white-space:nowrap}}
</style>
<h1>EL T1 EN EL ESTILO DEL DIBUJO — SEIS SALIDAS</h1>
<p><em>&#9888;</em> Lo que hace que algo parezca del mismo dibujo es el
<em>grosor de trazo</em>, no la familia. Medido en DRA: la corona mide 54 px
de alto y su barra <em>12 px</em> de grosor, sobre 512.</p>
<p><em>&#9888;</em> Y ahi hay un conflicto: para que el T1 tenga ese trazo con
una grotesca 900, su letra tendria que medir ~45 px — <em>casi tan alta como
la corona</em>, que es justo lo que Dlx no queria. O letra chica con trazo mas
fino que el logo, o trazo del logo con letra grande. O dibujarlo como forma.</p>
<div class="fila">{cel}</div>"""
    p = os.path.join(SCR, '_t1_estilos.html')
    open(p, 'w', encoding='utf-8').write(html)
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 1240, 'height': 900},
                              device_scale_factor=2)
        await pg.goto('file:///' + p.replace('\\', '/'))
        await pg.wait_for_timeout(900)
        await pg.screenshot(path=os.path.join(SCR, 't1_estilos.png'),
                            full_page=True)
        await b.close()
    print('t1_estilos.png')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else 'DRA'))
