# -*- coding: utf-8 -*-
"""LAS DOS DECISIONES QUE FALTAN DEL REWORK, MEDIDAS EN VEZ DE OPINADAS.

    python herramientas/simular_score.py            las dos, sobre el pool de hoy
    python herramientas/simular_score.py --pre      sobre las 138 de la pre-temporada
    python herramientas/simular_score.py --pesos    sólo G1
    python herramientas/simular_score.py --escala   sólo A7
    python herramientas/simular_score.py --auto     el self-check, sin datos

Quedan dos puntos del rework del 23/09/2026 que **no son implementación**:

    G1  los pesos      ⚡0.25 · 🎯0.24 · 👑0.21 · 🔥0.10 · 🌍0.20   (hoy: aplicado el 25/09/2026)
                       ⚡0.30 · 🎯0.24 · 👑0.21 · 🔥0.15 · 🌍0.10   (los de antes)
    A7  el Score a 40–99, como el OVR de Temporada

El propio rework dice de los pesos *«simular sobre los 138 ANTES de
fijar»*. Esto es esa simulación.

🔴 Y LAS 138 YA NO EXISTEN, PERO ESTAN EN GIT. La pre-temporada se borró
el 22/09/2026 y el pool de hoy tiene **45 personas con uno o dos
eventos**, donde cualquier peso da casi lo mismo: no hay con qué separar.
`--pre` saca el pool de 138 del commit `a34b934`, que es el último antes
del reset.

⚠️ ESOS 138 TRAEN LAS DIMENSIONES DE ANTES DE A1, y eso hay que tenerlo
presente al leer el número. Se calcularon normalizando **contra el máximo
del pool**; desde A1 se normaliza contra anclas fijas, así que los mismos
eventos darían dimensiones algo distintas. Lo que la simulación contesta
bien es la pregunta de G1 —**cómo se reparte el peso entre cinco
dimensiones dadas**— y no «cuánto va a sacar Fulano en la T1».

🔴 A7 NO SE PUEDE APLICAR SOLO, Y ESA ES LA MITAD DE LA RESPUESTA. Con el
Score arrancando en 40, los umbrales `B 37 · C 26 · D 18 · E resto` caen
**todos por debajo del mínimo posible**: cuatro de los ocho rangos dejan
de existir y nadie puede bajar de B nunca más. O se recalibran en la
misma pasada o no se toca.
"""
import io
import json
import os
import subprocess
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'sheet'))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

#: el último commit con el pool de 138, antes del reset del 22/09/2026
COMMIT_PRE = 'a34b934'

DIMS = ('E', 'C', 'Dm', 'T', 'V')
NOMBRE = {'E': '⚡ Eficiencia', 'C': '🎯 Consistencia', 'Dm': '👑 Dominancia',
          'T': '🔥 Racha', 'V': '🌍 Diversidad'}

#: los juegos de pesos que se comparan. El primero es el vigente.
JUEGOS = [
    ('hoy (G1)',  {'E': .25, 'C': .24, 'Dm': .21, 'T': .10, 'V': .20}),
    ('antes',     {'E': .30, 'C': .24, 'Dm': .21, 'T': .15, 'V': .10}),
]


def pool(pre=False):
    """Las filas. Con `pre`, las 138 sacadas de git."""
    if pre:
        out = subprocess.run(
            ['git', 'show', '%s:datos/competitivo_pool.json' % COMMIT_PRE],
            cwd=BASE, capture_output=True, timeout=60)
        if out.returncode:
            return []
        return json.loads(out.stdout.decode('utf-8'))
    p = os.path.join(BASE, 'datos', 'competitivo_pool.json')
    if not os.path.exists(p):
        return []
    with io.open(p, encoding='utf-8') as f:
        return json.load(f)


def score_con(fila, pesos):
    """El Score de esa fila con esos pesos. Mismo redondeo que el real."""
    crudo = sum(pesos[k] * float(fila.get(k) or 0) for k in DIMS)
    return round(crudo * float(fila.get('conf') or 0), 1)


