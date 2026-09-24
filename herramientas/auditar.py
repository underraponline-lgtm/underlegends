"""BUSCAR EN TODO EL REPO LOS ERRORES QUE ESTE PROYECTO YA SE COMIO.

    python herramientas/auditar.py

⚠️ NO BUSCA ERRORES EN GENERAL: BUSCA LAS TRES FORMAS QUE YA PASARON, cada
una mas de una vez. Lo que las une es que **ninguna falla**: sale una carta
valida y distinta de la decidida, o sale sin una pieza, y nadie se entera.

  1. UNA RUTA A UNA CARPETA QUE NO EXISTE. `procesar_logos.py` escribia en
     `herramientas/logos_sv/` —que no existe— asi que regenerar las siluetas
     no llegaba a ninguna carta. `gencomp.py` buscaba los iconos de evento en
     `02_Competitivo/logos_sv/`, tambien inexistente, y de cinco eventos
     dibujaba uno, con un `continue` mudo.

  2. `av.startswith('http')` PARA DECIDIR FOTO-O-INICIAL. Tira el `data:` URI
     del respaldo en silencio: la foto esta en disco y la carta dibuja la
     inicial. Estaba en TRES archivos; `CLAUDE.md` daba por arreglado uno
     solo, y eso tapo los otros dos hasta el 17/09/2026.

  3. UN `except` O UN `continue` QUE SE TRAGA EL MOTIVO. Es lo que convierte
     las dos de arriba en invisibles.

⚠️ Y AVISA, NO ARREGLA. Varias de estas lineas son correctas en su contexto:
lo que hace falta es mirarlas, no borrarlas.
"""
import ast
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)

SALTAR = ('.git', 'node_modules', '__pycache__', 'salida', 'versiones')

# Carpetas de recursos que el codigo nombra por su nombre.
RECURSOS = ('logos_sv', 'escudos_cuad', '_avatares', 'estilos', 'banderas',
            'banderas_carta', 'fonts', 'logos_color', 'logos_originales')
RUTA = re.compile(r"""['"]([\w./\\-]*(?:%s)[\w./\\-]*)['"]""" % '|'.join(RECURSOS))


def pys():
    for raiz, dirs, files in os.walk(BASE):
        dirs[:] = [d for d in dirs if d not in SALTAR]
        for f in files:
            if f.endswith('.py'):
                yield os.path.join(raiz, f)


def rel(p):
    return os.path.relpath(p, BASE)


def rutas_muertas():
    print('\n1. RUTAS A CARPETAS DE RECURSOS QUE NO EXISTEN\n')
    # ⚠️ SOLO CADENAS DE CODIGO, VIA AST. Con un regex sobre el texto crudo
    # esto se encontraba a si mismo: `gencomp.py` tiene 'logos_sv/sv_tfc.png'
    # DENTRO DEL COMENTARIO que explica que esa ruta estaba muerta y ya se
    # arreglo. Un auditor que marca la documentacion del arreglo como si fuera
    # el error enseña a ignorarlo.
    vistos = {}
    for p in pys():
        try:
            arbol = ast.parse(open(p, encoding='utf-8').read(), filename=p)
        except Exception:
            continue
        for nodo in ast.walk(arbol):
            if not (isinstance(nodo, ast.Constant) and isinstance(nodo.value, str)):
                continue
            r = nodo.value
            if not RUTA.search("'%s'" % r):
                continue
            if r.startswith('http') or '%' in r or '{' in r or '\n' in r:
                continue
            # ⚠️ UN NOMBRE SUELTO NO ES UNA RUTA. `os.path.join(BASE, 'comun',
            # 'escudos_cuad', x)` pasa 'escudos_cuad' como UN TROZO, y marcarlo
            # como ruta muerta es ruido: la ruta de verdad se arma en tiempo de
            # ejecucion y esto no la ve. Solo valen las que ya traen separador.
            if '/' not in r and '\\' not in r:
                continue
            vistos.setdefault(r, set()).add(p)
    malas = []
    for r, quienes in sorted(vistos.items()):
        # vale si existe desde la raiz o desde la carpeta de cualquiera que la nombre
        ok = os.path.exists(os.path.join(BASE, r))
        for q in quienes:
            ok = ok or os.path.exists(os.path.join(os.path.dirname(q), r))
        if not ok:
            malas.append((r, sorted(rel(x) for x in quienes)))
    print('   %d rutas literales · %d no existen desde ningun lado'
          % (len(vistos), len(malas)))
    for r, q in malas:
        print('   ⚠️ %-38s  <- %s' % (r, ', '.join(q)[:70]))
    return len(malas)


