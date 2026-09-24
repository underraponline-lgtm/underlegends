"""REHACER TODAS LAS CARTAS DE UNAS POCAS PERSONAS.

    python bot/rehacer.py Andy Assuan Mark        las 13 de cada uno
    python bot/rehacer.py --cambiaron            los que cambiaron de foto

Son 13 por persona: Temporada, Competitivo, Pais, la Servidor propia y las
nueve por servidor.

⚠️ EXISTE PORQUE REGENERAR LAS 1.793 POR SEIS PERSONAS ES UNA HORA Y MEDIA.
Cuando alguien consigue su Discord ID —o cambia su foto en Discord— sus cartas
quedan viejas y las de los demas no. Rehacer todo "por las dudas" es el reflejo
caro; rehacer lo que cambio pide saber QUE cambio, y para eso esta `--cambiaron`.

⚠️ `--cambiaron` PREGUNTA POR EL CONTENIDO, NO POR LA FECHA. Usa `git status`
sobre `_avatares/`: un archivo que se volvio a bajar identico no figura, y uno
que figura es porque sus bytes son otros. La fecha del archivo miente —bajar la
misma foto otra vez la mueve— y eso ya hizo perder una vuelta: por mtime daban
83 personas afectadas y por contenido era UNA.
"""
import os
import subprocess
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)

SERVIDORES = ('DRA', 'EFA', 'FFA', 'FRZ', 'FTN', 'SR', 'TFC', 'TWR', 'URBF')


def cambiaron():
    """Quien tiene la foto distinta de la ultima que se commiteo."""
    r = subprocess.run(['git', 'status', '--porcelain',
                        '03_Servidor/disenos/_avatares/'],
                       cwd=BASE, capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    out = []
    for l in (r.stdout or '').splitlines():
        p = l.strip().split()[-1]
        if p.endswith('.png'):
            out.append(os.path.splitext(os.path.basename(p))[0])
    return out


def corre(args, callado=True):
    # ⚠️ encoding='utf-8' EXPLICITO. Sin eso, en Windows subprocess decodifica
    # la salida del hijo con cp1252 y revienta con UnicodeDecodeError en
    # cuanto un generador imprime un acento o un emoji — que imprimen todos.
    # El hijo funciona igual; lo que se cae es el que lo mira.
    r = subprocess.run([sys.executable] + args, cwd=BASE,
                       capture_output=True if callado else None, text=True,
                       encoding='utf-8', errors='replace')
    if r.returncode:
        print('   ⚠️ fallo: %s' % ' '.join(args[:3]))
        if callado and r.stderr:
            print('      %s' % r.stderr.strip().splitlines()[-1][:110])
    return r.returncode == 0


def main():
    import json
    import io as _io
    from comun import respaldo

    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    if '--cambiaron' in sys.argv:
        slugs = cambiaron()
    else:
        slugs = [respaldo._norm(a) for a in args]
    if not slugs:
        sys.exit('decime a quien, o corré con --cambiaron')

    # del slug al nombre como lo escribe el pool
    with _io.open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                  encoding='utf-8') as f:
        pool = json.load(f)
    por = {respaldo._norm(x['raw']): x['raw'] for x in pool}
    gente = [por[s] for s in slugs if s in por]
    fuera = [s for s in slugs if s not in por]

    print('\nREHACIENDO %d persona(s): %s' % (len(gente), ', '.join(gente)))
    if fuera:
        print('   (no estan en el pool, se saltean: %s)' % ', '.join(fuera))
    print('   son ~13 cartas cada uno\n')

    for n in gente:
        print('  %s' % n)
        corre(['01_Temporada/exportar_png.py', n])
        corre(['02_Competitivo/exportar_png.py', n])
        corre(['04_Pais/exportar_png.py', n])
        corre(['03_Servidor/generar.py', n])
        for sv in SERVIDORES:
            corre(['03_Servidor/generar.py', n, '--sv=%s' % sv])
    print('\nlisto. Ahora hay que subirlas:')
    print('   python bot/subir_cartas.py 01_Temporada/salida 02_Competitivo/salida '
          '03_Servidor/salida 04_Pais/salida')
    print('   python bot/subir_cartas.py --sincronizar')
    print('   python bot/subir_datos.py            # el sello')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
