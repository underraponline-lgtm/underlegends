# -*- coding: utf-8 -*-
"""LA HUELLA DEL CODIGO QUE DIBUJA CADA CARTA.

    python comun/huella_codigo.py          las cuatro huellas y que mira
    python comun/huella_codigo.py --que    la lista de archivos, por carta

🔴 POR QUE EXISTE: EL SELLO MIRABA LOS DATOS Y NO EL CODIGO.

`bot/que_cambio.py` decide que redibujar comparando **los datos** de
cada persona contra el sello. Eso deja afuera la mitad del problema: si
cambia el codigo que dibuja, los datos son identicos y **no se redibuja
nada**. La carta se queda vieja en silencio y el ciclo informa «nada
cambio» todos los dias.

⚠️ NO ES HIPOTETICO, YA PASO Y ESTA DOCUMENTADO. `CLAUDE.md` cuenta que
la Competitiva *«tenia las fotos y dibujaba la inicial en 93 de 112»*:
ese arreglo fue un cambio de codigo puro —`gencomp.py` pasando a
preguntarle al respaldo— con **cero cambios en el pool**. Con el sello
de hoy, esas 112 cartas se hubieran quedado con la inicial para
siempre. Lo mismo el arreglo del emoji y el de los avatares.

⚠️ Y `mapa_viejo()` NO LO CUBRIA, por dos razones. Avisa —imprime— pero
no redibuja; y compara **mtime**, que un `git checkout` reescribe, asi
que en Actions, donde todos los archivos nacen con la hora del
checkout, no detecta nada nunca.

QUE SE MIRA, Y POR QUE TANTO
-----------------------------
Cada carta mira **su carpeta y `comun/` entera**, los `.py` y los
`.css`. Lo primero es obvio; lo segundo es la decision.

⚠️ SE PENSO EN SEGUIR EL GRAFO DE IMPORTS —para que tocar
`comun/emblema.py`, que solo usa la Servidor, no redibuje la Temporada—
y se descarto. Un grafo al que le falta una arista hace que una carta
**no** se redibuje, que es la direccion peligrosa del error; `comun/`
entera falla hacia redibujar de mas. Es la misma regla que ya tiene
escrita `que_cambio.huellas()`: *«se redibuja de mas antes que de
menos»*.

Y el costo esta medido, no estimado. Sobre los ultimos **89 commits**
del repo, esto hubiera disparado en **9** — y los nueve son cambios
reales al dibujo, incluidos los tres casos de arriba.

POR QUE POR AST Y NO POR BYTES
-------------------------------
Este proyecto escribe comentarios y docstrings enormes: un hash crudo
del archivo dispararia un redibujo de 138 cartas cada vez que se
corrige una redaccion. `ast.dump()` de un arbol **sin docstrings** no
ve comentarios ni docstrings ni formato — solo cambia cuando cambia lo
que el programa hace.

Medido sobre los mismos 89 commits: por bytes hubieran sido 10 disparos
y por AST son 9. El que se ahorra es `ac46bef`, un barrido de
comentarios — o sea **138 cartas que no se redibujan al gusto**.

⚠️ `ast.dump` PUEDE CAMBIAR ENTRE VERSIONES DE PYTHON, y entonces las
cuatro huellas cambian de golpe y se redibuja todo una vez. Es caro y
es raro, y sobre todo **falla hacia el lado seguro**: redibuja de mas.
Atarlo a la version de Python para evitarlo abriria el caso contrario
—Python cambia Y el codigo cambia, y el cambio real se pierde— que es
el error que este archivo existe para cerrar.

AGREGAR UN SELF-CHECK A UN MODULO DE `comun/` CUESTA 552 REDIBUJOS
-------------------------------------------------------------------
🔴 **Pasó el 21/09/2026 y se decidió pagarlo.** Se le agregaron
`_self_check()` a `crews`, `escudos`, `requisitos` y `temporada` —cuatro
modulos de `comun/`— y nada mas: ninguna funcion de dibujo cambio.
Verificado con el diff. Aun asi las cuatro huellas se movieron y el
ciclo marco **552 cartas, ~235 min de Actions**, para producir cartas
**identicas pixel a pixel**.

⚠️ **SE PENSO EXCLUIR LOS CHEQUEOS Y SE DESCARTO, por dos razones que
conviene no volver a recorrer:**

1. **Habria que excluir por una lista de nombres a mano**, que es
   justo lo que el comentario de mas abajo dice que NO se hace: la
   auto-exclusion de este archivo funciona porque sale de `__file__`,
   no de una lista que alguien tiene que mantener correcta para
   siempre.
2. 🔴 **Y `verificar()` SI esta en el camino del dibujo.**
   `03_Servidor/disenos/todos_sv.py:61` —el motor de layout vivo de la
   Servidor— hace `RG.verificar()` **al importarse**. O sea que un
   nombre que suena a «solo un chequeo» decide si esa carta se dibuja
   o revienta. Una lista de nombres «que no dibujan» lo habria dejado
   afuera, y ese es exactamente el error que no se puede cometer.

Excluir el bloque `if __name__ == '__main__':` si seria estructural y
seguro —por definicion no corre cuando un generador importa— pero **no
alcanza**: lo que mueve la huella son las `def` de nivel de modulo, no
el bloque.

Asi que el costo se paga. Es raro —endurecer un modulo de `comun/` no
pasa todos los dias—, es **una vez** por tanda de cambios, y falla
hacia el lado seguro. Lo que no hay que hacer es sorprenderse: si
despues de tocar `comun/` el ciclo dice «le toca a todo el pool», esto
es por que.
"""
import ast
import hashlib
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

