# -*- coding: utf-8 -*-
"""LO QUE MUESTRA LA WEB CONTRA LA `Lista de Raperos`.

    python herramientas/web_vs_padron.py          contra la web en vivo
    python herramientas/web_vs_padron.py --local  contra el payload local

🔴 POR QUE EXISTE. Dlx, 24/09/2026: *«quiero que sigas comparando la lista
de raperos donde se supone que está la gran mayoría, sus IDs y sus AKAs,
con la página que estamos haciendo»*.

Es una pregunta que se repite cada vez que entran eventos, así que no
puede vivir en una consulta suelta: **lo que no se pregunta no se entera
de que cambió**. La misma razón por la que existe
`herramientas/roles_de_rango.py`.

QUE CONTESTA, Y SON CUATRO PREGUNTAS DISTINTAS
----------------------------------------------
1. **Quién sale en la web y no está en el padrón.** Son los que nadie
   registró: o es gente nueva de verdad, o es un nombre que el lector de
   llaves inventó. Los dos casos piden acción y son distintos.

2. **Quién sale con un nombre que no es su AKA.** El padrón tiene
   `Nombre` —cómo se escribe de verdad— y la web muestra lo que quedó en
   `Resultados`. Si no coinciden, la persona se ve a sí misma con otro
   nombre.

3. **Quién tiene Discord ID y quién no.** Sin ID no hay carta: el portón
   de identidad la pide. Un rapero con puntos y sin ID es alguien que
   compite y no puede recibir nada.

4. **Quién está en el padrón con eventos y NO sale en la web.** Es el
   error que menos se nota y el que más duele: alguien compitió y no
   aparece en ningún lado.

⚠️ **EL NOMBRE SE COMPARA NORMALIZADO Y POR ALIAS**, no letra a letra.
`Makma` y `Makmah` son la misma persona y hay 186 alias declarados: una
comparación cruda diría que nueve personas no están cuando sí están.
"""
import io
import json
import os
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
WEB = 'https://underlegends.pages.dev/api/lobby'

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass


def norm(s):
    s = unicodedata.normalize('NFKD', str(s or ''))
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return ''.join(c for c in s.lower() if c.isalnum())


def _j(*p):
    try:
        with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def alias():
    return ((_j('datos', 'akas.json') or {}).get('alias') or {})


def canon(n, al):
    """El nombre real, o el mismo. Ver `sheet/rankings.canon`."""
    return al.get(norm(n)) or n


def payload(local):
    if local:
        sys.path.insert(0, os.path.join(BASE, 'bot'))
        sys.path.insert(0, BASE)
        import subir_web as W
        return W.armar()
    import requests
    return requests.get(WEB, timeout=30).json()


def _no_confundir(norm):
    """Los pares ya declarados como DOS personas, normalizados.

    Devuelve un set con las dos direcciones, para poder preguntar sin
    ordenar. Sale de `datos/akas.json`, que es donde
    `sheet/construir_akas.py` mezcla la hoja `AKAs` del Operativo con
    `datos/akas_a_mano.json` —lo que Dlx dijo por chat—.
    """
    import io as _io
    import json as _json
    import os as _os
    p = _os.path.join(BASE, 'datos', 'akas.json')
    try:
        with _io.open(p, encoding='utf-8') as f:
            d = _json.load(f) or {}
    except (OSError, ValueError):
        # ⚠️ SIN EL ARCHIVO SE SIGUE. Perder el chequeo entero porque
        # falta un json es peor que repetir un aviso.
        return set()
    out = set()
    for par in (d.get('no_confundir') or []):
        if len(par) >= 2:
            a, b = norm(par[0]), norm(par[1])
            if a and b:
                out.add((a, b))
                out.add((b, a))
    return out


