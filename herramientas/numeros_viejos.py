# -*- coding: utf-8 -*-
"""NUMEROS QUE EL REPO AFIRMA Y YA NO SON CIERTOS.

    python herramientas/numeros_viejos.py           los que no coinciden
    python herramientas/numeros_viejos.py --todos   tambien los que si

🔴 POR QUE EXISTE. El 20/09/2026 corregi cinco mediciones en `CLAUDE.md`
y despues descubri que **las correcciones entraban en un archivo y no en
los otros**: la misma afirmacion desmentida seguia escrita en otros ocho
lugares. El mejor caso fue `herramientas/bajar_avatares.py`, que afirma
que el CDN agranda cuatro veces y lo **desmiente cuatro lineas mas
abajo**, en el mismo comentario, con la medicion al lado.

⚠️ **UN NUMERO ESCRITO REPORTA EL DIA QUE SE ESCRIBIO.** Este repo apoya
sus decisiones en mediciones —«son 128 de 138, por eso el plato no va»— y
cuando el numero se da vuelta **el argumento se queda y la conclusion
puede dejar de seguirse**. Eso no lo encuentra leer el diff: hay que
recontar y comparar.

COMO FUNCIONA, Y QUE **NO** HACE
---------------------------------
Cada metrica trae (1) como se calcula HOY y (2) un regex de como se la
suele escribir. Se recuenta y se marca toda afirmacion cuyo numero no
coincida. **Se actualiza solo**: no hay una lista de frases viejas que
alguien tenga que mantener, que seria el mismo problema una capa arriba.

⚠️ **Marca de mas a proposito.** Una linea puede decir «eran 128 de 138 y
hoy son 26» —correcta— y esto la marca igual, porque no entiende
castellano. Es ruido barato: el que revisa descarta en dos segundos. Lo
caro es lo contrario, que es lo que pasa hoy.

⚠️ **Y no mira todo el repo.** `versiones/` y `docs/*_hallazgos.md` son
fotos de un momento y **tienen que** decir el numero de ese dia.
"""
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

# Lo que es una foto de un momento y no una afirmacion sobre hoy.
FUERA = ('versiones', '.git', 'node_modules', '__pycache__', 'salida',
         'galeria',
         # 🔴 `disenos/` ES EL REGISTRO DE COMO SE LLEGO AL DISENO, igual que
         # `versiones/`: sus leyendas -«118 de 138 no tienen avatar»- describen
         # el dia en que se compararon las opciones y **tienen que** quedar
         # asi. Sin esta exclusion el barrido devolvia 30 hallazgos de ahi y
         # 8 del resto, o sea que lo unico que importa quedaba tapado. Una
         # herramienta ruidosa se termina ignorando, que es el mismo final que
         # no tenerla. Lo vigente de la Servidor vive en su ESTADO.md.
         'disenos')
FUERA_ARCH = ('_hallazgos.md', 'retencion.md', 'ESTADO.md')


def _pool():
    with io.open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                 encoding='utf-8') as f:
        return json.load(f)


def _temp():
    p = os.path.join(BASE, 'datos', 'temporada_pool.json')
    if not os.path.exists(p):
        return []
    with io.open(p, encoding='utf-8') as f:
        return json.load(f)


def metricas():
    """{nombre: (valor_hoy, denominador, regex, que_es)}.

    ⚠️ EL REGEX PIDE UNA PALABRA CLAVE CERCA. Sin eso, «112 de 138»
    marcaria cualquier cosa que hable de 138: el denominador solo no
    distingue de que se esta hablando.
    """
    comp = _pool()
    n = len(comp)
    temp = _temp()
    try:
        from comun import respaldo
        con_foto = sum(1 for x in comp
                       if respaldo.avatar(x['raw'], x.get('av') or ''))
    except Exception:                                    # noqa: BLE001
        con_foto = None
    segter = sum(1 for x in temp if 'seg' in x and 'ter' in x)
    sin_cc = sum(1 for x in comp if not x.get('cc'))
    con_crew = sum(1 for x in comp if x.get('crew'))
    duelos = sum(1 for x in comp if x.get('duel_real'))

    # ⚠️ CON LIMITES DE PALABRA. Sin `\b`, «cara» matchea dentro de
    # **cara**cter y el barrido marcaba la linea del emoji de
    # `emoji_embed.py` como si hablara de fotos. Un falso positivo de un
    # detector de falsedades es especialmente caro.
    pal = r'\b(?:fotos?|avatares?|caras?)\b'
    m = {
        'con foto': (con_foto, n,
                     re.compile(r'(\d+)\s+de\s+%d' % n),
                     re.compile(pal, re.I)),
        'sin foto': (None if con_foto is None else n - con_foto, n,
                     re.compile(r'(\d+)\s+de\s+%d' % n),
                     re.compile(r'sin\s+%s|no\s+tien\w*\s+%s' % (pal, pal), re.I)),
        'SEG y TER': (segter, n, re.compile(r'(\d+)\s+de\s+%d' % n),
                      re.compile(r'\bSEG\b|\bTER\b|segundos y terceros', re.I)),
        'sin país': (sin_cc, n, re.compile(r'(\d+)\s+de\s+%d' % n),
                     re.compile(r'sin\s+pa[ií]s', re.I)),
        'con crew': (con_crew, n, re.compile(r'(\d+)\s+de\s+%d' % n),
                     re.compile(r'\bcrew\b', re.I)),
        'duelos reales': (duelos, n, re.compile(r'(\d+)\s+de\s+%d' % n),
                          re.compile(r'duelo', re.I)),
    }
    return {k: v for k, v in m.items() if v[0] is not None}


