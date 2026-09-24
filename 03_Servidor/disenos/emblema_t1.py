"""SEIS FORMAS DE METER T1 EN EL LOGO CUADRADO.

Dlx quiere la temporada marcada en el icono y pidio comparar ideas.

⚠️ LA RESTRICCION QUE LAS ORDENA: el logo va al 100% del cuadro, porque Dlx
lo pidio "exactamente como el original". Entonces NINGUNA idea puede achicar
el logo para hacerle lugar — todas tienen que convivir con el encima o en un
borde. Las que achican el dibujo estan descartadas de entrada.

⚠️ Y SE MIRAN A TAMAÑO DE ICONO, no a 512. Discord muestra el icono de un
servidor a ~48 px en la barra lateral. Una marca que solo se lee a 512 no
sirve, asi que cada idea va tambien en chico al lado.
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

L = 320
TXT = 'T1'

# ⚠️ EL TAMAÑO SE MIDE CONTRA LA CORONA, no a ojo. Dlx: "mucho mas pequeño,
# del mismo tamaño de la corona o incluso menos". Medida sobre el PNG de DRA,
# la corona ocupa 54 px de alto sobre 512, o sea el 10.5%.
#
# Un font-size no es la altura de la letra: en Archivo 900 la mayuscula mide
# ~0.72em. Asi que para que la letra mida una fraccion F del cuadro, el
# font-size tiene que ser F/0.72.
CORONA = .105       # lo que ocupa la corona, medido
LETRA = CORONA * .55    # la letra queda a poco mas de la mitad de la corona
CUERPO = LETRA / .72    # el font-size que da esa altura de mayuscula


def b64(p):
    return ('data:image/png;base64,'
            + base64.b64encode(open(p, 'rb').read()).decode())


IDEAS = [
    ('A', 'texto suelto abajo',
     'lo mas simple. No toca el logo, pero en chico se pierde contra el dibujo',
     '<b class="a">{t}</b>'),
    ('B', 'pastilla abajo',
     'se despega del dibujo porque tiene su propio fondo',
     '<b class="b">{t}</b>'),
    ('C', 'esquina inferior derecha',
     'no cruza el logo por el medio; es donde menos tinta hay',
     '<b class="c">{t}</b>'),
    ('D', 'franja al pie',
     'la mas legible en chico, pero se come una banda del cuadro',
     '<b class="d">{t}</b>'),
    ('E', 'marca de agua detras',
     'no compite, pero a 48 px no se ve',
     '<b class="e">{t}</b>'),
    ('F', 'esquina, en circulo',
     'lee como insignia. Es la que mejor aguanta el tamaño chico',
     '<b class="f">{t}</b>'),
]


async def main(sv='DRA'):
    cols = defs()
    pr = cols[sv][1]
    o, c = oscuro(pr), claro(pr)
    fondo = f'linear-gradient(148deg,{o} 0%,{c} 46%,{o} 100%)'
    esc = b64(os.path.join(BASE, 'comun', 'escudos_cuad',
                           'sv_%s.png' % sv.lower()))

    cel = ''
    for k, nom, nota, tpl in IDEAS:
        pieza = tpl.format(t=TXT)
        cel += (f'<div class="g"><div class="gl">{k} · {nom}</div>'
                f'<div class="par">'
                f'<div class="cu" style="background:{fondo}">'
                f'<img src="{esc}">{pieza}</div>'
                f'<div class="cu ch" style="background:{fondo}">'
                f'<img src="{esc}">{pieza}</div></div>'
                f'<div class="gs">{nota}</div></div>')

    html = f"""<meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@800;900&display=swap');
