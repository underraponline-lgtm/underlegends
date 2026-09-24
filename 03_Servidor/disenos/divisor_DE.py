"""D CONTRA E, EN LA CARTA ENTERA. Los dos a 4.5 px.

Dlx: "quiero ver la tarjeta completa... pasame el 4.5 comparacion blanco vs
degradado".

    D  degrade del marco   la linea toma el color del servidor
    E  blanco pleno        la linea vale lo mismo en las diez

⚠️ SE ELIGEN CUATRO SERVIDORES A PROPOSITO Y NO LOS DIEZ: son los que ponen a
prueba la diferencia. TWR y SR tienen el acento mas apagado contra su panel
—2.0 y 2.5— asi que son donde el degrade puede perderse; TFC lo tiene casi
blanco, o sea donde D y E casi no se distinguen; DRA tiene el acento blanco
puro, donde el degrade sigue teniendo color porque su otra parada es el
propio. Los cuatro casos de la pregunta.
"""
import base64
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))

# (indice en GENTE, sigla) — ver el orden en todos_sv.py
MUESTRA = [(2, 'TWR'), (1, 'SR'), (6, 'DRA'), (0, 'TFC')]
# ⚠️ CON --F SE COMPARA EL DEGRADE VIEJO CONTRA EL ARREGLADO. Dlx eligio el
# degrade y marco TWR y SR como los que fallan, asi que la comparacion util
# ya no es degrade-contra-blanco sino degrade-contra-degrade.
if '--F' in sys.argv:
    OPS = [('_todos_dD', 'D · degradé de hoy — el medio es el propio'),
           ('_todos_dF', 'F · degradé arreglado — el medio sube 45% al blanco')]
    SALIDA = 'divisor_F'
else:
    OPS = [('_todos_dD', 'D · degradé del marco'),
           ('_todos_dE', 'E · blanco pleno')]
    SALIDA = 'divisor_DE'


def b64(p):
    return 'data:image/png;base64,' + base64.b64encode(open(p, 'rb').read()).decode()


def main():
    filas = ''
    for carp, tit in OPS:
        cel = ''
        for i, sv in MUESTRA:
            f = os.path.join(SCR, carp, '%d.png' % i)
            if not os.path.exists(f):
                cel += f'<div class="g">falta {sv}</div>'
                continue
            cel += (f'<div class="g"><div class="gl">{sv}</div>'
                    f'<img src="{b64(f)}"></div>')
        filas += f'<h2>{tit}</h2><div class="fila">{cel}</div>'

    html = f"""<meta charset="utf-8"><style>
body{{background:#0A0A10;margin:0;padding:26px;font-family:system-ui,sans-serif}}
h1{{color:#EDEDF5;font-size:15px;letter-spacing:1.3px;margin:0 0 6px}}
h2{{color:#EDEDF5;font-size:13px;letter-spacing:1.6px;margin:24px 0 10px}}
p{{color:#8A8AA0;font-size:12.5px;max-width:1260px;line-height:1.55;margin:0 0 4px}}
b{{color:#C98A4B}}
.fila{{display:flex;gap:14px}}
.g{{text-align:center;width:300px}}
.gl{{color:#8A8AA0;font-size:10.5px;font-weight:800;letter-spacing:1.4px;
     margin-bottom:6px}}
img{{width:300px;display:block}}
</style>
<h1>LA LINEA DEL DIVISOR A 4.5 px — {OPS[0][1].split('·')[1].strip().upper()}
    CONTRA {OPS[1][1].split('·')[1].strip().upper()}</h1>
<p>Los dos miden <b>4.5 px</b>, que es <b>lo que se ve del marco</b>: el marco
usa stroke 9 pero va recortado a la silueta, asi que se le pinta la mitad.</p>
<p><b>&#9888;</b> Subir <b>encender()</b> no arreglaba nada: multiplica por
255/canal-maximo, asi que un color que ya tiene un canal en 255 <b>no se
mueve</b>. A f=1.00, el maximo posible, seguian sin llegar <b>SR 1.64, TWR
1.57, URBF 1.60 y DRA 1.00</b> — cuatro de diez. La parada del medio ahora
sube <b>hacia el blanco</b>, que no depende del canal maximo: los diez pasan
de <b>1.9</b> y el peor sube de <b>1.00 a 2.1</b>. Las <b>puntas siguen siendo
el acento</b>, asi que la linea sigue diciendo de que servidor es la carta.</p>
<p>Los cuatro son los casos que ponen a prueba la diferencia: TWR y SR con el
acento mas apagado, TFC con el acento casi blanco —donde casi no se
distinguen— y DRA con el acento blanco puro.</p>
{filas}"""
    p = os.path.join(SCR, '_%s.html' % SALIDA)
    open(p, 'w', encoding='utf-8').write(html)
    print(p)
    _cap(p, os.path.join(SCR, SALIDA + '.png'))


def _cap(entrada, salida):
    import asyncio
    from playwright.async_api import async_playwright

    async def go():
        async with async_playwright() as pw:
            b = await pw.chromium.launch()
            pg = await b.new_page(viewport={'width': 1330, 'height': 900},
                                  device_scale_factor=2)
            await pg.goto('file:///' + entrada.replace('\\', '/'))
            await pg.wait_for_timeout(500)
            await pg.screenshot(path=salida, full_page=True)
            await b.close()
    asyncio.run(go())
    print(salida)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
