"""Las ocho miniaturas nuevas de Invita y gana, en el lienzo (scratchpad/thumb/project). Segunda vuelta, tras la crítica de
Impeccable: textos que se leen a 300 px (≥ 52 px casi todo), nada que venza («esta semana», «Temporada 1»), nada que
engañe («DLX VS TÚ», «Admite 1», «en los servidores» sin «aliados»), y la carta vacía con forma de carta."""
import io
import os

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'thumb', 'project')
CARTA = '/_blob/528561583fca9a949c5e3be3a2cfbe27'
HEAD = '''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>{titulo}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&amp;family=Barlow+Condensed:wght@600;700&amp;display=swap">
<style>
body{{margin:0}}
.th{{width:1200px;height:630px;position:relative;overflow:hidden;background:#030304;color:#F6F6F6;font-family:Archivo,system-ui,sans-serif}}
.th *{{box-sizing:border-box}}
.h{{font-family:Archivo,sans-serif;font-weight:900;font-stretch:125%;text-transform:uppercase;line-height:.88;margin:0}}
.tag{{display:inline-block;background:#E41373;color:#FFFFFF;font:700 54px/1 'Barlow Condensed',sans-serif;letter-spacing:2px;text-transform:uppercase;padding:8px 16px 10px}}
.tag.v{{background:#29B298;color:#030304}}
.bc{{font-family:'Barlow Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;line-height:1}}
.carta{{position:absolute;height:auto;filter:drop-shadow(0 18px 30px rgba(0,0,0,.6))}}
</style>
</helmet>
'''
FOOT = '''</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1200,"height":630}}'>
class Component extends DCLogic {
renderVals() {
return {};
}
}
</script>
</body>
</html>
'''
# los torneos de cada día de la última semana (calendario del lobby, 17/11/2026): ningún día sin torneo
DIAS = [5, 7, 9, 3, 10, 5, 3]
T = '#29B298'


def barras(alto, ancho=58, gap=14):
    mx = max(DIAS)
    return ('<div style="display:flex;align-items:flex-end;gap:%dpx;height:%dpx">' % (gap, alto) +
            ''.join('<div style="width:%dpx;height:%dpx;background:%s"></div>' % (ancho, max(14, round(alto * n / mx)), '#E41373' if n == mx else T) for n in DIAS) +
            '</div>')


def vacia(x_der, top, ancho, giro):
    """La carta del que llega: con forma de carta (número, foto, nombre, stats y tira), vacía"""
    alto = round(ancho / 0.685)
    foto = round(ancho * .56)
    rayas = ''.join('<i style="height:9px;background:#2C5A51;display:block"></i>' for _ in range(6))
    return f'''<div data-obj style="position:absolute;right:{x_der}px;top:{top}px;width:{ancho}px;height:{alto}px;border:5px solid {T};border-radius:4px;background:#0B1F1B;transform:rotate({giro}deg);box-shadow:0 18px 30px rgba(0,0,0,.6);overflow:hidden">
<span class="h" style="position:absolute;left:16px;top:14px;font-size:64px;font-stretch:100%;color:{T}">??</span>
<div style="position:absolute;left:50%;top:{round(alto * .2)}px;transform:translateX(-50%);width:{foto}px;height:{foto}px;border:4px dashed {T};border-radius:4px;display:flex;align-items:center;justify-content:center"><span class="h" style="font-size:60px;font-stretch:100%;color:{T}">TÚ</span></div>
<span class="bc" style="position:absolute;left:0;right:0;top:{round(alto * .64)}px;text-align:center;font-size:40px;color:#F6F6F6">Tu nombre</span>
<div style="position:absolute;left:22px;right:22px;top:{round(alto * .76)}px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px">{rayas}</div>
<div style="position:absolute;left:50%;bottom:16px;transform:translateX(-50%);width:{round(ancho * .5)}px;height:16px;border-radius:2px;background:#D9A93B"></div>
</div>
'''