def rango_de(s):
    from comun.rangos import UMBRAL
    return next((r for r, u in UMBRAL if s >= u), 'E')


# ═══════════════════════════════════════════════════════════════════
#  G1 — los pesos
# ═══════════════════════════════════════════════════════════════════

def pesos(filas):
    """Compara los juegos de `JUEGOS`. Devuelve cuántos cambian de rango."""
    print('\n══ G1 · LOS PESOS ══\n')
    if not filas:
        print('   no hay pool: nada que simular\n')
        return 0
    for n, p in JUEGOS:
        print('   %-11s %s   (suma %.2f)'
              % (n, ' · '.join('%s %.2f' % (k, p[k]) for k in DIMS),
                 sum(p.values())))

    base_n, base_p = JUEGOS[0]
    otro_n, otro_p = JUEGOS[1]
    calc = [(f.get('raw') or '?', score_con(f, base_p), score_con(f, otro_p))
            for f in filas]

    # ⚠️ EL PUESTO SE RECALCULA EN LOS DOS, no se compara contra `pos`
    # del pool: `pos` salió de un cálculo que ya no es ninguno de los
    # dos, así que compararlo mezclaría tres cosas.
    o1 = {n: i for i, (n, _a, _b) in
          enumerate(sorted(calc, key=lambda x: -x[1]), 1)}
    o2 = {n: i for i, (n, _a, _b) in
          enumerate(sorted(calc, key=lambda x: -x[2]), 1)}

    cambia = [(n, a, b, o1[n], o2[n]) for n, a, b in calc
              if rango_de(a) != rango_de(b)]
    mueve = sorted(calc, key=lambda x: -abs(x[2] - x[1]))

    print('\n   sobre %d persona(s):\n' % len(filas))
    print('      cambian de rango        %d  (%.0f %%)'
          % (len(cambia), 100.0 * len(cambia) / len(filas)))
    print('      cambian de puesto       %d'
          % sum(1 for n in o1 if o1[n] != o2[n]))
    print('      el #1 sigue siendo      %s'
          % ('sí' if _primero(o1) == _primero(o2)
             else 'NO — %s en vez de %s' % (_primero(o2), _primero(o1))))
    d = [abs(b - a) for _n, a, b in calc]
    print('      se mueve, de media      %.1f punto(s)   (máx %.1f)'
          % (sum(d) / len(d), max(d)))

    print('\n   los que más se mueven:\n')
    print('      %-16s %7s %7s   %s' % ('', base_n, otro_n, 'rango'))
    for n, a, b in mueve[:8]:
        ra, rb = rango_de(a), rango_de(b)
        print('      %-16s %7.1f %7.1f   %s%s'
              % (n[:16], a, b, ra, '' if ra == rb else ' → %s' % rb))

    if cambia:
        print('\n   los %d que cambian de LETRA:\n' % len(cambia))
        for n, a, b, p1, p2 in sorted(cambia, key=lambda x: x[3])[:12]:
            print('      %-16s %5.1f → %5.1f   %s → %s   puesto %d → %d'
                  % (n[:16], a, b, rango_de(a), rango_de(b), p1, p2))

    # 🔴 LO QUE EL CAMBIO DE PESOS COMPRA, dicho en una línea: el rework
    # sube Diversidad de .10 a .20 y baja Racha de .15 a .10. O sea
    # premia **jugar en varios servidores** y premia menos **encadenar
    # eventos**. Que eso sea bueno o malo no lo dice un número: lo dice
    # qué quiere la liga. Lo que el número sí dice es cuánto cuesta.
    print('\n   qué compra el cambio:\n')
    for k in DIMS:
        d = otro_p[k] - base_p[k]
        if abs(d) < 0.001:
            continue
        print('      %-16s %+.2f   %s' % (NOMBRE[k], d,
                                          'pesa más' if d > 0 else 'pesa menos'))
    planas(filas, base_p, otro_p)
    return len(cambia)


