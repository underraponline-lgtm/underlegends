# -*- coding: utf-8 -*-
"""🕶️ UNA VARIABLE QUE TAPA UNA FUNCIÓN: en una función, un nombre que se asigna Y se llama, y que es una función del módulo.

    python herramientas/sombras.py          lo que encuentre en bot/, sheet/, comun/ y herramientas/
    python herramientas/sombras.py --auto   lo mismo, y sale con 1 si hay alguno (lo corre CI)

🔴 14/10/2026: `armar()` de `bot/subir_web.py` hacía `_staff = _solo_rol(pool)` (la gente con rol, desde el 13/10) y más
abajo, en la MISMA función, `**_staff(x)` (el jurado, el host y el DJ de cada anuncio, la función del módulo). En Python
una asignación hace local el nombre en toda la función, así que `_staff(x)` llamaba a la lista: `TypeError: 'list'
object is not callable` cada vez que había un evento anunciado, y la web no se subía. Intermitente —sin anuncios esa
línea no corre— y ningún lint lo marca, porque la variable SÍ está asignada antes de usarse.

Lo que se busca: dentro de una función, un nombre que se ASIGNA, que se LLAMA (`nombre(...)`) y que también es una
función definida en el módulo. Es justo esa forma; un nombre que sólo se asigna (sin llamarlo) no rompe nada.
"""
import ast
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARPETAS = ('bot', 'sheet', 'comun', 'herramientas')


def sombras(src):
    """`[(función, nombre)]` del código `src`."""
    t = ast.parse(src)
    funcs = {n.name for n in t.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
    out = []
    for f in ast.walk(t):
        if not isinstance(f, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        # sólo lo de ESTA función: las funciones de adentro tienen su propio alcance
        propios = []
        pila = list(f.body)
        while pila:
            n = pila.pop()
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)):
                continue
            propios.append(n)
            pila.extend(ast.iter_child_nodes(n))
        asignados = {n.id for n in propios if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Store)}
        llamados = {n.func.id for n in propios if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)}
        globales = {x for n in propios if isinstance(n, (ast.Global, ast.Nonlocal)) for x in n.names}
        for nombre in sorted((asignados & llamados & funcs) - globales):
            out.append((f.name, nombre))
    return out


def _self_check():
    malo = 'def _staff(x):\n    return {}\n\ndef armar():\n    _staff = [1]\n    return _staff(2)\n'
    bien = 'def f():\n    return 1\n\ndef g():\n    x = f()\n    return x\n'
    adentro = 'def f():\n    return 1\n\ndef g():\n    def h():\n        f = 2\n        return f\n    return f()\n'
    ok = sombras(malo) == [('armar', '_staff')] and not sombras(bien) and not sombras(adentro)
    print('   %s la forma del 14/10 se encuentra, y lo que no rompe no' % ('✅' if ok else '🔴'))
    return ok


def main():
    auto = '--auto' in sys.argv
    ok = _self_check()
    hallados = []
    for c in CARPETAS:
        for raiz, _ds, fs in os.walk(os.path.join(BASE, c)):
            for nombre in fs:
                if not nombre.endswith('.py'):
                    continue
                ruta = os.path.join(raiz, nombre)
                try:
                    with open(ruta, encoding='utf-8') as f:
                        src = f.read()
                    for fn, x in sombras(src):
                        hallados.append('%s: en %s(), «%s» se asigna y se llama, y es una función del módulo'
                                        % (os.path.relpath(ruta, BASE), fn, x))
                except (SyntaxError, UnicodeDecodeError, OSError):
                    continue
    for h in hallados:
        print('   🔴 ' + h)
    if not hallados:
        print('   ✅ ninguna variable tapa una función')
    return 1 if auto and (hallados or not ok) else 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    raise SystemExit(main())