def archivos():
    for raiz, dirs, arcs in os.walk(BASE):
        dirs[:] = [d for d in dirs if d not in FUERA]
        for a in arcs:
            if not a.endswith(('.md', '.py')):
                continue
            if any(a.endswith(x) for x in FUERA_ARCH):
                continue
            # no se busca a si misma: sus propios comentarios citan los
            # numeros viejos para explicar por que existe
            if os.path.abspath(os.path.join(raiz, a)) == os.path.abspath(__file__):
                continue
            yield os.path.join(raiz, a)


def buscar():
    met = metricas()
    hall = []
    for p in archivos():
        try:
            txt = io.open(p, encoding='utf-8').read()
        except (OSError, UnicodeDecodeError):
            continue
        for i, linea in enumerate(txt.splitlines(), 1):
            for nom, (hoy, den, rx, clave) in met.items():
                if not clave.search(linea):
                    continue
                for m in rx.finditer(linea):
                    dicho = int(m.group(1))
                    hall.append((dicho == hoy, nom, hoy, dicho,
                                 os.path.relpath(p, BASE).replace('\\', '/'),
                                 i, linea.strip()))
    # ⚠️ UNA LINEA, UN HALLAZGO. «118 de 138 no tienen avatar» matchea
    # `con foto` y `sin foto` a la vez, y salia dos veces con dos numeros
    # de hoy distintos — que se lee como si el barrido se contradijera a si
    # mismo. Se junta por (archivo, linea, cifra) y se nombran juntas.
    junto = {}
    for ok, nom, hoy, dicho, rel, i, linea in hall:
        k = (rel, i, dicho)
        if k in junto:
            junto[k][1].append('%s=%d' % (nom, hoy))
            junto[k][0] = junto[k][0] or ok
        else:
            junto[k] = [ok, ['%s=%d' % (nom, hoy)], linea]
    return met, [(v[0], ' o '.join(v[1]), None, k[2], k[0], k[1], v[2])
                 for k, v in junto.items()]


def main():
    todos = '--todos' in sys.argv
    met, hall = buscar()
    print('\n══ LO QUE SE CUENTA HOY ══\n')
    for nom, (hoy, den, _, _) in sorted(met.items()):
        print('   %-16s %4d de %d' % (nom, hoy, den))

    malos = [h for h in hall if not h[0]]
    print('\n══ AFIRMACIONES QUE NO COINCIDEN ══\n')
    if not malos:
        print('   ✅ ninguna\n')
    for _, nom, hoy, dicho, rel, i, linea in sorted(malos, key=lambda x: x[4]):
        print('   %s:%d' % (rel, i))
        print('      dice %d · hoy %s' % (dicho, nom))
        print('      %s' % linea[:104])
    if malos:
        print('\n   ⚠️ Marca de más a propósito: «eran 128 y hoy son 26» sale')
        print('      acá igual. Lo caro es lo contrario. %d para revisar.\n'
              % len(malos))
    if todos:
        print('══ LAS QUE COINCIDEN ══\n')
        for h in sorted([x for x in hall if x[0]], key=lambda x: x[4]):
            print('   %-44s %s = %d' % ('%s:%d' % (h[4], h[5]), h[1], h[3]))
        print('')
    return 1 if malos else 0


if __name__ == '__main__':
    sys.exit(main())