def planas(filas, base_p, otro_p):
    """🔴 SUBIR EL PESO DE UNA DIMENSION QUE ESTA EN CERO PARA TODOS.

    No cambia el orden —si el valor es el mismo, multiplicarlo por otra
    cosa da el mismo empate— pero **baja el techo para todo el mundo**:
    ese peso pasa a ser puntos que nadie puede ganar. Y baja callado,
    porque la lista sale igual.

    Pasa hoy con 🌍 Diversidad: en la T1 **todos los eventos son de
    FFA**, así que nadie tiene puntos en un segundo servidor y `V` vale
    0 en las 45 filas. Pasar su peso de .10 a .20 le saca **diez puntos
    de techo a cada uno** para medir algo que todavía no existe.
    """
    if not filas:
        return
    avisos = []
    for k in DIMS:
        sube = otro_p[k] - base_p[k]
        if sube <= 0.001:
            continue
        v = [float(f.get(k) or 0) for f in filas]
        if max(v) - min(v) > 0.001:
            continue
        avisos.append((k, sube, v[0] if v else 0))
    if not avisos:
        return
    print('\n   🔴 PERO HOY NO SE PUEDE APLICAR, Y NO ES OPINION:\n')
    for k, sube, val in avisos:
        print('      %s vale %g en LAS %d filas del pool.'
              % (NOMBRE[k], val, len(filas)))
        print('      Subirle el peso %+.2f no mueve a nadie de lugar —el'
              % sube)
        print('      empate se mantiene— pero le saca %.0f punto(s) de techo'
              % (sube * 100))
        print('      a cada uno, por una dimensión que todavía no mide nada.')
    print('\n      Se destraba solo: en cuanto haya eventos de más de un')
    print('      servidor, esa dimensión deja de ser plana. Hoy la T1')
    print('      entera es de FFA.\n')


def _primero(orden):
    return next(n for n, i in orden.items() if i == 1)


# ═══════════════════════════════════════════════════════════════════
#  A7 — el Score a 40–99
# ═══════════════════════════════════════════════════════════════════

def escala(filas):
    """Qué pasa con los umbrales si el Score arranca en 40."""
    from comun.rangos import UMBRAL, ORDEN
    print('\n══ A7 · EL SCORE A 40–99 ══\n')
    piso, techo = 40.0, 99.0

    print('   la idea: que el Score se lea como el OVR de Temporada,')
    print('   que ya vive en 40–99 y por eso «40» se entiende como el piso.\n')

    # 🔴 EL PROBLEMA, ANTES QUE CUALQUIER TABLA: cuatro umbrales quedan
    # debajo del mínimo posible.
    muertos = [r for r, u in UMBRAL if u < piso and r != 'E']
    print('   🔴 con el Score arrancando en %g, estos umbrales quedan'
          % piso)
    print('      DEBAJO del mínimo posible — nadie puede caer ahí nunca:\n')
    for r, u in UMBRAL:
        marca = '🔴 imposible' if (u < piso and r != 'E') else ''
        print('      %-4s %3d   %s' % (r, u, marca))
    print('\n      son %d de los %d rangos: %s'
          % (len(muertos), len(ORDEN), ' · '.join(muertos)))

    # La recalibración: el mismo reparto, estirado al rango nuevo.
    print('\n   ── si se recalibran manteniendo el reparto ──\n')
    umbral_max = max(u for _r, u in UMBRAL)
    nuevos = []
    for r, u in UMBRAL:
        n = piso + (u / 100.0) * (techo - piso) if r != 'E' else 0
        nuevos.append((r, round(n)))
    for (r, viejo), (_r2, nuevo) in zip(UMBRAL, nuevos):
        print('      %-4s %3d  →  %3d' % (r, viejo, nuevo if r != 'E' else 0))
    print('\n      (el tope de hoy es %d; el techo nuevo sería %g)'
          % (umbral_max, techo))

    if not filas:
        print('\n   no hay pool: no puedo mostrar a quién le toca qué\n')
        return 0

    # Cuánta gente se mueve con la recalibración. Si el reparto se
    # mantiene, NADIE se mueve — y eso es justamente lo que hay que
    # poder ver, porque es el argumento a favor.
    umbral_nuevo = [(r, n) for r, n in nuevos if r != 'E']

    def rango_nuevo(s):
        s2 = piso + (s / 100.0) * (techo - piso)
        return next((r for r, u in umbral_nuevo if s2 >= u), 'E')

    mueven = [f for f in filas
              if rango_de(f.get('score') or 0)
              != rango_nuevo(f.get('score') or 0)]
    print('\n   sobre %d persona(s) del pool: cambian de letra  %d'
          % (len(filas), len(mueven)))
    for f in mueven[:8]:
        s = f.get('score') or 0
        print('      %-16s %5.1f   %s → %s'
              % ((f.get('raw') or '?')[:16], s, rango_de(s), rango_nuevo(s)))

    print('\n   🔴 Y HAY UN COSTO QUE NINGUNA TABLA MUESTRA: el 40 pasa a')
    print('      ser el piso de DOS cosas distintas. Hoy un OVR de 40 y un')
    print('      Score de 40 quieren decir cosas diferentes —uno es tu')
    print('      temporada, el otro tu calidad— y la carta los dibuja')
    print('      juntos. Igualar las escalas los hace parecer comparables.')
    print('      Es la primera regla del proyecto: **el número de cada')
    print('      carta mide lo que esa carta mide.**\n')
    return len(mueven)