def foto_http():
    print('\n2. DECIDIR FOTO-O-INICIAL CON startswith("http")\n')
    n = 0
    for p in pys():
        try:
            lineas = open(p, encoding='utf-8').read().splitlines()
        except Exception:
            continue
        # ⚠️ SOLO CODIGO, NO COMENTARIOS. La primera version conto 11 y ocho
        # eran texto — incluidos los comentarios que explican el bug y el
        # docstring de esta misma funcion. Un detector que se encuentra a si
        # mismo entrena a ignorarlo.
        try:
            arbol = ast.parse('\n'.join(lineas))
        except SyntaxError:
            continue
        codigo = set()
        for nodo in ast.walk(arbol):
            if isinstance(nodo, ast.Attribute) and nodo.attr == 'startswith':
                codigo.add(nodo.lineno)
        for i, l in enumerate(lineas, 1):
            if i not in codigo:
                continue
            if "startswith('http')" not in l and 'startswith("http")' not in l:
                continue
            # las que deciden si DIBUJAR algo, no las que leen un pool
            contexto = ' '.join(lineas[max(0, i-4):i+2])
            if not re.search(r'\bini\b|initials|<img|foto', contexto):
                continue
            n += 1
            print('   ⚠️ %s:%d' % (rel(p), i))
            print('      %s' % l.strip()[:88])
    if not n:
        print('   ninguna: las tres pasan por comun/respaldo.hay_foto()')
    return n


def silencios():
    print('\n3. EXCEPCIONES Y `continue` QUE NO DICEN POR QUE\n')
    graves = []
    for p in pys():
        try:
            arbol = ast.parse(open(p, encoding='utf-8').read(), filename=p)
        except Exception:
            continue
        for nodo in ast.walk(arbol):
            if not isinstance(nodo, ast.ExceptHandler):
                continue
            # un except cuyo cuerpo es solo pass/continue y no tiene comentario
            cuerpo = nodo.body
            mudo = all(isinstance(x, (ast.Pass, ast.Continue)) for x in cuerpo)
            if mudo and nodo.type is None:          # except: pelado
                graves.append((rel(p), nodo.lineno, 'except: pelado y mudo'))
    print('   %d except pelados y mudos' % len(graves))
    for f, l, q in graves[:10]:
        print('   ⚠️ %s:%d  %s' % (f, l, q))
    return len(graves)


def duplicados():
    print('\n4. EL MISMO ARCHIVO EN DOS LUGARES\n')
    import hashlib
    from collections import defaultdict
    por = defaultdict(list)
    for raiz, dirs, files in os.walk(BASE):
        dirs[:] = [d for d in dirs if d not in SALTAR]
        for f in files:
            if not f.lower().endswith(('.png', '.css', '.json', '.svg', '.woff2')):
                continue
            p = os.path.join(raiz, f)
            try:
                if os.path.getsize(p) < 4096:
                    continue
                h = hashlib.md5(open(p, 'rb').read()).hexdigest()
            except Exception:
                continue
            por[h].append(rel(p))
    reps = [v for v in por.values() if len(v) > 1]
    gastado = 0
    for v in reps:
        try:
            gastado += os.path.getsize(os.path.join(BASE, v[0])) * (len(v) - 1)
        except Exception:
            pass
    print('   %d archivo(s) con copia exacta en otro lado  ·  %.1f MB de mas'
          % (len(reps), gastado / 1024 / 1024))
    for v in sorted(reps, key=lambda x: -len(x))[:8]:
        print('   ⚠️ %s' % ('  ==  '.join(v)[:100]))
    return len(reps)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    total = rutas_muertas() + foto_http() + silencios() + duplicados()
    print('\n%s\n' % ('nada que mirar' if not total
                      else '%d cosa(s) para mirar — ninguna falla sola' % total))
