# -*- coding: utf-8 -*-
"""QUE SCRIPTS SE CAEN AL IMPRIMIR UN AVISO EN LA CONSOLA DE WINDOWS.

    python herramientas/revienta_en_consola.py           los lista
    python herramientas/revienta_en_consola.py --aplicar les pone el arreglo

🔴 UN SELF-CHECK QUE REVIENTA JUSTO CUANDO ENCUENTRA ALGO ES PEOR QUE NO
TENERLO. `comun/brillo.py` imprime todas sus tablas bien y muere en la linea
156, que es donde dice «⚠️ acento SIN COLOR en N de M». O sea: **cuando no hay
nada que reportar pasa, y cuando hay algo se cae**. Eso se lee como «el script
esta roto» en vez de «encontro un problema», y es exactamente al reves.

La causa es que la consola de Windows usa **cp1252** y Python le manda el
emoji tal cual. `sys.stdout.reconfigure(encoding='utf-8', errors='replace')`
lo arregla, y la mitad del proyecto ya lo tiene — es la otra mitad la que
hereda el bug.

⚠️ SE BUSCA LA CADENA NO-ASCII EN EL FUENTE, no se ejecuta nada. Ejecutar cada
script para ver si revienta significaria dibujar cartas y pegarle a Discord.
"""
import io
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)

ARREGLO = """try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass
"""

SALTAR = ('__pycache__', 'node_modules', '.git')


def _no_entra(c):
    """¿La consola de Windows NO puede escribir este caracter?"""
    try:
        c.encode('cp1252')
        return False
    except UnicodeEncodeError:
        return True


def archivos():
    for raiz, dirs, fs in os.walk(BASE):
        dirs[:] = [d for d in dirs if d not in SALTAR]
        for f in fs:
            if f.endswith('.py'):
                yield os.path.join(raiz, f)


def main():
    riesgo = []
    for p in archivos():
        s = io.open(p, encoding='utf-8').read()
        if 'reconfigure' in s:
            continue
        # sólo importa lo que va a stdout: un no-ASCII en un comentario o en
        # un docstring no imprime nada.
        malas = []
        for n, l in enumerate(s.split('\n'), 1):
            if 'print(' not in l and "print (" not in l:
                continue
            # 🔴 «NO ASCII» ES EL CRITERIO EQUIVOCADO Y DA 16 FALSOS. `·`, `ñ`,
            # `ó` y `á` ESTAN en cp1252: se imprimen sin problema y por eso
            # medio proyecto funciona sin el arreglo. Lo que revienta es lo
            # que cp1252 **no puede codificar** — los emoji. Se le pregunta al
            # codec en vez de adivinar con un rango.
            rotos = [c for c in l if _no_entra(c)]
            if rotos:
                malas.append((n, l.strip()[:66], ''.join(sorted(set(rotos)))))
        if malas:
            riesgo.append((p, malas))

    print('\n%d archivo(s) que pueden reventar al imprimir un aviso\n' % len(riesgo))
    for p, malas in sorted(riesgo):
        print('  %s   (%d línea(s))' % (os.path.relpath(p, BASE), len(malas)))
        for n, l, rotos in malas[:2]:
            print('      %4d  %s      [%s]' % (n, l, rotos))

    if '--aplicar' not in sys.argv:
        print('\n  (no toqué nada — corré con --aplicar)\n')
        return

    hechos = 0
    for p, _ in riesgo:
        s = io.open(p, encoding='utf-8').read()
        # ⚠️ VA DESPUES DEL ULTIMO IMPORT DE ARRIBA, no al principio: antes de
        # `import sys` no existe `sys`, y arriba del docstring rompe el modulo.
        if not re.search(r'^import sys$', s, re.M):
            s = re.sub(r'(^import os$)', r'\1\nimport sys', s, count=1, flags=re.M)
            if not re.search(r'^import sys$', s, re.M):
                print('  ⚠️ %s: no supe dónde poner `import sys`'
                      % os.path.relpath(p, BASE))
                continue
        m = list(re.finditer(r'^(?:import|from) .+$', s, re.M))
        if not m:
            continue
        i = m[-1].end()
        s = s[:i] + '\n\n' + ARREGLO.rstrip() + s[i:]
        io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
        hechos += 1
    print('\n  ✅ %d arreglado(s)\n' % hechos)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