def _self_check():
    print('\n  simular_score.py — self-check\n')
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('ok' if cond else '🔴', que))

    for n, p in JUEGOS:
        ok(abs(sum(p.values()) - 1.0) < 1e-9, '%s suma 1.00' % n)
        ok(set(p) == set(DIMS), '%s tiene las cinco dimensiones' % n)

    # 🔴 QUE EL CALCULO SEA EL DE VERDAD y no una copia que se le
    # parece. Si `competitivo.py` cambia la fórmula, esto tiene que
    # enterarse — una simulación que simula otra cosa es peor que
    # ninguna, porque se la cree.
    try:
        import competitivo as C
        f = {'E': 80, 'C': 60, 'Dm': 40, 'T': 20, 'V': 100, 'conf': 0.9}
        mio = score_con(f, dict(JUEGOS[0][1]))
        suyo = round(sum(p * f[k] for k, p in C.PESOS) * f['conf'], 1)
        ok(abs(mio - suyo) < 1e-9,
           'el Score simulado coincide con competitivo.py  (%.1f)' % mio)
        ok(dict(C.PESOS) == JUEGOS[0][1],
           'y «hoy» son los pesos que competitivo.py usa de verdad')
    except ImportError:
        ok(False, 'no pude importar competitivo.py')

    # ⚠️ EL PUNTO DE A7, comprobado en vez de afirmado.
    from comun.rangos import UMBRAL
    bajo = [r for r, u in UMBRAL if u < 40 and r != 'E']
    ok(len(bajo) >= 3,
       'A7 dejaría %d umbral(es) por debajo de 40: %s'
       % (len(bajo), ' '.join(bajo)))

    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    pre = '--pre' in sys.argv
    filas = pool(pre)
    print('\n══ SIMULACION DEL SCORE ══')
    print('   pool: %s  (%d persona(s))'
          % ('las 138 de la pre-temporada, de git %s' % COMMIT_PRE if pre
             else 'el de hoy', len(filas)))
    if not pre and len(filas) < 20:
        print('\n   ⚠️ SON POCOS Y CON POCOS EVENTOS: cualquier juego de')
        print('      pesos da casi lo mismo. Para que la simulación separe')
        print('      algo, corré `--pre`.')
    solo_p = '--pesos' in sys.argv
    solo_e = '--escala' in sys.argv
    if not solo_e:
        pesos(filas)
    if not solo_p:
        escala(filas)
    print('')
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