B = {}
B['ThMonumento'] = ('1 · El nombre como monumento', f'''<div class="th">
<div class="h" style="position:absolute;left:-14px;bottom:-62px;font-size:500px;letter-spacing:-14px;color:#F6F6F6">DLX</div>
<div style="position:absolute;left:56px;top:44px;display:flex;flex-direction:column;align-items:flex-start;gap:14px">
<span class="tag">Te invita</span>
<span class="bc" style="font-size:58px;color:#F6F6F6">a la Liga Global de Freestyle</span>
<span class="bc" style="font-size:58px;color:{T}">+40 torneos por semana</span>
</div>
<img class="carta" src="{CARTA}" alt="La carta de DLX" style="right:50px;top:40px;width:300px;transform:rotate(5deg)">
</div>
''')
B['ThVs'] = ('2 · Tú vs +800 raperos', f'''<div class="th">
<div style="position:absolute;left:560px;top:0;bottom:0;right:0;background:#E41373;clip-path:polygon(14% 0,100% 0,100% 100%,0 100%)"></div>
<span class="tag" style="position:absolute;left:52px;top:40px">DLX te invita</span>
<img class="carta" src="{CARTA}" alt="La carta de DLX" style="left:64px;top:128px;width:300px;transform:rotate(-5deg)">
<div style="position:absolute;left:690px;top:64px;display:flex;flex-direction:column;align-items:flex-start;gap:10px">
<span class="h" style="font-size:150px;color:#FFFFFF">TÚ</span>
<span class="h" style="font-size:86px;color:#030304;background:#F6F6F6;padding:8px 18px 4px;transform:rotate(-4deg)">VS</span>
<span class="h" style="font-size:110px;font-stretch:100%;color:#FFFFFF">+800</span>
<span class="bc" style="font-size:60px;color:#FFFFFF">raperos activos</span>
</div>
</div>
''')
B['ThCartelera'] = ('3 · La cartelera', f'''<div class="th">
<div style="position:absolute;left:56px;top:40px;display:flex;flex-direction:column;align-items:flex-start;gap:4px">
<span class="tag">DLX te invita</span>
<span class="h" style="font-size:224px;letter-spacing:-8px;margin-top:8px">+40</span>
<span class="bc" style="font-size:72px">torneos por semana</span>
<span class="tag v" style="margin-top:12px">Todos los niveles</span>
</div>
<div style="position:absolute;left:640px;bottom:34px">{barras(70, 26, 8)}</div>
<img class="carta" src="{CARTA}" alt="La carta de DLX" style="right:56px;top:44px;width:330px;transform:rotate(4deg)">
</div>
''')
B['ThTodosLosDias'] = ('8 · Hay torneo todos los días', f'''<div class="th">
<div style="position:absolute;left:56px;top:40px;display:flex;flex-direction:column;align-items:flex-start;gap:18px">
<span class="tag">DLX te invita</span>
<span class="h" style="font-size:90px;font-stretch:100%">Hay torneo<br>todos<br>los días</span>
<span class="tag v">Todos los niveles</span>
</div>
<div style="position:absolute;left:60px;bottom:28px">{barras(56, 64, 12)}</div>
<img class="carta" src="{CARTA}" alt="La carta de DLX" style="right:50px;top:50px;width:310px;transform:rotate(4deg)">
</div>
''')
B['ThEntrada'] = ('4 · La entrada', f'''<div class="th">
<div style="position:absolute;left:66px;top:140px;width:1060px;height:400px;display:flex;transform:rotate(-2.5deg);filter:drop-shadow(0 18px 30px rgba(0,0,0,.6))">
<div style="flex:1 1 auto;background:#F6F6F6;color:#030304;border-radius:4px 0 0 4px;padding:30px 22px 26px 300px;display:flex;flex-direction:column;gap:14px;min-width:0">
<span class="bc" style="font-size:52px;color:#5E5E5A">Entrada · invita DLX</span>
<span class="h" style="font-size:55px;font-stretch:100%;white-space:nowrap">Liga Global<br>de Freestyle</span>
<span class="bc" style="font-size:50px;line-height:1.02;color:#E41373">+40 torneos<br>por semana</span>
</div>
<div style="width:290px;flex:none;background:#F6F6F6;color:#030304;border-left:6px dashed #A5A5A0;border-radius:0 4px 4px 0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px">
<span class="h" style="font-size:112px;font-stretch:100%;letter-spacing:-3px;color:#17705F">500</span>
<span class="bc" style="font-size:46px;text-align:center;color:#17705F">puntos para<br>la Tienda</span>
</div>
</div>
<img class="carta" src="{CARTA}" alt="La carta de DLX" style="left:40px;top:40px;width:262px;transform:rotate(-7deg)">
</div>
''')
B['ThCapitulos'] = ('5 · Dos colores, tres cosas', f'''<div class="th">
<div style="position:absolute;left:390px;top:0;bottom:0;width:410px;background:#E41373;display:flex;flex-direction:column;justify-content:center;padding:0 30px;gap:8px">
<span class="h" style="font-size:160px;font-stretch:100%;letter-spacing:-6px;color:#FFFFFF">+40</span>
<span class="bc" style="font-size:64px;color:#FFFFFF">torneos<br>por semana</span>
</div>
<div style="position:absolute;left:800px;top:0;bottom:0;width:400px;display:flex;flex-direction:column;justify-content:center;padding:0 34px;gap:18px">
<span class="h" style="font-size:66px;font-stretch:100%;color:{T}">Todos<br>los niveles</span>
<span class="bc" style="font-size:52px;color:#F6F6F6">Empiezas con<br>gente de tu nivel</span>
</div>
<span class="tag" style="position:absolute;left:40px;top:28px">DLX te invita</span>
<img class="carta" src="{CARTA}" alt="La carta de DLX" style="left:74px;top:116px;width:226px;transform:rotate(-4deg)">
<span class="bc" style="position:absolute;left:44px;bottom:26px;font-size:50px;line-height:1.02;color:#F6F6F6">Liga Global<br>de Freestyle</span>
</div>
''')
B['ThTuCarta'] = ('6 · Gana tu carta', f'''<div class="th">
<div style="position:absolute;left:56px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:22px">
<span class="tag">DLX te invita</span>
<span class="h" style="font-size:88px;font-stretch:112%;white-space:nowrap">Gana<br>tu carta</span>
<span class="bc" style="font-size:64px;color:{T}">+500 puntos<br>para la Tienda</span>
</div>
<img class="carta" src="{CARTA}" alt="La carta de DLX" style="right:322px;top:84px;width:262px;transform:rotate(-6deg)">
{vacia(50, 112, 262, 5)}
</div>
''')
FILAS = [('+40', 'torneos por semana'), ('+800', 'raperos activos'), ('+21.000', 'en servidores aliados')]
DATOS = ''.join('<div style="display:flex;align-items:center;gap:20px;height:122px;border-top:3px solid #2A2A2C">'
                '<span class="h" style="font-size:80px;font-stretch:100%%;letter-spacing:-3px;min-width:%dpx">%s</span>'
                '<span class="bc" style="font-size:52px;color:%s">%s</span></div>'
                % (330, n, '#F6F6F6' if i == 0 else '#C9C9C4', t) for i, (n, t) in enumerate(FILAS))
B['ThNumeros'] = ('7 · La Liga en números', f'''<div class="th">
<div style="position:absolute;left:56px;top:36px;display:flex;align-items:center;gap:18px">
<span class="tag">DLX te invita</span><span class="bc" style="font-size:54px">a la Liga Global de Freestyle</span>
</div>
<div style="position:absolute;left:56px;top:128px;width:880px;display:flex;flex-direction:column">{DATOS}</div>
<span class="tag v" style="position:absolute;left:56px;bottom:26px">Abierto a todos los niveles</span>
<img class="carta" src="{CARTA}" alt="La carta de DLX" style="right:26px;top:170px;width:230px;transform:rotate(4deg)">
</div>
''')

for k, (t, body) in B.items():
    io.open(os.path.join(DIR, k + '.dc.html'), 'w', encoding='utf-8').write(HEAD.format(titulo=t) + body + FOOT)
print('ok', list(B))
