"""GENERAR LAS CUATRO CARTAS DE TODO EL POOL, EN TANDA.

    python bot/generar_todas.py                 las cuatro
    python bot/generar_todas.py temporada pais  sólo esas
    python bot/generar_todas.py --listar        qué haría, sin correr nada
    python bot/generar_todas.py --prueba        el autochequeo del conteo

Deja todo en `bot/salida/` con el nombre `<carta>_<persona>.png`, que es lo
que `bot/subir_cartas.py` entiende.

⚠️ **POR QUÉ EXISTE, Y NO ES SÓLO COMODIDAD.**

**1 · Los nombres con espacio.** Pasar los 138 nombres por una línea de
comandos armada a mano los parte: `Lord Viruzz` se convierte en `Lord` y
`Viruzz`, y el generador dice *«no están en el pool»* de dos personas que sí
están. Pasó el 17/09/2026 y **es el mismo bug que `sync.py` ya tenía
documentado como arreglado** —*«Lil Junior» → «Lil»*— cometido de nuevo en
otro lado. Acá los nombres viajan como una **lista de argumentos**, que es lo
único que no se puede partir.

Son sólo 2 de 138 —`Lord Viruzz` y `Sin Limites`— y ésa es justamente la
trampa: con una muestra chica no aparece nunca.

**2 · Un solo Chromium por carta.** Arrancarlo cuesta ~5 s y dibujar una
carta ~1.5 s. De a una, las 552 son 46 minutos; en tanda, 23.

**3 · Cuenta lo que salió.** ⚠️ `CLAUDE.md` documenta que **Chromium tira
cartas en blanco cuando la hoja es muy grande y no avisa**: medido, a escala 3
salieron **96 de 137** sin un solo error. Un pipeline que no cuenta da por
buenas 137 cartas de las que vio 96.
"""
import glob
import json
import os
import shutil
import subprocess
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
SALIDA = os.path.join(SCR, 'salida')

# Cada carta: cómo se la llama, y de dónde recoger lo que dejó.
# ⚠️ Dos escriben donde se les dice y dos en su propia carpeta. No se
# unificó a propósito: tocar la ruta de salida de un exportador que ya
# anda es cambiar algo que nadie está mirando.
CARTAS = {
    'temporada': {
        'cmd': lambda n: [os.path.join('01_Temporada', 'exportar_png.py'),
                          '--todas', os.path.join(SALIDA, 'temporada_%s.png')],
        'recoge': None,
    },
    'competitivo': {
        'cmd': lambda n: [os.path.join('02_Competitivo', 'exportar_png.py'),
                          '--todas', os.path.join(SALIDA, 'competitivo_%s.png')],
        'recoge': None,
    },
    'servidor': {
        # ⚠️ ACÁ VAN LOS NOMBRES UNO POR UNO. Es el punto del archivo.
        'cmd': lambda n: [os.path.join('03_Servidor', 'generar.py')] + n,
        'recoge': (os.path.join(BASE, '03_Servidor', 'salida'), 'sv_', 'servidor'),
    },
    'pais': {
        'cmd': lambda n: [os.path.join('04_Pais', 'exportar_png.py'), '--todas'],
        'recoge': (os.path.join(BASE, '04_Pais', 'salida'), 'pais_', 'pais'),
    },
}

# ⚠️ EL TECHO NO ES EL MISMO EN TODAS, Y POR ESO SE CALCULA. País no emite
# la de quien no tiene país —"sin dato no hay pieza"—, así que su techo es
# el pool menos los que no lo tienen. Comparar todo contra el mismo número
# haría que la única carta completa parezca rota.
#
# ⚠️ Desde el 20/09/2026 ese resto es **cero**: la identidad sale del padrón
# y Mark tiene país ahí, así que hoy las cuatro llegan a 138. El cálculo se
# queda igual — el día que entre alguien sin país, vuelve a bajar solo.
def techos(pool):
    sin_pais = sum(1 for x in pool if not x.get('cc'))
    n = len(pool)
    return {'temporada': n, 'competitivo': n, 'servidor': n, 'pais': n - sin_pais}


def nombres():
    p = os.path.join(BASE, 'datos', 'competitivo_pool.json')
    with open(p, encoding='utf-8') as f:
        pool = json.load(f)
    return sorted(x['raw'] for x in pool), pool


