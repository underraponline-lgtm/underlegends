"""¿Cada paso del tutorial apunta a algo que existe?

    python herramientas/tuto_marcas.py           # lo dice
    python herramientas/tuto_marcas.py --auto    # igual, para CI (rojo si falta una)

🧭 EL TUTORIAL SEÑALA PIEZAS POR SU `data-tuto` (13/11/2026, ver `web/src/capitulos.js`). El de antes buscaba los links
del menú por su `href`, y cuando el menú pasó a tener listas tres de sus cuatro pasos dejaron de encontrar nada SIN QUE
NADA FALLARA: la caja salía flotando al medio de la pantalla. Eso es lo que esto evita: si alguien rehace una página y
se lleva puesta la marca, CI se pone rojo en vez de que el tutorial se rompa callado.

Mira el código, no la página: una pieza que se dibuja sólo para algunos (la de Premium, la de quien tiene crew) también
cuenta, porque para los demás el paso sale al centro, que es lo previsto. Las marcas del menú se arman con el nombre de
cada sección (`'menu-' + …` en arriba.jsx y abajo.jsx): `menu-<x>` vale si `#/<x>` está en el menú.
"""
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SRC = RAIZ / 'web' / 'src'


def pasos():
    """Los `sel` de capitulos.js (sin los vacíos: ésos van al centro a propósito)"""
    t = (SRC / 'capitulos.js').read_text(encoding='utf-8')
    return sorted({m for m in re.findall(r"sel: '([a-z0-9-]*)'", t) if m})


def marcas():
    """Las marcas fijas (`data-tuto="x"`) de toda la página, y si existen las armadas del menú"""
    fijas, menu = set(), False
    for p in SRC.rglob('*.jsx'):
        t = p.read_text(encoding='utf-8')
        fijas |= set(re.findall(r'data-tuto="([a-z0-9-]+)"', t))
        if "data-tuto={'menu-' +" in t:
            menu = True
    return fijas, menu


def secciones_menu():
    """Las rutas del menú de arriba (GRUPOS de arriba.jsx)"""
    t = (SRC / 'arriba.jsx').read_text(encoding='utf-8')
    return set(re.findall(r"'#/([a-z]+)'", t))


def revisar():
    fijas, menu = marcas()
    rutas = secciones_menu()
    faltan = []
    for s in pasos():
        if s.startswith('menu-'):
            if not (menu and s[5:] in rutas):
                faltan.append(s)
        elif s not in fijas:
            faltan.append(s)
    return faltan, len(pasos())


def _self_check():
    # el lector de pasos tiene que ver los del corto y los de los capítulos
    ps = pasos()
    assert 'historias' in ps and 'menu-ranking' in ps and 'ps-pista' in ps, ps
    assert len(ps) >= 20, len(ps)


if __name__ == '__main__':
    _self_check()
    faltan, n = revisar()
    if faltan:
        print(f'❌ {len(faltan)} de {n} pasos del tutorial apuntan a una marca que no está en ninguna página:')
        for s in faltan:
            print(f'   · data-tuto="{s}"')
        print('   Ponle la marca a la pieza nueva, o cambia el paso en web/src/capitulos.js.')
        sys.exit(1)
    print(f'✅ los {n} pasos del tutorial apuntan a algo que existe')