# carta -> las carpetas cuyo codigo la dibuja
CARPETAS = {
    'temporada':   ('01_Temporada', 'comun'),
    'competitivo': ('02_Competitivo', 'comun'),
    'servidor':    ('03_Servidor', 'comun'),
    'pais':        ('04_Pais', 'comun'),
}

# 🔴 `disenos/` SE SALTEA **MENOS CUATRO ARCHIVOS**, Y ESA ES LA PARTE
# QUE IMPORTA. Son 136 scripts de exploracion, y si entraran, cada hoja
# comparativa nueva redibujaria las 138 Servidor. Pero **cuatro de ellos
# son la carta vigente**: `03_Servidor/generar.py` importa `todos_sv`,
# que a su vez importa `los_nueve`, `paneles` y `avatares`.
#
# ⚠️ `todos_sv.py` ES EL MOTOR DE LAYOUT DE LA SERVIDOR viviendo en una
# carpeta que se llama «diseños». La primera version de este archivo
# escribia que *«generar.py no los importa»*, que es falso — o sea que
# tocar el layout de la Servidor no hubiera disparado ningun redibujo,
# justo el bug que esto existe para cerrar. Lo destapo el mismo error de
# la ruta clavada: los tres archivos con la ruta de Windows eran estos.
#
# ⚠️ Se resuelven SIGUIENDO LOS IMPORTS y no con una lista. Una lista de
# cuatro nombres se queda vieja el dia que `todos_sv` importe un quinto.
SALTAR = ('disenos', 'salida', '__pycache__', 'fonts', 'logos_sv',
          'logos_color', 'escudos_cuad', 'fotos', 'banderas',
          'banderas_carta', 'estilos')

# carta -> por donde se entra a dibujarla, para rescatar lo vivo de una
# carpeta salteada
ENTRADA = {'servidor': '03_Servidor/generar.py'}


def _rescatados(carta):
    """Los .py de una carpeta salteada que la carta SI importa."""
    entrada = ENTRADA.get(carta)
    if not entrada:
        return []
    dis = os.path.join(BASE, '03_Servidor', 'disenos')
    if not os.path.isdir(dis):
        return []
    hay = {os.path.splitext(f)[0] for f in os.listdir(dis)
           if f.endswith('.py')}

    def pide(ruta):
        try:
            with open(ruta, encoding='utf-8') as f:
                arbol = ast.parse(f.read())
        except (OSError, SyntaxError):
            return set()
        out = set()
        for n in ast.walk(arbol):
            if isinstance(n, ast.Import):
                out |= {a.name.split('.')[0] for a in n.names}
            elif isinstance(n, ast.ImportFrom) and n.module and not n.level:
                out.add(n.module.split('.')[0])
        return out

    vivos, pila, visto = set(), [os.path.join(BASE, entrada)], set()
    while pila:
        p = pila.pop()
        if p in visto:
            continue
        visto.add(p)
        for m in pide(p):
            if m in hay:
                q = os.path.join(dis, m + '.py')
                if q not in vivos:
                    vivos.add(q)
                    pila.append(q)
    return sorted(os.path.relpath(v, BASE).replace('\\', '/') for v in vivos)


