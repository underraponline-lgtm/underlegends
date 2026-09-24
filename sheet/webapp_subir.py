# -*- coding: utf-8 -*-
"""SUBIR UN ARCHIVO AL APPS SCRIPT DEL OFICIAL, sin pisar lo ajeno.

    python sheet/webapp_subir.py                    qué está distinto
    python sheet/webapp_subir.py WebApp.gs          el diff, NO escribe
    python sheet/webapp_subir.py WebApp.gs --aplicar  lo sube y publica
    python sheet/webapp_subir.py --sincronizar      trae lo vivo al repo
    python sheet/webapp_subir.py --auto             el self-check, sin red

🔴 EXISTE PORQUE EL REPO Y LO VIVO YA ESTABAN DESINCRONIZADOS, y subir el
archivo del repo habría **deshecho un arreglo publicado**.

Medido el 23/09/2026, bajando el proyecto y comparándolo con
`docs/appscript_oficial/`:

    appsscript   208 / 208       igual
    General      650 / 650       igual
    WebApp    22043 / 22043      igual
    Index    105800 / 105978     🔴 DISTINTO — lo vivo tiene 178 más

Esos 178 son el bloque de los **ocho rangos** que
`.github/workflows/rangos.yml` publica solo cuando se toca
`comun/rangos.py`. O sea: el `Index.html` del repo es la foto de **antes**
de ese arreglo, y su propio docstring lo dice sin querer —*«volver atrás
es subir ese archivo»*—. Subirlo para arreglar otra cosa devolvería la
página pública a **seis rangos**, que es justo la incoherencia que
`CLAUDE.md` llama «el último de los cinco lugares».

⚠️ POR ESO ESTO NO SUBE NADA A CIEGAS. Antes de escribir compara lo vivo
con **la versión commiteada** del archivo: si alguien —o un workflow—
cambió el original, se planta y lo dice. Es un candado optimista, la
misma idea que `git push` rechazando un `non-fast-forward`.

⚠️ Y SUBE **TODOS** LOS ARCHIVOS SIEMPRE, aunque toque uno. La API de
Apps Script reemplaza el proyecto entero con lo que le mandes: mandar un
solo archivo **borra los otros tres**. Los demás se mandan tal cual
bajaron, byte a byte.
"""
import difflib
import hashlib
import io
import os
import re
import subprocess
import sys

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

from webapp_rangos import API, SID, token, bajar, publicar   # noqa: E402

LOCAL = os.path.join(BASE, 'docs', 'appscript_oficial')

#: tipo de Apps Script -> extensión en el repo
EXT = {'SERVER_JS': '.gs', 'HTML': '.html', 'JSON': '.json'}


def _norm(s):
    """⚠️ Sin esto, un repo clonado en Windows sale «distinto» entero."""
    return (s or '').replace('\r\n', '\n')


def ruta(nombre, tipo):
    return os.path.join(LOCAL, nombre + EXT.get(tipo, ''))


def commiteado(nombre, tipo):
    """El archivo **como está en git HEAD**, no como está en disco.

    🔴 LA COMPARACION VA CONTRA GIT Y NO CONTRA EL DISCO. Si fuera
    contra el disco, mis propios cambios sin commitear contarían como
    «lo vivo cambió» y el candado se trabaría solo. Lo que hay que
    saber es si **alguien más** movió el original.
    """
    rel = os.path.relpath(ruta(nombre, tipo), BASE).replace('\\', '/')
    try:
        out = subprocess.run(['git', 'show', 'HEAD:%s' % rel], cwd=BASE,
                             capture_output=True, timeout=30)
        if out.returncode:
            return None
        return _norm(out.stdout.decode('utf-8'))
    except (OSError, subprocess.SubprocessError, UnicodeDecodeError):
        return None