def main():
    d = payload('--local' in sys.argv)
    pad = _j('datos', 'padron.json') or []
    al = alias()
    tabla = d.get('tabla') or []

    # el padrón, por nombre normalizado y también por su canónico
    por = {}
    for x in pad:
        k = norm(x.get('raw'))
        if k:
            por[k] = x
    ids = {norm(x.get('raw')): (x.get('discord_id') or '') for x in pad}

    print('\n══ LA WEB CONTRA `Lista de Raperos` ══\n')
    print('   web: %d personas   ·   padrón: %d filas\n' % (len(tabla),
                                                            len(pad)))

    sin_padron, otro_nombre, sin_id = [], [], []
    for f in tabla:
        n = f.get('n') or ''
        k = norm(n)
        p = por.get(k) or por.get(norm(canon(n, al)))
        if not p:
            sin_padron.append(f)
            continue
        # el AKA: `Nombre` del padrón es cómo se escribe de verdad
        real = (p.get('raw') or '').strip()
        if norm(real) != k:
            otro_nombre.append((n, real))
        if not (p.get('discord_id') or '').strip():
            sin_id.append((n, f.get('pts'), f.get('ev')))

    # 4 · quién compitió y no sale
    en_web = {norm(f.get('n')) for f in tabla}
    en_web |= {norm(canon(f.get('n'), al)) for f in tabla}

    print('   1 · SALEN EN LA WEB Y NO ESTAN EN EL PADRON: %d' %
          len(sin_padron))
    for f in sin_padron[:14]:
        print('        %-24s %6s pts  %s ev' % (str(f.get('n'))[:24],
                                                f.get('pts'), f.get('ev')))
    if len(sin_padron) > 14:
        print('        … y %d más' % (len(sin_padron) - 14))
    if sin_padron:
        print('        -> o son nuevos de verdad, o el lector de llaves los')
        print('           inventó. Los dos casos piden acción y son distintos.')

    print('\n   2 · SE MUESTRAN CON OTRO NOMBRE QUE EL DEL PADRON: %d'
          % len(otro_nombre))
    for n, real in otro_nombre[:14]:
        print('        la web dice %-20s el padrón %s' % (n[:20], real[:24]))

    print('\n   3 · SIN DISCORD ID, O SEA SIN NINGUNA CARTA: %d de %d'
          % (len(sin_id), len(tabla)))
    for n, pts, ev in sorted(sin_id, key=lambda x: -(x[1] or 0))[:14]:
        print('        %-24s %6s pts  %s ev' % (n[:24], pts, ev))
    if len(sin_id) > 14:
        print('        … y %d más' % (len(sin_id) - 14))

    # los del padrón que tienen ID y NO salen: sólo cuenta si compitieron
    pool = _j('datos', 'temporada_pool.json') or []
    pool = pool.get('pool', pool) if isinstance(pool, dict) else pool
    faltan = []
    for x in pool:
        k = norm(x.get('raw'))
        if k and k not in en_web and (x.get('ev') or 0) > 0:
            faltan.append((x.get('raw'), x.get('ev'), x.get('pts')))
    print('\n   4 · ESTAN EN EL POOL CON EVENTOS Y NO SALEN EN LA WEB: %d'
          % len(faltan))
    for n, ev, pts in faltan[:14]:
        print('        %-24s %s ev  %s pts' % (str(n)[:24], ev, pts))
    if faltan:
        print('        -> compitieron y no aparecen en ningún lado.')

    # ── 5 · el que sigue, y es el que Dlx pidió ──────────────────────
    #
    # 🔴 «¿ESTA ESTE NOMBRE EN EL PADRON?» NO ES LA PREGUNTA COMPLETA. La
    # otra mitad es **«¿hay un nombre en el padrón que sea obviamente el
    # mismo?»**, y sin ella la sección 1 lista a gente que sí está,
    # escrita distinto.
    #
    # Dlx, 24/09/2026: *«esos nombres deberían ser los que aparecen en la
    # lista de raperos del Sheet operativo, ya que ese es su oficial AKA.
    # Luego en AKAs comparar a ver si se le reconoce con otro AKA»*. Y el
    # caso que lo destapó: *«Fokox es Focox de México, de una te digo»*.
    #
    # ⚠️ PROPONE, NO DECIDE. `Fokox` está a una letra de `Focox` (México)
    # **y a dos de `Focus` (Perú)**. Un parecido a ciegas habría elegido
    # uno de los dos y acertado la mitad de las veces — y el costo de
    # errar no es cosmético: el alias le da a alguien los puntos de otro.
    # Con dos candidatos, va a la lista para mirar.
    import difflib
    nombres_pad = {norm(x.get('raw')): x for x in pad if norm(x.get('raw'))}
    NO_CONFUNDIR = _no_confundir(norm)
    claros, ambiguos = [], []
    for f in sin_padron:
        k = norm(f.get('n'))
        # ⚠️ 0.76 Y NO 0.82. Con 0.82 se escapaba justo el caso que
        # Dlx nombró: `fokox` contra `focox` da **0.80** — cinco letras
        # con una distinta. Un corte que deja afuera el ejemplo que
        # motivó el chequeo está mal elegido.
        #
        # ⚠️ Bajarlo sube los ambiguos, y eso es lo correcto: un ambiguo
        # se mira, un falso positivo le da a alguien los puntos de otro.
        cerca = difflib.get_close_matches(k, list(nombres_pad), n=3,
                                          cutoff=0.76)
        # 🔴 Y SE SACAN LOS QUE YA SE DECLARARON DISTINTOS. Sin esto
        # el chequeo vuelve a proponer el mismo par en cada corrida,
        # aunque Dlx ya haya contestado — `JAHNO`/`Juano` salio dos dias
        # seguidos despues de que dijera *«esas si son 2 personas
        # diferentes»*. `datos/akas.json` tiene una lista `no_confundir`
        # para exactamente esto y este archivo no la leia: la decision
        # estaba tomada y escrita, y el codigo miraba otro lado.
        #
        # ⚠️ UN AVISO QUE VUELVE DESPUES DE CONTESTARLO ENSEÑA A
        # IGNORARLO, que es la leccion de `_mismo()` y la de los 188 del
        # audit. El costo no es el ruido: es el dia que aparezca un par
        # de verdad.
        cerca = [c for c in cerca if (k, c) not in NO_CONFUNDIR]
        if len(cerca) == 1:
            claros.append((f, nombres_pad[cerca[0]]))
        elif len(cerca) > 1:
            ambiguos.append((f, [nombres_pad[c] for c in cerca]))

    print('\n   5 · DE LOS QUE «NO ESTAN», SE PARECEN A ALGUIEN QUE SI: %d'
          % (len(claros) + len(ambiguos)))
    # ⚠️ Y SI LOS PAISES NO COINCIDEN, NO ES UN MATCH CLARO. Es el
    # criterio que `datos/akas.json` ya usa como motivo en su lista de
    # NO CONFUNDIR —«País diferente» aparece cuatro veces ahí— así que no
    # hace falta inventar ninguna regla: alcanza con aplicar la que está.
    # El caso de hoy: `JAHNO` es 🇦🇷 y `Juano` es de España.
    ISO = {'Argentina': 'ar', 'Bolivia': 'bo', 'Chile': 'cl',
           'Colombia': 'co', 'Ecuador': 'ec', 'España': 'es',
           'Estados Unidos': 'us', 'Guatemala': 'gt', 'Honduras': 'hn',
           'México': 'mx', 'Panamá': 'pa', 'Perú': 'pe',
           'Puerto Rico': 'pr', 'República Dominicana': 'do',
           'Uruguay': 'uy', 'Venezuela': 've'}
    for f, p in list(claros):
        a, b = (f.get('cc') or ''), ISO.get(p.get('pais') or '', '')
        if a and b and a != b:
            claros.remove((f, p))
            ambiguos.append((f, [p]))
    for f, p in claros:
        print('        %-20s -> %-16s %-12s %s'
              % (str(f.get('n'))[:20], str(p.get('raw'))[:16],
                 str(p.get('pais') or '—')[:12],
                 'con ID' if p.get('discord_id') else 'sin ID'))
    for f, ps in ambiguos:
        por = ('el país no coincide' if len(ps) == 1
               else 'se parece a %d' % len(ps))
        print('        %-20s ⚠️ %s: %s — no lo decido'
              % (str(f.get('n'))[:20], por,
                 ' y a '.join('%s (%s)' % (p.get('raw'), p.get('pais') or '?')
                              for p in ps)))
    if claros:
        print('        -> se declaran en `datos/akas_a_mano.json`, en `pares`,')
        print('           y `sheet/construir_akas.py` los mezcla.')

    print('')
    mal = len(sin_padron) + len(faltan)
    print('   %s\n' % ('✅ todos los de la web están en el padrón y '
                       'todos los que compiten salen'
                       if not mal else
                       '🔴 %d para mirar (%d sin padrón, %d que no salen)'
                       % (mal, len(sin_padron), len(faltan))))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
