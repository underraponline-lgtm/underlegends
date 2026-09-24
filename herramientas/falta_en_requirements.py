# -*- coding: utf-8 -*-
"""QUE IMPORTA EL CAMINO VIVO QUE `requirements.txt` NO DECLARA.

    python herramientas/falta_en_requirements.py

🔴 POR QUE EXISTE. `numpy` faltaba y **tiraba dos de las cuatro cartas**
en Actions: los exportadores de la Competitiva y la de Pais lo usan, y en
la maquina donde se escribio el proyecto vino instalado con otra cosa. Un
`pip install -r requirements.txt` que anda donde ya estaba todo no dice
nada sobre una maquina vacia, y el fallo aparece recien cuando el runner
intenta dibujar — o sea despues de bajar Chromium, leer el Sheet y las
443 fotos.

⚠️ SE SIGUEN LOS IMPORTS, NO SE LEE UNA CARPETA. La pregunta no es «que
importa el repo» —`herramientas/` y `03_Servidor/disenos/` importan cosas
que el ciclo nunca toca, y declararlas seria hacer que el job instale de
mas— sino **que importa lo que el ciclo corre**. Se arranca por los
puntos de entrada del pipeline y se sigue la cadena.

⚠️ Y LO QUE NO RESUELVE: un import adentro de un `try` que degrada solo, o
uno que se arma con `importlib`. Los dos son raros aca y los dos fallan
hacia avisar de mas, que es el lado barato.
"""
import ast
import io
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

# lo que el ciclo corre de verdad, en orden de aparicion
ENTRADAS = (
    'bot/pipeline.py',
    'bot/que_cambio.py',
    'bot/fotos.py',
    'bot/subir_cartas.py',
    'bot/subir_datos.py',
    'sheet/construir_pool_temporada.py',
    'sheet/construir_pool_competitivo.py',
    'sheet/pendientes.py',
    'sheet/webapp_rangos.py',
    'sheet/autorizar.py',
    '01_Temporada/exportar_png.py',
    '02_Competitivo/exportar_png.py',
    '03_Servidor/generar.py',
    '04_Pais/exportar_png.py',
)

# el paquete que hay que instalar no siempre se llama como el modulo
PAQUETE = {
    'google': 'google-auth',
    'google_auth_oauthlib': 'google-auth-oauthlib',
    'PIL': 'pillow',
    'yaml': 'pyyaml',
    'dateutil': 'python-dateutil',
}


def _imports(ruta):
    try:
        arbol = ast.parse(io.open(ruta, encoding='utf-8').read())
    except (OSError, SyntaxError):
        return set()
    out = set()
    for n in ast.walk(arbol):
        if isinstance(n, ast.Import):
            out |= {a.name.split('.')[0] for a in n.names}
        elif isinstance(n, ast.ImportFrom) and n.module and not n.level:
            out.add(n.module.split('.')[0])
    return out


# ⚠️ LAS CARPETAS QUE LOS SCRIPTS SE METEN EN `sys.path`. No alcanza con
# mirar al lado del archivo: `bot/subir_datos.py` importa
# `construir_padron`, que vive en `sheet/`, porque antes hace
# `sys.path.insert`. Sin esto la herramienta lo daba por paquete de PyPI
# y pedia instalar `construir_padron`, que no existe.
EN_RUTA = ('', 'bot', 'sheet', 'comun', 'herramientas',
           os.path.join('03_Servidor', 'disenos'))


def _resolver(mod, desde):
    """La ruta del .py de ese modulo si es del repo. None si es de afuera."""
    cands = [os.path.join(os.path.dirname(desde), mod + '.py')]
    for carp in EN_RUTA:
        cands.append(os.path.join(BASE, carp, mod + '.py'))
    cands.append(os.path.join(BASE, mod, '__init__.py'))
    for c in cands:
        if os.path.exists(c):
            return c
    # ⚠️ UNA CARPETA SIN `__init__.py` TAMBIEN ES DEL REPO. `comun/` es un
    # paquete de espacio de nombres —Python 3 no le pide `__init__.py`— y
    # sin esta linea la herramienta pedia instalar `comun` desde PyPI.
    if os.path.isdir(os.path.join(BASE, mod)):
        return os.path.join(BASE, mod)
    return None


def recorrer():
    """(modulos de afuera, archivos del repo que se tocan)."""
    pila = [os.path.join(BASE, e) for e in ENTRADAS if
            os.path.exists(os.path.join(BASE, e))]
    visto, fuera = set(), {}
    while pila:
        p = pila.pop()
        if p in visto or os.path.isdir(p):
            continue
        visto.add(p)
        for m in _imports(p):
            if m in sys.stdlib_module_names or m.startswith('_'):
                continue
            q = _resolver(m, p)
            if q:
                pila.append(q)
            else:
                fuera.setdefault(m, set()).add(
                    os.path.relpath(p, BASE).replace('\\', '/'))
    return fuera, visto


def declarados():
    p = os.path.join(BASE, 'requirements.txt')
    out = set()
    for l in io.open(p, encoding='utf-8'):
        l = l.split('#')[0].strip()
        if l:
            out.add(l.split('==')[0].split('>=')[0].split('[')[0]
                    .strip().lower())
    return out


def main():
    print('\n══ LO QUE EL CICLO IMPORTA Y NO ESTÁ DECLARADO ══\n')
    fuera, tocados = recorrer()
    tengo = declarados()
    print('   %d archivo(s) del repo en el camino vivo' % len(tocados))
    print('   %d paquete(s) de afuera\n' % len(fuera))

    faltan = []
    for mod in sorted(fuera):
        paq = PAQUETE.get(mod, mod).lower()
        ok = paq in tengo
        if not ok:
            faltan.append((mod, paq, sorted(fuera[mod])))
        print('   %s %-24s %s' % ('✅' if ok else '🔴', mod,
                                  '' if ok else '→ falta `%s`' % paq))
    if faltan:
        print('\n   🔴 %d sin declarar. Quién lo pide:' % len(faltan))
        for mod, paq, quien in faltan:
            print('      %-16s %s' % (mod, ', '.join(quien[:3])))
        print('\n   Agregalos a requirements.txt.\n')
        return 1

    # ⚠️ AL REVES TAMBIEN, pero sin fallar: declarar de mas solo cuesta
    # segundos de instalacion, y puede ser a proposito.
    pedidos = {PAQUETE.get(m, m).lower() for m in fuera}
    sobran = sorted(tengo - pedidos)
    if sobran:
        print('\n   ⚠️ declarado y no importado por el ciclo: %s'
              % ', '.join(sobran))
        print('      (no es un error: puede ser para correr algo a mano)')
    print('\n   ✅ no falta ninguno\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
