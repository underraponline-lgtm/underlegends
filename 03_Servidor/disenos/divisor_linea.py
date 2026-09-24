"""LA LINEA QUE SEPARA LA FOTO DEL PANEL: cinco versiones, recortadas a ella.

Dlx: "acerca de la linea que separa el avatar y el fondo, podrias hacer una
comparacion? podrias hacer que esa linea sea el mismo tamaño del marco de la
tarjeta? y quizas tambien el mismo toque de degradado vs otra comparacion que
sea full blanco?".

⚠️ "EL MISMO TAMAÑO DEL MARCO" TIENE DOS RESPUESTAS Y DAN DISTINTO, asi que
estan las dos. El marco se dibuja con stroke-width 9 pero RECORTADO A LA
SILUETA, o sea que su mitad de afuera no se pinta y lo que se ve son 4.5. La
linea del divisor no esta recortada, asi que sus 1.9 se ven enteros.

⚠️ Y SE RECORTA A LA ZONA DE LA LINEA, no la carta entera: una linea de 2 px
comparada a tamaño carta no se puede juzgar. Es la regla de siempre —cuando lo
que mirás es mas chico que la tolerancia con la que lo mirás, el resultado no
sirve—.
"""
import base64
import os
import sys

from PIL import Image

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun import divisor as DIV
from comun.siluetas import PICO
from comun.emblema import MARGEN

ESC = 3
# la banda vertical que se recorta, alrededor de la curva
Y0 = int(DIV.Y_EXTREMOS * PICO.h) - 34
ALTO = 76

OPS = [('', 'A · como esta', '1.9 px, acento'),
       ('_dB', 'B · 4.5 px', 'lo que SE VE del marco'),
       ('_dC', 'C · 9 px', 'el NUMERO del marco, o sea el doble'),
       ('_dD', 'D · 4.5 px degrade', 'el mismo degrade del marco'),
       ('_dE', 'E · 4.5 px blanco', 'blanco pleno')]
MUESTRA = [(0, 'TFC'), (1, 'SR'), (6, 'DRA')]


def recorte(carp, i):
    f = os.path.join(SCR, carp, '%d.png' % i)
    if not os.path.exists(f):
        return None
    im = Image.open(f).convert('RGBA')
    caja = (0, (Y0 + MARGEN) * ESC, im.width, (Y0 + MARGEN + ALTO) * ESC)
    return im.crop(caja)


def b64(im):
    import io
    b = io.BytesIO()
    im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def main():
    filas = ''
    for i, sv in MUESTRA:
        cel = ''
        for suf, tit, nota in OPS:
            im = recorte('_todos' + suf, i)
            if im is None:
                cel += f'<div class="g"><div class="gl">{tit}</div>falta</div>'
                continue
            cel += (f'<div class="g"><div class="gl">{tit}</div>'
                    f'<img src="{b64(im)}"><div class="gs">{nota}</div></div>')
        filas += f'<h2>{sv}</h2><div class="fila">{cel}</div>'

    html = f"""<meta charset="utf-8"><style>
body{{background:#0A0A10;margin:0;padding:26px;font-family:system-ui,sans-serif}}
h1{{color:#EDEDF5;font-size:15px;letter-spacing:1.3px;margin:0 0 6px}}
h2{{color:#8A8AA0;font-size:12px;letter-spacing:1.6px;margin:20px 0 8px}}
p{{color:#8A8AA0;font-size:12.5px;max-width:1240px;line-height:1.55;margin:0 0 4px}}
b{{color:#C98A4B}}
.fila{{display:flex;gap:12px;flex-wrap:wrap}}
.g{{text-align:center;width:300px}}
.gl{{color:#EDEDF5;font-size:11px;font-weight:800;letter-spacing:1px;
     margin-bottom:6px}}
.gs{{color:#7A7A90;font-size:10.5px;margin-top:5px}}
img{{width:300px;display:block;border-radius:3px}}
</style>
<h1>LA LINEA DEL DIVISOR — CINCO VERSIONES</h1>
<p><b>&#9888;</b> "El mismo tamaño del marco" tiene <b>dos respuestas</b>: el
marco usa stroke 9 pero va <b>recortado a la silueta</b>, asi que se le ve la
mitad — <b>4.5 px</b>. La linea del divisor no esta recortada y se ve entera.
Copiar el numero da el <b>doble</b> de grueso que el marco; copiar lo que se
ve da 4.5.</p>
<p>Recortado a la banda de la curva: una linea de 2 px comparada a tamaño
carta no se puede juzgar.</p>
{filas}"""
    p = os.path.join(SCR, '_divlinea.html')
    open(p, 'w', encoding='utf-8').write(html)
    print(p)
    medir()


def _lum(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]


def contraste(a, b):
    la, lb = _lum(a), _lum(b)
    return (max(la, lb) + .05) / (min(la, lb) + .05)


def medir():
    """¿Se ve la linea sobre el panel que tiene debajo?

    ⚠️ QUINTA VEZ QUE ENTRA EL ACENTO EN LA MISMA PREGUNTA. Ya paso con el
    brillo de arriba, el marco, el aro del emblema y el texto de la escalera.
    Aca importa menos que en un texto —una linea gruesa se ve con menos
    contraste que una letra— pero conviene saber cual es el peor caso antes de
    elegir, no despues.
    """
    from los_nueve import defs
    D = defs()
    print('\n   contraste de la linea contra el panel de abajo (WCAG)')
    print('   %-6s %9s %9s   %s' % ('sv', 'B acento', 'E blanco', ''))
    print('   ' + '-' * 44)
    peor_b = peor_e = 99.0
    for sv in D:
        acento, propio = D[sv][0], D[sv][1]
        cb, ce = contraste(acento, propio), contraste('#FFFFFF', propio)
        peor_b, peor_e = min(peor_b, cb), min(peor_e, ce)
        marca = '   <- el acento pierde' if cb < ce * .6 else ''
        print('   %-6s %9.1f %9.1f%s' % (sv, cb, ce, marca))
    print('   ' + '-' * 44)
    print('   peor caso    %9.1f %9.1f' % (peor_b, peor_e))
    print("""
   ⚠️ EL BLANCO NO ES "MAS SEGURO" GRATIS: es el mismo valor en las diez, o
   sea que la linea deja de decir de que servidor es la carta. El acento la
   hace parte del color de cada uno y a cambio se apaga en los que tienen el
   acento oscuro. Es la misma tension de siempre, y aca la decide el ojo
   porque una linea de 4.5 px no necesita el 4.5:1 que necesita una letra.""")


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
