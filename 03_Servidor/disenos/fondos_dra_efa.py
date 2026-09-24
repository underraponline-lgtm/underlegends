"""LOS DOS FONDOS QUE FALTAN: DRA y EFA.

Son dos problemas distintos y conviene no tratarlos igual.

EFA TIENE UN OBJETIVO MEDIBLE
-----------------------------
Al pasar al cobre de su logo quedo en 20 grados de tono y 0.40 de luz, y SR
esta en 24 grados y 0.40: **mismo tono y misma luz**. Antes EFA era #3A2412
con luz 0.15 y estaba separado. O sea que la solucion no es de gusto: hay que
moverlo en tono o en luz hasta que la distancia con SR sea suficiente, y eso
se mide.

DRA ES DE GUSTO Y YA FALLO SEIS VECES
-------------------------------------
⚠️ Antes de proponer una septima, conviene ver que tenian en comun las seis.
Por los scripts que quedaron: oxido/textura, constelacion, estructura, franja,
grieta, lineas y limpio. Drako rechazo el oxido por SUCIO —y estaba medido:
era el segundo en mancha—.

**Lo que ninguna hizo: usar lo que el logo de DRA ya tiene.** Su marca es una
corona sobre dos microfonos cruzados. Las seis tandas buscaron un material
—oxido, grieta, estatica— o una geometria abstracta —lineas, franjas—, pero
ninguna salio del dibujo propio. Las opciones de aca van por ahi.
"""
import asyncio
import colorsys
import os
import sys

from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from los_nueve import defs


def hsl(c):
    h = c.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
    return hh * 360, ll, ss


def dist(a, b):
    """Separacion entre dos colores en tono y luz. El tono es circular."""
    h1, l1, _ = hsl(a)
    h2, l2, _ = hsl(b)
    dh = abs(h1 - h2)
    dh = min(dh, 360 - dh)
    return dh, abs(l1 - l2)


# ── EFA: candidatos, y cuanto separan de SR ──────────────────────────────
EFA_OPS = [
    ('1', 'como esta', '#A95225'),
    ('2', 'mas oscuro', '#6B3216'),      # baja la luz, conserva el tono cobre
    ('3', 'mucho mas oscuro', '#4A2210'),
    ('4', 'cobre frio', '#8A5A3A'),      # sube el tono hacia el marron
    ('5', 'el viejo', '#3A2412'),        # el que estaba separado antes
]


def main_medir():
    D = defs()
    sr = D['SR'][1]
    print('  SR esta en %.0f grados de tono y %.2f de luz  (%s)'
          % (hsl(sr)[0], hsl(sr)[1], sr))
    print()
    print('  %-3s %-18s %-9s %6s %6s   %s'
          % ('', 'candidato EFA', 'color', 'dTono', 'dLuz', 'separa?'))
    print('  ' + '-' * 64)
    for k, nom, c in EFA_OPS:
        dh, dl = dist(c, sr)
        # se considera separado si difiere claro en UNA de las dos
        ok = 'si' if (dh >= 18 or dl >= 0.14) else 'NO — se pisa con SR'
        print('  %-3s %-18s %-9s %6.0f %6.2f   %s' % (k, nom, c, dh, dl, ok))
    print("""
   ⚠️ ALCANZA CON SEPARARSE EN UNA DE LAS DOS. Dos colores del mismo tono se
   distinguen si uno es claramente mas oscuro, y dos de la misma luz se
   distinguen si el tono difiere. Lo que no funciona es quedar cerca en las
   dos, que es exactamente lo que pasa hoy.""")


# ── DRA: por donde no fueron las seis ────────────────────────────────────
# ⚠️ Las seis buscaron un MATERIAL —oxido, grieta, estatica— o una GEOMETRIA
# abstracta —lineas, franjas, constelacion—. Ninguna uso el dibujo propio de
# DRA, que es una corona sobre dos microfonos cruzados. Estas van por ahi:
# el motivo sale de la marca, no de una textura inventada.
AZUL, CLARO, OSCURO = '#3D5BFF', '#8A9CFF', '#121B4C'
BASE_DRA = f'linear-gradient(166deg,{CLARO} 0%,{AZUL} 42%,{OSCURO} 100%)'


