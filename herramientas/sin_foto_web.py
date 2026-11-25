# -*- coding: utf-8 -*-
"""🎤 LAS SILUETAS DE «SIN FOTO», PARA LA PÁGINA.

    python herramientas/sin_foto_web.py          escribe bot/paginas/sin_foto/<n>.svg
    python herramientas/sin_foto_web.py --auto   el chequeo de CI: que estén al día y que la página elija igual

🔑 Dlx, 25/11/2026: *«asegurate que en el ranking global hayan imagenes de todos»*. La página dibuja la silueta de rapero
de las cartas (`comun/sin_foto.py`, la que eligió Dlx el 04/10/2026) para quien no tiene foto, y la elige con
`figuraDe()` de `web/src/sin_foto.js`, que tiene que dar LO MISMO que `comun/sin_foto.cual()`: así tu cara en la página es
la de tu carta.

⚠️ ESTO VIVE EN `herramientas/` Y NO EN `comun/sin_foto.py` A PROPÓSITO: `comun/` entera entra en la huella de las cuatro
cartas (`comun/huella_codigo.py`), y agregarle una función redibujaba todas sin cambiarles un píxel.
"""
import io
import json
import os
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)

from comun import sin_foto  # noqa: E402

CARPETA = os.path.join(BASE, 'bot', 'paginas', 'sin_foto')
JS = os.path.join(BASE, 'web', 'src', 'sin_foto.js')
# nombres con lo que puede romper la cuenta: tildes, eñes, banderas, otro alfabeto, números, vacío
MUESTRA = ['Konan', 'Ñoño', 'Ánà 🇦🇷', 'Oasis', 'TøKīØ🦠🧠', 'Mc Glock 🇲🇽', '1Tobi', 'Валера', '水', '', '   ', 'DOBLE J',
           'kaiser🇵🇷', 'Snow', 'Gazir', 'El Menor', 'x' * 300]


def archivos():
    """`{nombre del archivo: svg}`: una por figura."""
    return {'%d.svg' % i: sin_foto.svg(i) for i in range(len(sin_foto.FIGURAS))}


def escribir():
    os.makedirs(CARPETA, exist_ok=True)
    for n, s in archivos().items():
        with io.open(os.path.join(CARPETA, n), 'w', encoding='utf-8', newline='\n') as f:
            f.write(s)
    print('✅ %d siluetas en %s' % (len(sin_foto.FIGURAS), os.path.relpath(CARPETA, BASE)))


def _js(nombres):
    """Lo que elige la página para cada nombre (con node, el mismo archivo que usa la página)."""
    url = 'file:///' + JS.replace('\\', '/').lstrip('/')
    prog = ('import(%s).then((m) => { const ns = JSON.parse(process.argv[1]); '
            'console.log(JSON.stringify({ n: m.N_FIGURAS, f: ns.map(m.figuraDe) })); })' % json.dumps(url))
    r = subprocess.run(['node', '--input-type=module', '-e', prog, json.dumps(nombres, ensure_ascii=False)],
                       capture_output=True, text=True, encoding='utf-8')
    if r.returncode:
        raise RuntimeError(r.stderr.strip()[-300:])
    return json.loads(r.stdout)


def auto():
    mal = []
    for n, s in archivos().items():
        p = os.path.join(CARPETA, n)
        try:
            ya = io.open(p, encoding='utf-8').read()
        except OSError:
            ya = None
        if ya != s:
            mal.append('%s no está al día: python herramientas/sin_foto_web.py' % os.path.relpath(p, BASE))
    try:
        j = _js(MUESTRA)
        if j['n'] != len(sin_foto.FIGURAS):
            mal.append('N_FIGURAS de web/src/sin_foto.js es %d y comun/sin_foto.py tiene %d' % (j['n'], len(sin_foto.FIGURAS)))
        py = [sin_foto.cual(x) for x in MUESTRA]
        dif = [(x, a, b) for x, a, b in zip(MUESTRA, py, j['f']) if a != b]
        if dif:
            mal.append('la página elige otra figura que la carta: %r' % dif[:5])
    except Exception as e:                               # noqa: BLE001
        mal.append('no pude correr web/src/sin_foto.js con node: %s' % e)
    for m in mal:
        print('  ❌ ' + m)
    print('✅ sin_foto_web: las %d siluetas al día y la página elige como la carta' % len(sin_foto.FIGURAS) if not mal
          else '❌ sin_foto_web: %d mal' % len(mal))
    return 1 if mal else 0


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if '--auto' in sys.argv:
        sys.exit(auto())
    escribir()