body{{background:#0A0A10;margin:0;padding:24px;font-family:system-ui,sans-serif}}
h1{{color:#EDEDF5;font-size:15px;letter-spacing:1.2px;margin:0 0 6px}}
p{{color:#8A8AA0;font-size:12.5px;max-width:1180px;line-height:1.55;margin:0 0 16px}}
em{{color:#C98A4B;font-style:normal;font-weight:700}}
.fila{{display:flex;gap:18px;flex-wrap:wrap}}
.g{{width:{L + 70}px;margin-bottom:14px}}
.gl{{color:#EDEDF5;font-size:11.5px;font-weight:800;letter-spacing:.9px;
     margin-bottom:7px}}
.gs{{color:#7A7A90;font-size:11px;margin-top:7px;line-height:1.45}}
.par{{display:flex;align-items:flex-end;gap:10px}}
.cu{{position:relative;width:{L}px;height:{L}px;overflow:hidden;
    border-radius:{L * .08:.0f}px;flex:none}}
.cu.ch{{width:48px;height:48px;border-radius:4px}}
.cu img{{width:100%;height:100%;object-fit:contain}}
.cu b{{position:absolute;font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;
     color:#fff;line-height:1}}

/* ⚠️ EN px CALCULADOS Y NO EN %. La primera version puso font-size en
   porcentaje pensando que era del ancho del cuadro, y en CSS el % de
   font-size es de la FUENTE HEREDADA: el T1 salio diminuto en las seis y la
   marca de agua no se veia. La version chica usa em, que sí escala. */
/* A · texto suelto abajo */
.a{{left:0;right:0;bottom:5%;text-align:center;font-size:{L * CUERPO:.1f}px;
   letter-spacing:.08em;text-shadow:0 1px 5px rgba(0,0,0,.65)}}
/* B · pastilla abajo */
.b{{left:50%;transform:translateX(-50%);bottom:5%;font-size:{L * CUERPO:.1f}px;
   padding:.30em .75em;border-radius:2em;background:rgba(8,10,20,.66);
   letter-spacing:.11em}}
/* C · esquina inferior derecha */
.c{{right:6%;bottom:4.5%;font-size:{L * CUERPO:.1f}px;letter-spacing:.06em;
   text-shadow:0 1px 5px rgba(0,0,0,.65)}}
/* D · franja al pie */
.d{{left:0;right:0;bottom:0;text-align:center;font-size:{L * CUERPO:.1f}px;
   padding:.42em 0;background:rgba(8,10,20,.72);letter-spacing:.16em}}
/* E · marca de agua detras */
.e{{left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;
   font-size:{L * CUERPO * 2.4:.1f}px;opacity:.20;letter-spacing:0;z-index:0}}
/* F · esquina, en circulo */
.f{{right:4.5%;bottom:4.5%;font-size:{L * CUERPO:.1f}px;width:2.3em;
   height:2.3em;border-radius:50%;display:flex;align-items:center;
   justify-content:center;background:rgba(8,10,20,.72);
   box-shadow:0 2px 7px rgba(0,0,0,.5)}}
/* la version de 48 px reescala todo en proporcion */
.cu.ch .a,.cu.ch .b,.cu.ch .c,.cu.ch .d,.cu.ch .f{{
   font-size:{48 * CUERPO:.2f}px}}
.cu.ch .e{{font-size:{48 * CUERPO * 2.4:.2f}px}}
</style>
<h1>T1 EN EL LOGO — SEIS IDEAS</h1>
<p><em>&#9888;</em> Ninguna achica el logo: Dlx lo pidio al tamaño del
original, asi que hacerle lugar recortandolo deshace eso. Todas conviven con
el dibujo, encima o en un borde.</p>
<p><em>&#9888;</em> Cada una va tambien a <em>48 px</em>, que es como Discord
muestra el icono en la barra lateral. Una marca que solo se lee a 512 no
sirve.</p>
<div class="fila">{cel}</div>"""
    p = os.path.join(SCR, '_emb_t1.html')
    open(p, 'w', encoding='utf-8').write(html)
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 1290, 'height': 900},
                              device_scale_factor=2)
        await pg.goto('file:///' + p.replace('\\', '/'))
        await pg.wait_for_timeout(600)
        await pg.screenshot(path=os.path.join(SCR, 'emblema_t1.png'),
                            full_page=True)
        await b.close()
    print('emblema_t1.png')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else 'DRA'))