def estado():
    """`[(nombre, tipo, vivo, disco, base)]` para los cuatro archivos."""
    p = bajar()
    out = []
    for f in p.get('files', []):
        n, t = f['name'], f['type']
        vivo = _norm(f.get('source', ''))
        r = ruta(n, t)
        disco = _norm(io.open(r, encoding='utf-8').read()) \
            if os.path.exists(r) else None
        out.append((n, t, vivo, disco, commiteado(n, t)))
    return p, out


def subir(proyecto, cambios):
    """Manda el proyecto entero con `cambios` = `{nombre: fuente}`."""
    files = []
    for f in proyecto.get('files', []):
        g = dict(f)
        if f['name'] in cambios:
            g['source'] = cambios[f['name']]
        files.append(g)
    r = requests.put(API + '/content',
                     headers={'Authorization': 'Bearer ' + token(True),
                              'Content-Type': 'application/json'},
                     json={'files': files}, timeout=120)
    if r.status_code >= 300:
        return False, '%s %s' % (r.status_code, r.text[:200])
    return True, ''


def _diff(a, b, nombre):
    return list(difflib.unified_diff(a.splitlines(), b.splitlines(),
                                     '%s (vivo)' % nombre,
                                     '%s (repo)' % nombre, lineterm='', n=2))


def _self_check():
    print('\n  webapp_subir.py — self-check\n')
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('ok' if cond else '🔴', que))

    ok(_norm('a\r\nb') == 'a\nb', 'los finales de línea se normalizan')

    # 🔴 EL SELLO DE LA CACHE. Los dos fallos que puede tener son
    # opuestos y los dos silenciosos: si se persigue la cola cambia en
    # cada subida y la página se reconstruye de gratis; si no ve el
    # código, no cambia nunca y el arreglo se queda detrás de la cache
    # seis horas —que es el bug que lo hizo existir—.
    A = "const CACHE_V = 'aaaaaaaaaa';\nfunction f(){ return 1; }\n"
    B = "const CACHE_V = 'bbbbbbbbbb';\nfunction f(){ return 1; }\n"
    C = "const CACHE_V = 'aaaaaaaaaa';\nfunction f(){ return 2; }\n"
    ok(huella(A) == huella(B),
       'el sello NO se persigue la cola: cambiarlo no cambia la huella')
    ok(huella(A) != huella(C),
       'y sí ve el código: cambiar una línea cambia la huella')
    ok(len(huella(A)) == 10 and SELLO_RE.search(A) is not None,
       'la línea del sello tiene la forma que el regex busca')
    # ⚠️ Y QUE ESA FORMA SEA LA DEL ARCHIVO DE VERDAD. Si alguien
    # reescribe la línea en `WebApp.gs`, `sellar()` deja de encontrarla
    # y devuelve `(None, False)` — o sea, no sella y no se queja.
    _p = os.path.join(LOCAL, 'WebApp.gs')
    _t = io.open(_p, encoding='utf-8').read() if os.path.exists(_p) else ''
    ok(SELLO_RE.search(_t) is not None,
       'y WebApp.gs tiene su línea de CACHE_V donde se la busca')
    ok(EXT['SERVER_JS'] == '.gs' and EXT['HTML'] == '.html',
       'cada tipo sabe su extensión')

    # 🔴 SUBIR UNO NO PUEDE BORRAR LOS OTROS TRES. La API reemplaza el
    # proyecto entero: es el fallo que dejaría la página en blanco.
    proy = {'files': [{'name': 'A', 'type': 'SERVER_JS', 'source': 'a'},
                      {'name': 'B', 'type': 'HTML', 'source': 'b'}]}
    salida = []

    def _falso(url, **kw):
        salida.append(kw.get('json'))

        class R:
            status_code = 200
            text = ''
        return R()
    real, globals()['requests'] = requests, type('M', (), {'put': _falso})
    try:
        subir(proy, {'A': 'NUEVO'})
    finally:
        globals()['requests'] = real
    mandado = salida[0]['files']
    ok(len(mandado) == 2, 'se mandan los 2 archivos, no sólo el tocado')
    ok(mandado[0]['source'] == 'NUEVO', 'el tocado va con lo nuevo')
    ok(mandado[1]['source'] == 'b', 'el otro va byte a byte como estaba')

    # ⚠️ y el tipo se conserva: un HTML mandado como SERVER_JS no compila
    ok(mandado[1]['type'] == 'HTML', 'y conserva su tipo')

    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