def correr(carta, ns):
    cmd = [sys.executable] + CARTAS[carta]['cmd'](ns)
    t = time.time()
    # ⚠️ Lista de argumentos, NUNCA una cadena con shell=True: es lo que
    # parte los nombres con espacio.
    r = subprocess.run(cmd, cwd=BASE, capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    return r, time.time() - t


def recoger(carta, desde):
    """Mueve a bot/salida/ lo que el exportador dejó en su propia carpeta.

    ⚠️ **SÓLO LO DE ESTA CORRIDA**, y `desde` es el punto del archivo.

    Contar los PNG que hay en disco **no es contar lo que salió**, y la
    diferencia se pagó el 20/09/2026 en las dos formas posibles:

      · `competitivo` dejó 8 sin redibujar —la cola alfabética, de
        `Xclusivo` a `Zignos`— y esto dijo `138 de 138  ok`, porque los 8
        archivos de ayer seguían ahí. Es **exactamente** el «da por buenas
        137 cartas de las que vio 96» del docstring de arriba, con el
        conteo mirando el lugar equivocado.
      · `pais` tenía 300 PNG del 19/09 de gente que **no está en el pool**,
        y los barría a `bot/salida/` para que `subir_cartas.py` los subiera
        con el emoji viejo y sin las caras nuevas.

    El nombre del archivo no alcanza para separarlos —una carta vieja de
    alguien del pool se llama igual que la nueva—, así que el corte es el
    **mtime contra el arranque de esta corrida**. Con eso, «faltan N» vuelve
    a querer decir lo que dice.
    """
    info = CARTAS[carta]['recoge']
    if not info:
        return sum(1 for f in glob.glob(os.path.join(SALIDA, carta + '_*.png'))
                   if os.path.getmtime(f) >= desde)
    origen, prefijo, etiqueta = info
    n = 0
    for f in sorted(glob.glob(os.path.join(origen, prefijo + '*.png'))):
        if os.path.getmtime(f) < desde:
            continue
        quien = os.path.basename(f)[len(prefijo):]
        shutil.copy(f, os.path.join(SALIDA, '%s_%s' % (etiqueta, quien)))
        n += 1
    return n


def _prueba():
    """Que `recoger()` cuente lo de esta corrida y no lo que hay en disco.

    ⚠️ ES EL AUTOCHEQUEO DE LO UNICO QUE ESTE ARCHIVO PROMETE. El bug del
    20/09/2026 —8 cartas sin redibujar reportadas como `138 de 138 ok`— no
    se veia corriendo el pipeline: la unica forma de verlo era tener en la
    carpeta algo viejo con el mismo nombre, que es justo lo que esto arma.
    """
    import shutil
    import tempfile
    global SALIDA
    tmp, guardo = tempfile.mkdtemp(), SALIDA
    try:
        SALIDA = tmp
        viejo = time.time() - 3600
        for n in ('a', 'b', 'c'):
            p = os.path.join(tmp, 'temporada_%s.png' % n)
            open(p, 'wb').write(b'x')
            os.utime(p, (viejo, viejo))
        corte = time.time() - 2
        time.sleep(0.05)
        for n in ('d', 'e'):
            open(os.path.join(tmp, 'temporada_%s.png' % n), 'wb').write(b'x')
        hay = len(glob.glob(os.path.join(tmp, 'temporada_*.png')))
        nuevas, todas = recoger('temporada', corte), recoger('temporada', 0)
        bien = (hay, nuevas, todas) == (5, 2, 5)
        print('   en la carpeta %d · de esta corrida %d · sin corte %d   %s'
              % (hay, nuevas, todas, '✅' if bien else '🔴 MAL'))
        return 0 if bien else 1
    finally:
        SALIDA = guardo
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    if '--prueba' in sys.argv:
        print('\n══ ¿CUENTA LO DE ESTA CORRIDA? ══\n')
        r = _prueba()
        print('')
        return sys.exit(r)

    pedidas = [a for a in sys.argv[1:] if not a.startswith('-')] or list(CARTAS)
    malas = [c for c in pedidas if c not in CARTAS]
    if malas:
        sys.exit('no conozco: %s. Hay: %s' % (', '.join(malas), ', '.join(CARTAS)))

    ns, pool = nombres()
    tope = techos(pool)

    if '--listar' in sys.argv:
        print('%d personas · cartas: %s' % (len(ns), ', '.join(pedidas)))
        for c in pedidas:
            print('  %-12s techo %d' % (c, tope[c]))
        con_espacio = [n for n in ns if ' ' in n]
        print('\n  con espacio en el nombre (%d): %s'
              % (len(con_espacio), ', '.join(con_espacio) or '—'))
        return

    os.makedirs(SALIDA, exist_ok=True)
    print('%d personas · %s\n' % (len(ns), ', '.join(pedidas)))

    total, mal = 0, 0
    for c in pedidas:
        # 2 s de margen: el mtime que deja el sistema de archivos y
        # `time.time()` no tienen por qué coincidir al milisegundo, y
        # errar para el lado de contar de menos avisa; para el otro, no.
        t0 = time.time() - 2
        r, seg = correr(c, ns)
        n = recoger(c, t0)
        esperado = tope[c]
        estado = 'ok' if n >= esperado else '⚠️ FALTAN %d' % (esperado - n)
        if n < esperado:
            mal += 1
        print('  %-12s %3d de %3d   %5.1f s   %s' % (c, n, esperado, seg, estado))
        if r.returncode:
            print('       el generador salió con código %d' % r.returncode)
            print('       %s' % (r.stderr or r.stdout or '').strip()[-300:])
            mal += 1
        total += n

    print('\n  %d PNG en %s' % (total, os.path.relpath(SALIDA, BASE)))
    if mal:
        print('  ⚠️ %d carta(s) no llegaron a su techo. NO subir sin mirar por qué.' % mal)
    sys.exit(1 if mal else 0)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
