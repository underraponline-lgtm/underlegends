"""LAS TRES OPCIONES DEL LADO, una al lado de la otra. Solo dos servidores.

Dlx: "mover un poco mas las cositas a la izquierda... o quizas tambien probar
a ver como se ve en el lado izquierdo todo eso".

⚠️ NO ES UNA PREGUNTA DE GUSTO SOLAMENTE, y conviene saberlo antes de mirar:
las otras dos cartas ya pusieron su numero a la IZQUIERDA —la Temporada en
left:20px, la Competitiva en left:8%— y la Servidor es la unica de las tres
que lo tiene a la derecha.

Se comparan dos servidores y no los diez porque lo que se decide es el
encuadre, y para eso alcanza con una foto que mire a un lado (TFC) y una que
mire al otro (SR).
"""
import base64
import os
import sys

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))

# (carpeta, titulo, nota)
OPS = [('_todos', 'A · derecha, como esta',
        'el numero a 20 px del borde'),
       ('_todos_aire', 'B · derecha, 6 px mas adentro',
        'lo que pidio Dlx: correr las cositas'),
       ('_todos_izq', 'C · izquierda',
        'como la Temporada y la Competitiva')]
MUESTRA = [(0, 'TFC'), (1, 'SR')]


def b64(p):
    return 'data:image/png;base64,' + base64.b64encode(open(p, 'rb').read()).decode()


def main():
    filas = ''
    for i, sv in MUESTRA:
        cel = ''
        for carp, tit, nota in OPS:
            f = os.path.join(SCR, carp, '%d.png' % i)
            if not os.path.exists(f):
                cel += f'<div class="g"><div class="gl">{tit}</div>falta</div>'
                continue
            cel += (f'<div class="g"><div class="gl">{tit}</div>'
                    f'<img src="{b64(f)}"><div class="gs">{nota}</div></div>')
        filas += f'<h2>{sv}</h2><div class="fila">{cel}</div>'

    html = f"""<meta charset="utf-8"><style>
body{{background:#0A0A10;margin:0;padding:26px;font-family:system-ui,sans-serif}}
h1{{color:#EDEDF5;font-size:15px;letter-spacing:1.3px;margin:0 0 6px}}
h2{{color:#8A8AA0;font-size:12px;letter-spacing:1.6px;margin:22px 0 8px}}
p{{color:#8A8AA0;font-size:12.5px;max-width:1180px;line-height:1.55;margin:0 0 4px}}
b{{color:#C98A4B}}
.fila{{display:flex;gap:16px}}
.g{{text-align:center;width:300px}}
.gl{{color:#EDEDF5;font-size:11px;font-weight:800;letter-spacing:1px;
     margin-bottom:7px}}
.gs{{color:#7A7A90;font-size:10.5px;margin-top:6px;line-height:1.45}}
img{{width:300px;display:block}}
</style>
<h1>EL LADO DE LA COLUMNA — TRES OPCIONES</h1>
<p><b>&#9888;</b> Esto no lo decide solo el gusto: la <b>Temporada</b> pone su
bloque de OVR en <b>left:20px</b> y la <b>Competitiva</b> en <b>left:8%</b>.
La Servidor es la <b>unica de las tres</b> con el numero a la derecha.</p>
<p>El escudo de arriba y su estrella subieron 0.5 px en las tres (BAJA 6 &rarr;
5.5). La estrella se apoya en la tapa del escudo, asi que sube sola.</p>
{filas}"""
    p = os.path.join(SCR, '_lado3.html')
    open(p, 'w', encoding='utf-8').write(html)
    print(p)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