SELLO_RE = re.compile(r"^(const CACHE_V = ')([0-9a-f]{10})(';)", re.M)


def huella(fuente):
    """El sello de `WebApp.gs`, con su propia línea neutralizada.

    ⚠️ SE EXCLUYE A SI MISMA O EL SELLO SE PERSIGUE LA COLA: cambiarlo
    cambia el archivo, que cambia el hash, que cambia el sello. Es la
    misma regla que `comun/huella_codigo.py` resuelve con `__file__`.
    """
    limpio = SELLO_RE.sub(r"\g<1>0000000000\g<3>", fuente or '')
    return hashlib.sha256(limpio.encode('utf-8')).hexdigest()[:10]


def sellar():
    """Reescribe `CACHE_V` en el repo. Devuelve `(sello, cambió)`.

    🔴 SOLO `WebApp.gs`, Y NO `Index.html`. Lo que la cache guarda es el
    **JSON que arma el servidor**, y eso lo produce `buildAllData()`.
    `Index.html` corre en el navegador de quien mira: un cambio de CSS
    no cambia ni un byte de lo cacheado, así que meterlo en la huella
    tiraría la cache de gratis y la primera visita después de cada
    retoque visual pagaría un rebuild entero.

    ⚠️ Es la decisión inversa a la de las cartas, y a propósito: allá
    `huella_codigo.py` toma `comun/` **entera** porque el riesgo es
    redibujar de menos. Acá el riesgo es al revés — la cache se
    reconstruye sola en seis horas— así que de más no cuesta nada y de
    menos cuesta una página lenta.
    """
    p = os.path.join(LOCAL, 'WebApp.gs')
    if not os.path.exists(p):
        return (None, False)
    t = io.open(p, encoding='utf-8').read()
    m = SELLO_RE.search(t)
    if not m:
        return (None, False)
    nuevo = huella(t)
    if m.group(2) == nuevo:
        return (nuevo, False)
    t2 = SELLO_RE.sub(lambda x: x.group(1) + nuevo + x.group(3), t, count=1)
    with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(t2)
    return (nuevo, True)


