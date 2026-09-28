# -*- coding: utf-8 -*-
"""EL LECTOR DE LLAVES, ANTES Y DESPUÉS DE UN CAMBIO, SOBRE LAS LLAVES DE VERDAD.

    python herramientas/comparar_lector.py                 contra HEAD
    python herramientas/comparar_lector.py --antes <ref>   contra otro commit
    python herramientas/comparar_lector.py --fresco        vuelve a leer Discord

Corre `bot/llaves_a_entrada.py` **en seco** dos veces —con el código del
árbol de trabajo y con el de `<ref>`, en un `git worktree` aparte— sobre
**la misma lectura de Discord**, y dice qué filas de `Entrada` aparecen,
cuáles se van, qué preguntas de ✅ Decidir cambian y a qué evento le cambia
el plantel (que elige la escala de puntos).

🔴 EXISTE PORQUE LOS SELF-CHECKS MIRAN CASOS ELEGIDOS, Y EL LECTOR SE ROMPE
CON LOS QUE NADIE ELIGIÓ. El 28/09/2026 se arreglaron en una tarde tres
cosas del lector —un equipo de cuatro que el trío inscripto «corregía», las
menciones de octavos que no se seguían a cuartos y el plantel que contaba
dos veces a la misma persona— y **las tres pasaban todos los chequeos**. Lo
que dio la seguridad para subirlas fue esto: 20 llaves de la T1, código
viejo contra nuevo, **ninguna fila cambió fuera de MARRUECOS**. Y lo que
encontró el cuarto error —PROVENZA saliendo «walk-in» por haber pasado una
batalla de cuatro— fue esta misma comparación, no un chequeo.

⚠️ NO ESCRIBE NADA: ni el Sheet (sin `--aplicar`) ni `datos/`. La memoria
del barrido y la de #veredictos se desvían a `.cache/`, y la lectura de
Discord se guarda ahí (`.cache/lector_hallazgos.pkl`) para que las dos
versiones lean exactamente lo mismo. `.cache/` está en `.gitignore`: son
mensajes de los canales de la Liga.

⚠️ Y LEE DISCORD UNA VEZ, con el bot: no correrlo a las :22 ni a las :52,
cuando el ciclo lee los mismos canales.
"""
import io
import json
import os
import pickle
import shutil
import subprocess
import sys
import tempfile

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(BASE, '.cache')
HALLAZGOS = os.path.join(CACHE, 'lector_hallazgos.pkl')


def _hijo(raiz, salida):
    """Dentro del proceso hijo: el lector de `raiz`, en seco, espiado."""
    sys.path[:0] = [os.path.join(raiz, 'bot'), os.path.join(raiz, 'sheet'), raiz]
    os.chdir(raiz)
    import escuchar as E
    real = E.escuchar

    def _escuchar(s, *a, **k):
        if os.path.exists(HALLAZGOS):
            with open(HALLAZGOS, 'rb') as f:
                return pickle.load(f)
        # la memoria del barrido y la de #veredictos, lejos de datos/
        E.MEMORIA = os.path.join(CACHE, 'lector_canales.json')
        E.VER_MEMORIA = os.path.join(CACHE, 'lector_veredictos.json')
        for dst, src in ((E.MEMORIA, 'canales_llaves.json'),
                         (E.VER_MEMORIA, 'veredictos.json')):
            if os.path.exists(os.path.join(raiz, 'datos', src)):
                shutil.copy(os.path.join(raiz, 'datos', src), dst)
        r = real(s, *a, **k)
        with open(HALLAZGOS, 'wb') as f:
            pickle.dump(r, f)
        return r

    E.escuchar = _escuchar
    import llaves_a_entrada as L
    filas, dudas, planteles = [], [], {}
    _filas_de = L.filas_de

    def _espia(h, *a, **k):
        f, d, s = _filas_de(h, *a, **k)
        filas.extend(f)
        dudas.extend(d)
        return f, d, s

    L.filas_de = _espia
    sys.argv = ['llaves_a_entrada.py']
    L.main()
    for f in filas:
        planteles.setdefault('%s · %s · %s' % (f['evento'], f['servidor'], f['fecha']),
                             set()).add(f.get('participantes'))
    with io.open(salida, 'w', encoding='utf-8') as f:
        json.dump({'filas': filas,
                   'dudas': [[str(x) for x in d[:4]] for d in dudas],
                   'planteles': {k: sorted(v, key=str) for k, v in planteles.items()}},
                  f, ensure_ascii=False)


