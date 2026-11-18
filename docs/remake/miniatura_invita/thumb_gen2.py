"""Cinco versiones de «Dos colores» (Dlx, 17/11: «el segundo tiene potencial… poner lo de la derecha en el medio y en la
derecha más cosas como más de 21000… da más ideas»). Mismo esqueleto: la carta a la izquierda, «Todos los niveles» al medio
en magenta, y a la derecha algo distinto en cada una. Usa HEAD/FOOT de thumb_gen.py."""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from thumb_gen import CARTA, DIR, FOOT, HEAD, DIAS  # noqa: E402

T = '#29B298'
BANDERAS = ['5ffbd522c5f6abe551ecad3dc13db13e', 'c48d76bb1875140fed906e50f7ade92b', 'e5f9870d99078ee710e755c5ce2f1317',
            'b3b06181d0c74f39dccac4222b7a966e', '7f0490d6514e4ff9279b2482f9ff125a', '90bb8125ec705791e17fa126020f8ecb',
            'c8328fc6cc0503cd573eb695949af629', '26992269d64418da7f36e2406e70e849', 'f7e4a28643555c58122c91b4316143ca',
            '8840ca6dd38b35ef35f4a4a3e9c02d67', '76d0ab7d53a90c550ef19cc4db5a27ec', '3519d0adb282d85ed59689476a0ae811']
ESCUDOS = ['482a44b6d809be61b4d0c55e80d6d95a', '8285ee47fc736ca0b266ed9d44d2f915', '06a27baa98aca4dba5f80030eab90b8b',
           'f6d37fc72495602f08ca3d9fc2c46e06', '2094b3ec62c582a4c3a26439b5122f4c', '52d93a95fb6b7bbe0ff9161bd3ca9af9',
           '44661ce2f31a4624d5e74c6c2bd3fc9d', 'e20853bc89c9ee0cda8f794d7060e244']

IZQ = f'''<span class="tag" style="position:absolute;left:40px;top:28px">DLX te invita</span>
<img class="carta" src="{CARTA}" alt="La carta de DLX" style="left:74px;top:116px;width:226px;transform:rotate(-4deg)">
<span class="bc" style="position:absolute;left:44px;bottom:26px;font-size:50px;line-height:1.02;color:#F6F6F6">Liga Global<br>de Freestyle</span>'''


def medio(arriba, abajo):
    return ('<div style="position:absolute;left:390px;top:0;bottom:0;width:410px;background:#E41373;display:flex;flex-direction:column;'
            'justify-content:center;padding:0 32px;gap:18px;color:#FFFFFF">%s%s</div>' % (arriba, abajo))


NIVELES = medio('<span class="h" style="font-size:76px;font-stretch:100%">Todos<br>los<br>niveles</span>',
                '<span class="bc" style="font-size:52px">Empiezas con<br>gente de tu nivel</span>')


def derecha(dentro, gap=22):
    return ('<div style="position:absolute;left:800px;top:0;bottom:0;width:400px;display:flex;flex-direction:column;justify-content:center;'
            'padding:0 32px;gap:%dpx">%s</div>' % (gap, dentro))


def num(n, txt, tam=96, color='#F6F6F6', gris='#C9C9C4'):
    return ('<div style="display:flex;flex-direction:column;gap:6px"><span class="h" style="font-size:%dpx;font-stretch:100%%;letter-spacing:-3px;color:%s">%s</span>'
            '<span class="bc" style="font-size:46px;color:%s">%s</span></div>' % (tam, color, n, gris, txt))


def barras(alto, ancho, gap):
    mx = max(DIAS)
    return ('<div style="display:flex;align-items:flex-end;gap:%dpx;height:%dpx">' % (gap, alto) +
            ''.join('<div style="width:%dpx;height:%dpx;background:%s"></div>' % (ancho, max(12, round(alto * n / mx)), '#E41373' if n == mx else T) for n in DIAS) +
            '</div>')


B = {}
B['ThCap1'] = ('4a · Niveles al medio, +40 y +21.000 a la derecha', f'''<div class="th">
{NIVELES}
{derecha(num('+40', 'torneos por semana', 112, T, '#F6F6F6') + num('+21.000', 'en servidores aliados', 80), 34)}
{IZQ}
</div>
''')
flags = ''.join('<img src="/_blob/%s" alt="" style="width:100%%;aspect-ratio:3/2;object-fit:cover;display:block;border-radius:2px">' % b for b in BANDERAS)
B['ThCap2'] = ('4b · Las banderas: más de 21.000 miembros', f'''<div class="th">
{medio('<span class="h" style="font-size:150px;font-stretch:100%;letter-spacing:-5px">+40</span><span class="bc" style="font-size:60px;margin-top:-8px">torneos<br>por semana</span>', '<span class="bc" style="font-size:52px;color:#030304;background:#F6F6F6;padding:8px 14px 10px;align-self:flex-start">Todos los niveles</span>')}
{derecha('<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">' + flags + '</div><div style="display:flex;flex-direction:column;gap:6px"><span class="bc" style="font-size:48px;color:#C9C9C4">Más de</span><span class="h" style="font-size:92px;font-stretch:100%;letter-spacing:-3px;color:' + T + '">21.000</span><span class="bc" style="font-size:56px;color:#F6F6F6">miembros</span></div>', 26)}
{IZQ}
</div>
''')
esc = ''.join('<img src="/_blob/%s" alt="" style="width:100%%;aspect-ratio:1;object-fit:contain;display:block">' % b for b in ESCUDOS)
B['ThCap3'] = ('4c · Los escudos: +21.000 en servidores aliados', f'''<div class="th">
{NIVELES}
{derecha('<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">' + esc + '</div>' + num('+21.000', 'en servidores aliados', 76, T, '#F6F6F6'), 30)}
{IZQ}
</div>
''')
B['ThCap4'] = ('4d · Hay torneo todos los días', f'''<div class="th">
{NIVELES}
{derecha('<span class="h" style="font-size:62px;font-stretch:100%;color:#F6F6F6">Hay torneo<br>todos<br>los días</span>' + barras(64, 36, 8) + '<span class="bc" style="font-size:52px;color:' + T + '">+40 por semana</span>', 26)}
{IZQ}
</div>
''')
B['ThCap5'] = ('4e · Tres datos a la derecha', f'''<div class="th">
{NIVELES}
{derecha(num('+40', 'torneos por semana', 78, T, '#F6F6F6') + num('+800', 'raperos activos', 78) + num('+21.000', 'en servidores aliados', 78), 18)}
{IZQ}
</div>
''')

if __name__ == '__main__':
    for k, (t, body) in B.items():
        io.open(os.path.join(DIR, k + '.dc.html'), 'w', encoding='utf-8').write(HEAD.format(titulo=t) + body + FOOT)
    print('ok', list(B))