def main():
    if '--auto' in sys.argv:
        return _self_check()
    aplicar = '--aplicar' in sys.argv
    forzar = '--forzar' in sys.argv
    sinc = '--sincronizar' in sys.argv
    pedidos = [a for a in sys.argv[1:] if not a.startswith('-')]

    print('\n══ APPS SCRIPT DEL OFICIAL ══\n')
    # 🔴 EL SELLO SE PONE ANTES DE MIRAR EL DISCO. Si se pusiera después,
    # el diff y el candado trabajarían sobre un archivo que todavía no
    # tiene el sello que se va a subir, y la verificación de lectura
    # compararía lo subido contra lo que se leyó antes de sellar.
    if not sinc:
        sello, se_movio = sellar()
        if se_movio:
            print('   🔁 CACHE_V → %s   el código cambió, así que la cache '
                  'de la página se invalida sola\n' % sello)
    proyecto, st = estado()

    if sinc:
        # ⚠️ TRAE LO VIVO AL REPO. Es lo que hay que correr después de
        # que un workflow publique algo, para que el repo deje de ser
        # una foto vieja que alguien puede «restaurar» sin querer.
        n = 0
        for nombre, tipo, vivo, disco, _base in st:
            if disco == vivo:
                continue
            with io.open(ruta(nombre, tipo), 'w', encoding='utf-8',
                         newline='\n') as f:
                f.write(vivo)
            print('   ↓ %s  actualizado desde lo vivo' % nombre)
            n += 1
        print('\n   %d archivo(s) traídos%s\n'
              % (n, '' if n else ' — el repo ya estaba al día'))
        return 0

    for nombre, tipo, vivo, disco, base in st:
        if disco is None:
            print('   %-12s  no está en el repo' % nombre)
            continue
        igual_vivo = disco == vivo
        movido = base is not None and base != vivo
        marca = 'al día' if igual_vivo else 'DISTINTO del repo'
        aviso = '  ⚠️ y lo vivo ya no es lo commiteado' if movido else ''
        print('   %-12s %8d vivo · %8d repo   %s%s'
              % (nombre, len(vivo), len(disco), marca, aviso))

    if not pedidos:
        print('\n   decime qué archivo subir, o `--sincronizar`\n')
        return 0

    cambios, frena = {}, []
    for nombre, tipo, vivo, disco, base in st:
        if (nombre + EXT.get(tipo, '')) not in pedidos and nombre not in pedidos:
            continue
        if disco is None:
            frena.append('%s no está en el repo' % nombre)
            continue
        if disco == vivo:
            print('\n   %s ya está igual arriba: no hay nada que subir'
                  % nombre)
            continue
        # 🔴 EL CANDADO. Si lo vivo no coincide con lo commiteado, algo
        # o alguien lo cambió por afuera —el workflow de rangos, por
        # ejemplo— y subir el del repo lo desharía.
        if base is not None and base != vivo and not forzar:
            frena.append(
                '%s: lo vivo NO es lo commiteado (%d vs %d). Alguien lo '
                'cambió por afuera —el workflow de rangos publica ahí—. '
                'Corré `--sincronizar` y volvé a aplicar tu cambio, o '
                '`--forzar` si de verdad querés pisarlo.'
                % (nombre, len(vivo), len(base)))
            continue
        d = _diff(vivo, disco, nombre)
        print('\n   %s — %d línea(s) de diff:' % (nombre, len(d)))
        for l in d[:40]:
            print('     %s' % l[:120])
        if len(d) > 40:
            print('     … y %d más' % (len(d) - 40))
        cambios[nombre] = disco

    if frena:
        print('')
        for f in frena:
            print('   🔴 %s' % f)
        print('')
        return 1
    if not cambios:
        print('')
        return 0
    if not aplicar:
        print('\n   (simulacro: no subí nada — agregá `--aplicar`)\n')
        return 0

    okk, err = subir(proyecto, cambios)
    if not okk:
        print('\n   🔴 no pude subir: %s\n' % err)
        return 1
    print('\n   ✅ subido')

    # 🔴 VERIFICAR LEYENDO. Es la regla del repo, y acá tapa el caso de
    # que la API acepte el PUT y guarde otra cosa.
    _p2, st2 = estado()
    malas = [n for n, _t, vivo, _d, _b in st2
             if n in cambios and vivo != cambios[n]]
    if malas:
        print('   🔴 no quedó igual arriba: %s\n' % ', '.join(malas))
        return 1
    print('   ✅ verificado leyendo')

    # 🔴 Y PUBLICAR, o la gente sigue viendo la versión vieja. Escribir
    # el código NO cambia lo que sirve el `/exec`.
    ver, url = publicar('subir %s' % ', '.join(sorted(cambios)))
    if ver is None:
        print('   🔴 %s\n' % url)
        return 1
    print('   ✅ versión %s publicada  %s' % (ver, url))
    # ⚠️ EL CANDADO COMPARA CONTRA HEAD, ASI QUE SUBIR SIN COMMITEAR LO
    # DEJA DESALINEADO — y la próxima corrida acusa a «alguien» de haber
    # cambiado el archivo por afuera cuando el que lo cambió fuiste vos.
    # La alarma es correcta y el motivo que da no, que es peor que no
    # avisar: manda a `--sincronizar`, o sea a deshacer tu propio cambio.
    print('   ⚠️ commiteá %s ahora: el candado compara contra git HEAD.\n'
          % ', '.join('docs/appscript_oficial/%s' % n
                      for n in sorted(cambios)))
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
