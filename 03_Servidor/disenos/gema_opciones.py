"""LA GEMA DEL RANGO: el icono adentro de algo, como el rombo de la Competitiva.

Dlx: "el logo de cada rango competitivo seria de una manera especifica, no como
actualmente. Un ejemplo claro es como esta conformado el rombo del lado
izquierdo de la tarjeta competitiva… el icono tendria que estar dentro de algo,
quizas un diamante o un circulo".

LA COMPOSICION QUE SE COPIA (card.css:57)
----------------------------------------
    cuadrado rotado 45 con esquinas redondeadas   <- el continente
    relleno oscuro en degrade                     <- la cama
    borde de 2 px del acento                      <- lo que dice el nivel
    el icono adentro, CONTRA-ROTADO -45           <- para que no salga torcido
    un punto abajo a la derecha                   <- el nivel

⚠️ LO QUE CAMBIA RESPECTO DE HOY. Las ocho figuras de comun/rangos.py son la
FORMA misma —estrella, brillante, moneda, hexagono…—. Aca pasan a ser el
CONTENIDO de un continente comun. Se conservan: el trabajo de separar las ocho
siluetas no se tira, cambia de rol.

⚠️ Y ESO RESUELVE ALGO QUE HOY NO FUNCIONA BIEN. Con la figura suelta, el
continente y el contenido son la misma cosa, asi que el rango tiene que
distinguirse SOLO por su contorno. Con un continente comun, el borde y el punto
pueden decir el NIVEL y la figura decir CUAL, que es exactamente el reparto que
ya usa la Competitiva.

⚠️ EL PUESTO DENTRO DEL RANGO, medido sobre el pool:
    SSS 1 · SS 5 · S 8 · A 27 · B 25 · C 36 · D 26 · E 10
SSS tiene UNA sola persona, asi que con el umbral de 3 el rango mas alto seria
EL UNICO SIN PUESTO. Hay que decidirlo a sabiendas.
"""
import asyncio
import os
import sys

from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun import rangos as RG
from los_nueve import defs

SV = 'TFC'
MUESTRA = ['SSS', 'SS', 'A', 'C', 'E']
L = 44          # el lado del continente


def fig_svg(rg, lado, op=1.0):
    """La figura de rangos.py como ICONO, no como forma suelta."""
    return (f'<svg viewBox="0 0 100 100" width="{lado}" height="{lado}" '
            f'style="opacity:{op}"><path d="{RG.FIGURA[rg]}" fill="currentColor"/>'
            f'</svg>')


OPS = [
    ('A', 'como esta hoy', 'la figura suelta: continente y contenido son lo mismo'),
    ('B', 'rombo', 'la composicion de la Competitiva, tal cual'),
    ('C', 'circulo', 'mismo interior, continente redondo'),
    ('D', 'rombo + puesto', 'el punto de abajo pasa a ser el puesto dentro del rango'),
    ('E', 'escudo', 'continente con punta abajo, que rima con la silueta de la carta'),
]


async def main():
    D = defs()
    acento, propio = D[SV][0], D[SV][1]
    filas = ''
    for k, nom, nota in OPS:
        cel = ''
        for rg in MUESTRA:
            acc = RG.ACENTO[rg]
            ico = fig_svg(rg, L * .46)
            if k == 'A':
                cuerpo = (f'<div class="solo" style="color:{acc}">'
                          f'{fig_svg(rg, L * .82)}</div>')
            elif k == 'C':
                cuerpo = (f'<div class="cont red" style="border-color:{acc};'
                          f'color:{acc}">{ico}</div>')
            elif k == 'E':
                cuerpo = (f'<div class="cont esc" style="border-color:{acc};'
                          f'color:{acc}">{ico}</div>')
            else:
                pto = ('<b class="pt" style="background:%s">7</b>' % acc) if k == 'D' else ''
                cuerpo = (f'<div class="cont rmb" style="border-color:{acc};'
                          f'color:{acc}"><u>{ico}</u></div>{pto}')
            cel += (f'<div class="g"><div class="w">{cuerpo}</div>'
                    f'<div class="rg">{rg}</div></div>')
        filas += (f'<div class="bl"><div class="tt">{k} · {nom}</div>'
                  f'<div class="fl">{cel}</div>'
                  f'<div class="nt">{nota}</div></div>')

    html = f"""<meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@800;900&display=swap');
body{{background:#0A0A10;margin:0;padding:26px;font-family:system-ui,sans-serif}}
h1{{color:#EDEDF5;font-size:15px;letter-spacing:1.2px;margin:0 0 6px}}
p{{color:#8A8AA0;font-size:12.5px;max-width:1120px;line-height:1.55;margin:0 0 4px}}
em{{color:#C98A4B;font-style:normal;font-weight:700}}
.bl{{margin-top:22px}}
.tt{{color:#EDEDF5;font-size:12px;font-weight:800;letter-spacing:1.1px;
    margin-bottom:10px}}
.nt{{color:#7A7A90;font-size:11px;margin-top:8px}}
.fl{{display:flex;gap:26px}}
.g{{text-align:center;width:70px}}
.w{{position:relative;height:{L + 14}px;display:flex;align-items:center;
   justify-content:center}}
.rg{{color:#8A8AA0;font-size:10px;font-weight:800;letter-spacing:1px;
    margin-top:2px;font-family:'Archivo','LigaEmoji',sans-serif}}
.solo svg{{display:block}}
.cont{{width:{L}px;height:{L}px;border:2px solid;display:flex;
     align-items:center;justify-content:center;
     background:linear-gradient(150deg,rgba(9,9,16,.95),rgba(32,32,50,.95))}}
.rmb{{transform:rotate(45deg);border-radius:9px}}
.rmb u{{display:block;transform:rotate(-45deg);text-decoration:none;
      line-height:0}}
.red{{border-radius:50%}}
.esc{{border-radius:8px 8px 42% 42%}}
.pt{{position:absolute;right:6px;bottom:4px;width:15px;height:15px;
   border-radius:50%;color:#0B0B12;font-family:'Archivo','LigaEmoji',sans-serif;
   font-size:9px;font-weight:900;display:flex;align-items:center;
   justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.7)}}
</style>
<h1>LA GEMA DEL RANGO — EL ICONO DENTRO DE UN CONTINENTE</h1>
<p>Se copia la composición del rombo de la Competitiva (<em>card.css:57</em>):
cuadrado rotado 45 con esquinas redondeadas, relleno oscuro, borde del acento,
el ícono adentro <em>contra-rotado</em> para que no salga torcido, y un punto
abajo.</p>
<p><em>&#9888;</em> Las ocho figuras de <em>rangos.py</em> no se tiran: pasan de
ser <em>la forma</em> a ser <em>el contenido</em>. Y eso reparte el trabajo — el
borde y el punto dicen el <em>nivel</em>, la figura dice <em>cuál</em>.</p>
<p><em>&#9888;</em> Puesto dentro del rango, medido: SSS <em>1</em> · SS 5 · S 8
· A 27 · B 25 · C 36 · D 26 · E 10. <em>SSS tiene una sola persona</em>, así que
con el umbral de 3 el rango más alto sería el único sin puesto.</p>
{filas}"""
    p = os.path.join(SCR, '_gema.html')
    open(p, 'w', encoding='utf-8').write(html)
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 700, 'height': 900},
                              device_scale_factor=3)
        await pg.goto('file:///' + p.replace(chr(92), '/'))
        await pg.wait_for_timeout(600)
        await pg.screenshot(path=os.path.join(SCR, 'gema_opciones.png'),
                            full_page=True)
        await b.close()
    print('gema_opciones.png')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(main())
