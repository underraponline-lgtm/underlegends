# -*- coding: utf-8 -*-
"""🔎 ¿La web usa un hook o un componente que no importó? (sin dependencias: corre en CI y acá)

    python herramientas/web_nombres.py          lo que encuentra en web/src
    python herramientas/web_nombres.py --auto   el self-check, y falla si encuentra algo

El 18/10/2026 Publicaciones se rompió en producción con «useAplausos is not defined»: `publicaciones.jsx` hacía
`export { useAplausos } from './aplausos.js'` —que re-exporta pero NO deja el nombre definido en el archivo— y lo usaba.
`vite build` no lo ve (para él es una variable global), CI no miraba la web, y lo encontró el recorrido de la pasada de
bugs del 19/10, un día después. Esto mira justo esa clase de error, sin un linter: en cada archivo de `web/src`, cada
`useAlgo(` y cada `<Componente` tiene que estar importado o declarado ahí (o ser de React).
"""
import glob
import io
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(BASE, 'web', 'src')

#: lo que no hace falta importar: lo de JSX que no es un componente nuestro
SIEMPRE = {'Fragment'}
NOMBRE = re.compile(r'^[A-Za-z_$][\w$]*$')


def _sin_comentarios(s):
    """Sin comentarios, y SIN mover las líneas (los de bloque se cambian por sus mismos saltos). Un comentario empieza al
    principio, después de un espacio, de `{` o de `(`: así `accept="image/*"` o `'https://…'` no se toman por uno."""
    s = re.sub(r'(^|[\s{(])/\*.*?\*/', lambda m: m.group(1) + '\n' * m.group(0).count('\n'), s, flags=re.S)
    return re.sub(r'(^|\s)//[^\n]*', r'\1', s)


def _sueltos(trozo, separador=':'):
    """Los nombres de un desarme: `a, b: c, d = 1` → a, c, d."""
    out = set()
    for x in trozo.split(','):
        x = x.split(separador)[-1].split('=')[0].strip().lstrip('.')
        if NOMBRE.match(x):
            out.add(x)
    return out


def declarados(s):
    """Los nombres que el archivo importa o declara."""
    out = set()
    for m in re.finditer(r'^\s*import\s+([^;]+?)\s+from\s+[\'"]', s, re.M):
        cab = m.group(1)
        llaves = re.search(r'\{([^}]*)\}', cab)
        if llaves:
            for x in llaves.group(1).split(','):
                x = x.strip()
                if x:
                    out.add(x.split(' as ')[-1].strip())
        estrella = re.search(r'\*\s+as\s+(\w+)', cab)
        if estrella:
            out.add(estrella.group(1))
        resto = re.sub(r'\{[^}]*\}|\*\s+as\s+\w+', '', cab)
        for x in re.split(r'[,\s]+', resto):
            if NOMBRE.match(x.strip()):
                out.add(x.strip())
    out |= set(re.findall(r'\b(?:function|class)\s+([A-Za-z_$][\w$]*)', s))
    out |= set(re.findall(r'\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=', s))
    # const { a, b: c } = …  ·  const [x, y] = …
    for m in re.finditer(r'\b(?:const|let|var)\s*\{([^}]*)\}\s*=', s):
        out |= _sueltos(m.group(1))
    for m in re.finditer(r'\b(?:const|let|var)\s*\[([^\]]*)\]\s*=', s):
        out |= _sueltos(m.group(1))
    # los parámetros desarmados: ({ liga, Comp }) => …  ·  .map(([Dibujo, texto], i) => …)
    for m in re.finditer(r'\(\s*\{([^}]*)\}', s):
        out |= _sueltos(m.group(1))
    for m in re.finditer(r'\(\s*\[([^\]]*)\]', s):
        out |= _sueltos(m.group(1))
    return out


def usados(s):
    """`[(nombre, línea)]` de los hooks que se llaman y los componentes que se dibujan."""
    out = []
    for i, l in enumerate(s.split('\n'), 1):
        for m in re.finditer(r'(?<![\w.$])(use[A-Z][\w$]*)\s*\(', l):
            out.append((m.group(1), i))
        for m in re.finditer(r'<([A-Z][\w$]*)[\s/>]', l):
            out.append((m.group(1), i))
    return out


def revisar(s):
    s = _sin_comentarios(s)
    d = declarados(s) | SIEMPRE
    vistos = set()
    malos = []
    for n, i in usados(s):
        if n not in d and n not in vistos:
            vistos.add(n)
            malos.append((n, i))
    return malos


def correr():
    malos = {}
    for p in sorted(glob.glob(os.path.join(WEB, '*.js')) + glob.glob(os.path.join(WEB, '*.jsx'))):
        with io.open(p, encoding='utf-8') as f:
            m = revisar(f.read())
        if m:
            malos[os.path.relpath(p, BASE).replace('\\', '/')] = m
    return malos


def _self_check():
    mal = 0

    def ok(c, q, extra=''):
        nonlocal mal
        mal += not c
        print('   %s %s%s' % ('✅' if c else '🔴', q, ('  ' + str(extra)) if extra and not c else ''))

    print('\n══ ¿LA WEB USA ALGO QUE NO IMPORTÓ? ══\n')
    roto = "export { useAplausos } from './aplausos.js';\nfunction J() { const A = useAplausos(); return <Cara />; }"
    ok([n for n, _ in revisar(roto)] == ['useAplausos', 'Cara'],
       'lo del 18/10: re-exportar no define el nombre, y un componente sin importar', revisar(roto))
    bien = ("import { useState } from 'react';\nimport { useAplausos } from './aplausos.js';\nimport { Cara as C } from './piezas.jsx';\n"
            "export { useAplausos };\nconst Pista = lazy(() => 1);\nfunction J({ Comp }) { useState(0); useAplausos(); return <><C /><Pista /><Comp /><Fragment /></>; }")
    ok(not revisar(bien), 'importado, renombrado, declarado o recibido: nada', revisar(bien))
    ok(not revisar('// <Nada /> useNada()\n/* <Otro /> */ const x = 1;'), 'lo que está en un comentario no cuenta')
    ok(not revisar('<input accept="image/*" />\nfunction FotoCaja() { return 1; }\nconst x = <FotoCaja />; // */'),
       '«image/*» no es un comentario: lo que sigue se lee')
    ok(not revisar('PASOS.map(([Dibujo, texto], i) => <Dibujo key={i} />)'), 'lo desarmado de una lista también está declarado')
    ok(revisar('/* uno\ndos */\nuseNada();') == [('useNada', 3)], 'un comentario de varias líneas no corre los números de línea')
    m = correr()
    ok(not m, 'web/src: todo hook y todo componente que se usa está importado o declarado',
       '; '.join('%s: %s' % (k, ', '.join('%s (línea %d)' % x for x in v)) for k, v in m.items()))
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        sys.exit(1 if _self_check() else 0)
    r = correr()
    for k, v in r.items():
        print(k, ', '.join('%s (línea %d)' % x for x in v))
    print('\n%d archivo(s) con algo sin importar' % len(r))
