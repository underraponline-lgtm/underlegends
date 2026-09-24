# -*- coding: utf-8 -*-
"""¿EL `norm()` DEL WORKER DA LO MISMO QUE `comun/claves.clave()`?

    python herramientas/claves_js_vs_py.py

🔴 ESTE TEST LO PROMETIA UN COMENTARIO Y NO EXISTIA. `comun/claves.py` decia,
sobre la lista `CASOS`: *«el JS tiene que dar lo mismo. Vive en `norm()` de
bot/worker.js y hay un test que compara los dos sobre esta misma lista»*. No
habia ningun test. Es la forma exacta que `CLAUDE.md` marca como la que mas
veces rompio el proyecto: **la decision existe en un lugar y el codigo lee
otro**, solo que acá ni siquiera habia codigo — habia una promesa.

Y no es una promesa cualquiera: las dos implementaciones ya discreparon de
verdad, y el sintoma fue que el bot contestaba «no tengo cartas de Ржунимагу»
teniendo sus cuatro cartas subidas.

POR QUE DOS IMPLEMENTACIONES Y NO UNA
-------------------------------------
El Worker corre en Cloudflare y no puede importar Python. Mientras eso sea
asi, la unica defensa posible es medir que las dos contesten igual — no
confiar en que se parezcan al leerlas.

⚠️ LEE EL `norm` DEL ARCHIVO DE VERDAD. Reescribir la funcion aca en una
cadena JS seria una TERCERA copia, y entonces el test pasaria mientras el
Worker hace otra cosa. Se extrae la linea de `bot/worker.js`.

⚠️ NECESITA `node`. Si no esta, lo dice y devuelve 0: no se puede afirmar que
esta bien, pero tampoco tumbar una corrida por eso.
"""
import io
import json
import os
import re
import subprocess
import sys
import tempfile

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'sheet'))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

from comun.claves import clave, CASOS       # noqa: E402

WORKER = os.path.join(BASE, 'bot', 'worker.js')


def norm_del_worker():
    """La definicion de `norm` tal cual esta escrita en worker.js."""
    src = io.open(WORKER, encoding='utf-8').read()
    m = re.search(r'^const norm = .*?;\s*$', src, re.M | re.S)
    if not m:
        sys.exit('no encontre `const norm = ...;` en bot/worker.js')
    # la expresion puede ocupar varias lineas; se corta en el primer `;` que
    # cierra la sentencia
    txt = m.group(0)
    if txt.count('\n') > 6:
        sys.exit('la definicion de norm parece haber crecido — revisala a mano')
    return txt


def nombres_reales():
    """Los de la lista CASOS mas los que de verdad estan en los datos.

    ⚠️ LOS CASOS SOLOS NO ALCANZAN. Son los que ya rompieron; los que van a
    romper estan en el padron. Sumar los 870 no cuesta nada y cubre alfabetos
    que a nadie se le ocurrieron.
    """
    fuera = [n for n, _ in CASOS]
    try:
        import construir_padron as PAD
        fuera += [x['raw'] for x in PAD.cargar()]
    except Exception:
        pass
    for f in ('competitivo_pool.json', 'temporada_pool.json'):
        p = os.path.join(BASE, 'datos', f)
        if os.path.exists(p):
            with io.open(p, encoding='utf-8') as fh:
                fuera += [x.get('raw') or x.get('nombre') or '' for x in json.load(fh)]
    # los que no existen todavia pero son la forma del proximo bug
    fuera += ['', '   ', '🦠🧠', '❓', '🇦🇷 Konan', '𝗕𝗹𝗼𝗼𝗱𝘆', 'Ｆｕｌｌ']
    vistos, out = set(), []
    for n in fuera:
        if n not in vistos:
            vistos.add(n)
            out.append(n)
    return out


def main():
    try:
        subprocess.run(['node', '--version'], capture_output=True, check=True)
    except Exception:
        print('\n  ⚠️ no hay `node` en el PATH — no puedo comparar.\n')
        return 0

    ns = nombres_reales()
    js = ('%s\nconst ns = JSON.parse(process.argv[2]);\n'
          'console.log(JSON.stringify(ns.map(norm)));\n' % norm_del_worker())
    fd, tmp = tempfile.mkstemp(suffix='.mjs')
    os.close(fd)
    io.open(tmp, 'w', encoding='utf-8').write(js)
    try:
        r = subprocess.run(['node', tmp, json.dumps(ns, ensure_ascii=False)],
                           capture_output=True, text=True, encoding='utf-8')
    finally:
        os.remove(tmp)
    if r.returncode:
        print('\n  💥 node fallo:\n%s\n' % r.stderr[:400])
        return 1

    lado_js = json.loads(r.stdout)
    dif = [(n, clave(n), j) for n, j in zip(ns, lado_js) if clave(n) != j]

    print('\n  %d nombres comparados  (CASOS + padrón + pools + los raros)' % len(ns))
    print('  norm() leído de bot/worker.js, no reescrito acá')
    if not dif:
        print('\n  ✅ el JS y Python dan la MISMA clave en los %d\n' % len(ns))
        return 0
    print('\n  🔴 %d discrepan:\n' % len(dif))
    for n, p, j in dif[:20]:
        print('      %-22r python=%-18s js=%s' % (n, p, j))
    print('')
    return 1


if __name__ == '__main__':
    sys.exit(main())