def dra_ops(esc_b64):
    return [
        ('1', 'como esta', 'el degrade solo, sin motivo', BASE_DRA, ''),
        ('2', 'escudo al agua',
         'el escudo propio en grande y muy tenue. La marca ES el fondo',
         BASE_DRA,
         f'background-image:url({esc_b64});background-size:150% auto;'
         f'background-position:52% 34%;background-repeat:no-repeat;'
         f'opacity:.10;filter:brightness(3)'),
        ('3', 'escudo repetido',
         'el mismo dibujo chico y en patron, como estampado de camiseta',
         BASE_DRA,
         f'background-image:url({esc_b64});background-size:64px auto;'
         f'opacity:.07;filter:brightness(3)'),
        ('4', 'escudo + diagonal',
         'el escudo al agua con una banda al sesgo, que le da direccion',
         BASE_DRA,
         f'background-image:url({esc_b64}),'
         f'repeating-linear-gradient(118deg,rgba(255,255,255,.05) 0 2px,'
         f'transparent 2px 26px);'
         f'background-size:150% auto,auto;background-position:52% 34%,0 0;'
         f'background-repeat:no-repeat,repeat;opacity:.13;filter:brightness(2.4)'),
    ]


async def main_render():
    import base64
    D = defs()
    esc = os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_dra.png')
    b64 = ('data:image/png;base64,'
           + base64.b64encode(open(esc, 'rb').read()).decode())

    def caja(tit, nota, fondo, capa):
        return (f'<div class="g"><div class="gl">{tit}</div>'
                f'<div class="cw" style="background:{fondo}">'
                + (f'<div class="ov" style="{capa}"></div>' if capa else '')
                + f'</div><div class="gs">{nota}</div></div>')

    dra = ''.join(caja('%s · %s' % (k, n), nota, f, c)
                  for k, n, nota, f, c in dra_ops(b64))

    sr = D['SR'][1]
    efa = ''
    for k, nom, c in EFA_OPS:
        dh, dl = dist(c, sr)
        from comun.marco import claro as _cl
        g = (f'linear-gradient(166deg,{_cl(c)} 0%,{c} 44%,'
             f'{_oscurecer(c, .55)} 100%)')
        efa += caja('%s · %s' % (k, nom),
                    'dTono %.0f · dLuz %.2f%s' % (
                        dh, dl, '' if (dh >= 18 or dl >= .14)
                        else '  ← se pisa con SR'),
                    g, '')
    efa += caja('SR, para comparar', 'el que EFA no tiene que parecerse',
                D['SR'][2], D['SR'][3])

    html = f"""<meta charset="utf-8"><style>
body{{background:#0A0A10;margin:0;padding:24px;font-family:system-ui,sans-serif}}
h1{{color:#EDEDF5;font-size:15px;letter-spacing:1.2px;margin:0 0 6px}}
h2{{color:#EDEDF5;font-size:12.5px;letter-spacing:1.4px;margin:24px 0 8px}}
p{{color:#8A8AA0;font-size:12.5px;max-width:1180px;line-height:1.55;margin:0 0 4px}}
em{{color:#C98A4B;font-style:normal;font-weight:700}}
.fila{{display:flex;gap:14px;flex-wrap:wrap}}
.g{{width:220px}}
.gl{{color:#EDEDF5;font-size:11.5px;font-weight:800;letter-spacing:.7px;
     margin-bottom:6px}}
.gs{{color:#7A7A90;font-size:11px;margin-top:6px;line-height:1.4}}
.cw{{position:relative;width:220px;height:300px;border-radius:6px;
     overflow:hidden}}
.ov{{position:absolute;inset:0}}
</style>
<h1>LOS DOS FONDOS QUE FALTAN</h1>
<h2>DRA — por dónde no fueron las seis tandas anteriores</h2>
<p>Las seis buscaron un <em>material</em> —óxido, grieta, estática— o una
<em>geometría abstracta</em> —líneas, franjas, constelación—. Ninguna usó el
dibujo propio de DRA. Estas sí: el motivo sale de la marca.</p>
<div class="fila">{dra}</div>
<h2>EFA — acá no es gusto, es separarse de SR</h2>
<p>EFA está en <em>20°/0.40</em> y SR en <em>24°/0.40</em>: mismo tono y misma
luz. <em>&#9888;</em> Y mover el tono no sirve —el cobre y el naranja son la
misma familia, da 0° de diferencia—. <em>La única palanca es la luz.</em></p>
<div class="fila">{efa}</div>"""
    p = os.path.join(SCR, '_fondos2.html')
    open(p, 'w', encoding='utf-8').write(html)
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 1260, 'height': 900},
                              device_scale_factor=2)
        await pg.goto('file:///' + p.replace('\\', '/'))
        await pg.wait_for_timeout(700)
        await pg.screenshot(path=os.path.join(SCR, 'fondos_dra_efa.png'),
                            full_page=True)
        await b.close()
    print('fondos_dra_efa.png')


def _oscurecer(c, f):
    h = c.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return '#%02X%02X%02X' % tuple(int(x * (1 - f)) for x in (r, g, b))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main_medir()
    asyncio.run(main_render())