def _sin_docstrings(arbol):
    """El mismo arbol con los docstrings sacados. Muta y devuelve."""
    for n in ast.walk(arbol):
        if isinstance(n, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef,
                          ast.ClassDef)):
            c = getattr(n, 'body', None)
            if (c and isinstance(c[0], ast.Expr)
                    and isinstance(c[0].value, ast.Constant)
                    and isinstance(c[0].value.value, str)):
                c.pop(0)
    return arbol


def normalizar(ruta, datos):
    """El contenido de ese archivo sin lo que no cambia el dibujo.

    ⚠️ UN `.py` QUE NO PARSEA CUENTA POR SUS BYTES, y no revienta. Un
    archivo roto a medio editar no tiene por que tumbar el ciclo — y
    ademas cambia la huella, que es lo correcto: algo se toco.
    """
    if ruta.endswith('.py'):
        try:
            return ast.dump(_sin_docstrings(ast.parse(datos)))
        except SyntaxError:
            return datos
    if ruta.endswith('.css'):
        # el CSS no tiene AST a mano: alcanza con sacar comentarios y
        # aplastar el espacio, que es lo unico que se edita sin querer
        # decir nada
        return re.sub(r'\s+', ' ', re.sub(r'/\*.*?\*/', '', datos,
                                          flags=re.S)).strip()
    return datos


# 🔴 ESTE ARCHIVO NO ENTRA EN SU PROPIA HUELLA. Vive en `comun/`, asi
# que sin esto cada vez que se toca la herramienta cambian las cuatro
# huellas y se redibujan 552 cartas — 235 minutos de Actions— por un
# archivo que **no dibuja nada**: ningun generador lo importa, solo lo
# usan `bot/que_cambio.py` y `herramientas/que_pide_cada_carta.py`.
#
# ⚠️ Y ES UNA REGLA, NO UNA LISTA. «El modulo que calcula la huella»
# se resuelve solo con `__file__`; una lista de excepciones a mano es
# justo lo que este repo documenta que se queda vieja y falla callada.
YO = os.path.basename(os.path.abspath(__file__))


def archivos(carta):
    """Las rutas —relativas a BASE, ordenadas— que dibujan esa carta."""
    out = []
    for carp in CARPETAS[carta]:
        d = os.path.join(BASE, carp)
        if not os.path.isdir(d):
            continue
        for raiz, dirs, arcs in os.walk(d):
            dirs[:] = [x for x in dirs if x not in SALTAR]
            for a in arcs:
                if a.endswith(('.py', '.css')) and not (
                        a == YO and os.path.samefile(
                            raiz, os.path.dirname(os.path.abspath(__file__)))):
                    out.append(os.path.relpath(os.path.join(raiz, a), BASE)
                               .replace('\\', '/'))
    return sorted(set(out) | set(_rescatados(carta)))


def de(carta):
    """La huella del codigo que dibuja esa carta. 12 hex."""
    h = hashlib.sha1()
    for rel in archivos(carta):
        try:
            with open(os.path.join(BASE, rel), encoding='utf-8') as f:
                d = f.read()
        except OSError:
            continue
        # ⚠️ LA RUTA TAMBIEN ENTRA. Sin ella, renombrar un archivo o
        # mover una funcion de uno a otro da la misma huella.
        h.update(rel.encode('utf-8'))
        h.update(b'\0')
        h.update(normalizar(rel, d).encode('utf-8', 'replace'))
        h.update(b'\0')
    return h.hexdigest()[:12]


def todas():
    """{carta: huella} para las cuatro."""
    return {c: de(c) for c in CARPETAS}