def _correr(raiz, salida):
    r = subprocess.run([sys.executable, os.path.abspath(__file__), '--hijo', raiz, salida],
                       cwd=raiz, capture_output=True, text=True, encoding='utf-8',
                       errors='replace', env=dict(os.environ, PYTHONIOENCODING='utf-8'))
    if r.returncode != 0 or not os.path.exists(salida):
        print(r.stdout[-2000:])
        print(r.stderr[-2000:])
        raise SystemExit('   🔴 el lector de %s no terminó' % raiz)
    with io.open(salida, encoding='utf-8') as f:
        return json.load(f)


def _clave(f):
    return tuple(str(f.get(c, '')) for c in
                 ('evento', 'servidor', 'fecha', 'ronda', 'ladoA', 'ladoB', 'ganador', 'notas'))


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--hijo' in sys.argv:
        i = sys.argv.index('--hijo')
        return _hijo(sys.argv[i + 1], sys.argv[i + 2])
    antes = sys.argv[sys.argv.index('--antes') + 1] if '--antes' in sys.argv else 'HEAD'
    os.makedirs(CACHE, exist_ok=True)
    if '--fresco' in sys.argv and os.path.exists(HALLAZGOS):
        os.remove(HALLAZGOS)
    print('\n══ EL LECTOR, %s CONTRA EL ÁRBOL DE TRABAJO ══\n' % antes)
    tmp = tempfile.mkdtemp(prefix='lector_')
    viejo_dir = os.path.join(tmp, 'antes')
    try:
        subprocess.run(['git', 'worktree', 'add', '--detach', '-q', viejo_dir, antes],
                       cwd=BASE, check=True)
        # 🔴 Y LOS MISMOS `datos/`: si no, lo que cambia no es sólo el
        # código. La primera corrida de esta herramienta dio PRRR → Prrr y
        # PANCHOK → Panchok en eventos que el cambio no tocaba: el árbol
        # viejo leía las inscripciones de SU commit, dos horas más viejas.
        shutil.rmtree(os.path.join(viejo_dir, 'datos'), ignore_errors=True)
        shutil.copytree(os.path.join(BASE, 'datos'), os.path.join(viejo_dir, 'datos'))
        # ⚠️ EL ÁRBOL VIEJO NECESITA LO QUE NO ESTÁ EN GIT: las credenciales
        # y `.cache/` (los nombres de Discord). Se enlazan, no se copian.
        for x in ('creds.json', '.env', 'oauth_token.json', '.cache'):
            if os.path.exists(os.path.join(BASE, x)):
                try:
                    os.symlink(os.path.join(BASE, x), os.path.join(viejo_dir, x),
                               target_is_directory=(x == '.cache'))
                except OSError:
                    if x != '.cache':
                        shutil.copy(os.path.join(BASE, x), os.path.join(viejo_dir, x))
        print('   leyendo con el código de ahora (la primera vez, de Discord)…')
        nuevo = _correr(BASE, os.path.join(tmp, 'nuevo.json'))
        print('   leyendo con el de %s…' % antes)
        viejo = _correr(viejo_dir, os.path.join(tmp, 'viejo.json'))
    finally:
        subprocess.run(['git', 'worktree', 'remove', '--force', viejo_dir], cwd=BASE,
                       capture_output=True)
        shutil.rmtree(tmp, ignore_errors=True)

    from collections import Counter
    cv, cn = Counter(map(_clave, viejo['filas'])), Counter(map(_clave, nuevo['filas']))
    se_van, entran = cv - cn, cn - cv
    print('\n   filas: %d antes · %d ahora' % (len(viejo['filas']), len(nuevo['filas'])))
    for titulo, grupo, signo in (('se van', se_van, '-'), ('entran', entran, '+')):
        print('\n   %s: %d' % (titulo, sum(grupo.values())))
        for x in sorted(grupo):
            print('     %s %s · %s | %s vs %s -> %s%s'
                  % (signo, x[0][:30], x[3], x[4], x[5], x[6],
                     ('   [%s]' % x[7]) if x[7] else ''))
    dv = Counter(tuple(d) for d in viejo['dudas'])
    dn = Counter(tuple(d) for d in nuevo['dudas'])
    print('\n   preguntas de batalla: %d antes · %d ahora' % (len(viejo['dudas']), len(nuevo['dudas'])))
    for titulo, grupo in (('se contestan solas', dv - dn), ('nuevas', dn - dv)):
        for d in sorted(grupo):
            print('     %s: %s · %s · %s' % (titulo, d[0][:30], d[1], d[2][:70]))
    pv, pn = viejo['planteles'], nuevo['planteles']
    cambia = [k for k in sorted(set(pv) | set(pn)) if pv.get(k) != pn.get(k)]
    print('\n   planteles que cambian: %d' % len(cambia))
    for k in cambia:
        print('     %s: %s -> %s' % (k[:50], pv.get(k), pn.get(k)))
    print('\n   %s\n' % ('✅ nada cambió' if not (se_van or entran or cambia or dv != dn)
                         else 'mirá cada diferencia antes de subir'))
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