def _self_check():
    """Que la normalizacion haga lo que dice: ignore forma, vea fondo."""
    casos = [
        ('un comentario', 'x = 1\n', 'x = 1  # hola\n', True),
        ('un docstring', 'def f():\n    return 1\n',
         'def f():\n    """Hace algo."""\n    return 1\n', True),
        ('el docstring del modulo', 'x = 1\n', '"""Titulo."""\nx = 1\n', True),
        ('espacio en blanco', 'x = 1\n', 'x   =   1\n\n\n', True),
        ('un valor', 'x = 1\n', 'x = 2\n', False),
        ('un umbral en un dict', "U = {'S': 62}\n", "U = {'S': 65}\n", False),
        ('un nombre', 'def f():\n    pass\n', 'def g():\n    pass\n', False),
        ('un texto de verdad', "t = 'hola'\n", "t = 'chau'\n", False),
    ]
    mal = 0
    print('\n  la normalizacion de .py')
    for que, a, b, igual in casos:
        na, nb = normalizar('x.py', a), normalizar('x.py', b)
        ok = (na == nb) == igual
        mal += not ok
        print('   %s %-24s %s' % ('✅' if ok else '🔴', que,
                                  'no cambia' if igual else 'CAMBIA'))
    # 🔴 CRLF CONTRA LF, Y NO ES UN DETALLE DE WINDOWS. El repo se edita
    # en Windows —donde git deja CRLF— y el ciclo corre en un runner
    # Linux, donde el checkout los deja en LF. Si eso moviera la huella,
    # el primer ciclo en la nube redibujaria las 552 cartas y despues
    # cada corrida alternaria con la de la maquina local, para siempre.
    # Anda porque `ast` no ve el fin de linea y el `.css` lo aplasta con
    # el resto del espacio, pero eso hay que probarlo, no suponerlo.
    crudo = 'def f():\n    x = 1\n    return x\n'
    for nom, ruta, t in (('.py', 'x.py', crudo),
                         ('.css', 'x.css', '.card {\n  color: red;\n}\n')):
        ok = (normalizar(ruta, t)
              == normalizar(ruta, t.replace('\n', '\r\n'))
              == normalizar(ruta, t.replace('\n', '\r')))
        mal += not ok
        print('   %s %-24s %s' % ('✅' if ok else '🔴',
                                  'CRLF/CR/LF en %s' % nom,
                                  'no cambia' if ok else '🔴 CAMBIA'))

    css = [('un comentario', 'a{color:red}', 'a{color:red}/* x */', True),
           ('un valor', 'a{color:red}', 'a{color:blue}', False)]
    print('\n  la de .css')
    for que, a, b, igual in css:
        ok = (normalizar('x.css', a) == normalizar('x.css', b)) == igual
        mal += not ok
        print('   %s %-24s %s' % ('✅' if ok else '🔴', que,
                                  'no cambia' if igual else 'CAMBIA'))

    # ⚠️ QUE NO DE LO MISMO PARA LAS CUATRO. Es el modo de fallar de
    # `huellas()` que ya costo caro: un hash uniforme no se distingue de
    # uno que anda, y sella el estado como bueno para siempre.
    t = todas()
    print('\n  las cuatro huellas')
    for c in sorted(t):
        print('   %-12s %s  · %d archivo(s)' % (c, t[c], len(archivos(c))))
    if len(set(t.values())) != len(t):
        print('   🔴 hay huellas repetidas: algo esta mal')
        mal += 1
    else:
        print('   ✅ las cuatro distintas')

    # ⚠️ QUE ESTE ARCHIVO NO SE HASHEE A SI MISMO. Ver `YO`: si entrara,
    # tocar la herramienta redibujaria las 552 cartas.
    yo = 'comun/' + YO
    dentro = [c for c in CARPETAS if yo in archivos(c)]
    if dentro:
        print('   🔴 %s entra en la huella de %s' % (yo, ', '.join(dentro)))
        mal += 1
    else:
        print('   ✅ %s no entra en su propia huella' % yo)

    # 🔴 Y QUE LO VIVO DE `disenos/` SI ENTRE. `todos_sv.py` es el motor
    # de layout de la Servidor y vive en la carpeta salteada: si se cae
    # del rescate, tocar el layout no redibuja nada.
    sv = archivos('servidor')
    resc = _rescatados('servidor')
    print('\n  lo vivo de disenos/')
    if not resc:
        print('   🔴 no rescató nada: %s no existe o no importa de ahí'
              % ENTRADA.get('servidor'))
        mal += 1
    for r in resc:
        ok = r in sv
        mal += not ok
        print('   %s %s' % ('✅' if ok else '🔴', r))
    hay = len([f for f in os.listdir(os.path.join(BASE, '03_Servidor',
                                                  'disenos'))
               if f.endswith('.py')])
    print('   (de %d .py en disenos/, %d son la carta y %d exploración)'
          % (hay, len(resc), hay - len(resc)))
    # y que la exploracion NO entre
    cuela = [f for f in sv if '/disenos/' in f and f not in resc]
    if cuela:
        print('   🔴 se coló exploración: %s' % ', '.join(cuela[:3]))
        mal += 1
    return mal


if __name__ == '__main__':
    if '--que' in sys.argv:
        for c in sorted(CARPETAS):
            a = archivos(c)
            print('\n══ %s · %d archivo(s) ══' % (c.upper(), len(a)))
            for r in a:
                print('   %s' % r)
        sys.exit(0)
    print('\n══ LA HUELLA DEL CODIGO QUE DIBUJA ══')
    sys.exit(1 if _self_check() else 0)
