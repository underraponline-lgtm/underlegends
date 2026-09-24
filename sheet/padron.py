# -*- coding: utf-8 -*-
"""EL PADRON: quien es cada uno. La identidad, separada del rendimiento.

    from sheet.padron import cargar
    p = cargar()
    p['konan']   # {'nombre','cc','crew','discord_id','verificado','sv'}

    python sheet/padron.py           cuanto cubre, medido
    python sheet/padron.py --paises  el emoji del nombre contra la columna
    python sheet/padron.py --liga    «verificado» contra «compitió»

🔴 POR QUE EXISTE: IDENTIDAD Y RENDIMIENTO SON DOS COSAS Y VENIAN JUNTAS.

Los dos builders sacan TODO del Oficial, que es una tabla de rendimiento.
Como ahi el pais viaja **pegado al nombre como emoji**, `cc` —que las
cuatro tarjetas piden obligatorio— salia de un regex sobre el texto:

    'cc': bandera(r[col('Rapero')])

Eso funciona hasta que alguien escriba el nombre sin bandera, con dos, o
con la equivocada. Y ya pasa: medido el 20/09/2026, **tres personas tienen
en el padron un pais distinto del emoji de su nombre**.

El padron (`Lista de Raperos` del Operativo) tiene las columnas limpias:
`Nombre`, `País` en ISO, `Crew`, `Discord ID`, `Verificado`. De ahi sale la
identidad; del Oficial, solo los numeros.

⚠️ NO REEMPLAZA AL OFICIAL, LO COMPLEMENTA. El Oficial sigue siendo de
donde salen Score, eventos, puntos y las cinco dimensiones. Lo que cambia
es que el nombre, el pais y la crew dejan de deducirse.

⚠️ Y CAE CON GRACIA. Si el padron no responde o a alguien le falta el
pais, el builder se queda con lo que deducia antes. Un pipeline que se
rompe porque una hoja nueva no contesta es peor que uno que deduce.
"""
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

from comun.claves import clave                   # noqa: E402

HOJA = 'Lista de Raperos'
_CACHE = [None]

# ⚠️ EL ✅ ES EL QUE CUENTA. La columna tiene tres estados —✅ verificado,
# ❓ sin verificar, ❌ no esta en DRA— y `docs/sheet_t1.md` dice que el pool
# de la T1 se filtra por **discord_id + verificado**. Los otros dos no son
# «casi»: son «no».
VERIFICADO = '✅'


def cargar(refrescar=False):
    """{clave: {...}} de las 875 filas del padron. Se cachea."""
    if _CACHE[0] is not None and not refrescar:
        return _CACHE[0]
    from escribir import Hoja
    h = Hoja(HOJA, ojo='Rapero')
    ix = {n: i for i, n in enumerate(h.cabecera)}

    def g(f, n):
        return str(f[ix[n]]).strip() if n in ix and ix[n] < len(f) else ''

    out = {}
    for f in h.filas():
        nom = g(f, 'Nombre') or g(f, 'Rapero')
        if not nom:
            continue
        out[clave(nom)] = {
            'nombre': nom,
            'cc': g(f, 'País'),
            'crew': g(f, 'Crew'),
            'discord_id': g(f, 'Discord ID'),
            'verificado': g(f, 'Verificado') == VERIFICADO,
            'sv': g(f, 'SV'),
        }
    _CACHE[0] = out
    return out


def seguro():
    """Como `cargar()`, pero devuelve `{}` si algo falla.

    ⚠️ ES LO QUE USAN LOS BUILDERS. Sin credenciales, sin red o con la hoja
    renombrada, el pipeline tiene que seguir andando con lo que deducia
    antes — no quedarse sin pools.
    """
    try:
        return cargar()
    except Exception as e:                       # noqa: BLE001
        print('   ⚠️ no pude leer el padrón (%s): sigo deduciendo del nombre'
              % str(e)[:70])
        return {}


_A = 0x1F1E6
BANDERA_ISO = {chr(_A + ord(a) - 97) + chr(_A + ord(b) - 97): a + b
               for a in 'abcdefghijklmnopqrstuvwxyz'
               for b in 'abcdefghijklmnopqrstuvwxyz'}


def contradicciones():
    """Quien tiene un emoji de bandera que no coincide con su columna `País`.

    🔴 POR QUE IMPORTA AHORA Y NO ANTES. Hasta el 20/09 el `cc` de las
    tarjetas salia de un regex sobre el emoji del nombre; desde que la
    identidad sale del padron, **gana la columna** y el emoji queda como
    una segunda opinion que nadie mira. Las dos no pueden tener razon.

    ⚠️ SON 28 EN EL PADRON Y 3 EN EL POOL, y la diferencia es la trampa:
    medido sobre las 138 que hoy tienen tarjeta daban **tres** —Kourier,
    Andy y Leiter— y por eso ESTADO.md decia tres. Sobre las 875 del
    padron son **28**, y el padron es de donde sale la identidad de todos,
    incluidos los 309 que ya tienen carta de Pais. El numero chico era el
    de la muestra, no el del problema.

    No se arregla solo: cual de los dos es el bueno lo sabe Dlx.
    """
    import re
    filas = []
    try:
        from escribir import Hoja
        h = Hoja('Lista de Raperos')
    except Exception:                                # noqa: BLE001
        return filas
    idx = {c: n for n, c in enumerate(h.cabecera)}
    if 'País' not in idx:
        return filas
    for f in h.filas():
        f = list(f) + [''] * len(h.cabecera)
        crudo = str(f[idx.get('Rapero', 0)])
        m = re.findall(r'[\U0001F1E6-\U0001F1FF]{2}', crudo)
        emo = BANDERA_ISO.get(m[0]) if m else None
        pais = str(f[idx['País']]).strip().lower()
        if emo and pais and emo != pais:
            filas.append({
                'nombre': str(f[idx.get('Nombre', 0)]).strip() or crudo.strip(),
                'crudo': crudo.strip(), 'emoji': emo, 'columna': pais,
                'verificado': '✅' in str(f[idx.get('Verificado', 0)]),
                'discord_id': str(f[idx.get('Discord ID', 0)]).strip(),
            })
    return filas


def en_la_liga():
    """Cruza «verificado» contra «compitió», que NO son lo mismo.

    🔴 ESTADO.md PIDE «separar verificado de en la Liga» Y NO DICE POR
    QUE. Estos son los números, medidos el 20/09/2026, y explican el
    pedido solos:

        en el padrón                         875
        compitieron alguna vez (Ev > 0)      735
        verificados ✅                        339
        ✅ Y compitieron                      243
        verificados que NUNCA compitieron     96

    ⚠️ **`✅ + Discord ID = 332` es el corte que `padron.py` llama «pueden
    tener tarjeta», y falla en LAS DOS DIRECCIONES**: deja afuera a **492
    que sí compitieron** y mete a **96 que nunca compitieron**.

    ⚠️ Y son dos preguntas distintas, no una mal medida. «Verificado» es
    *sé quién sos* —alguien ató su Discord a su nombre de rapero en DRA—
    y «en la Liga» es *competís*. Un rapero de otro servidor compite sin
    pasar nunca por la verificación de DRA; alguien de DRA se verifica y
    no compite nunca. Juntarlas en un solo ✅ obliga a elegir cuál de las
    dos se rompe.

    **No se decide acá**: cuál manda para emitir una tarjeta es de Dlx.
    Esto mide para que la decisión se tome mirando los cuatro números.
    """
    import re
    import requests
    from escribir import token, Hoja
    from comun.claves import clave
    h = Hoja('Lista de Raperos')
    idx = {c: n for n, c in enumerate(h.cabecera)}
    API = 'https://sheets.googleapis.com/v4/spreadsheets'
    # ⚠️ el ID vive en `planillas.py`: la T1 estrena planilla y una copia
    # suelta lee la vieja sin fallar. Ver el encabezado de ese modulo.
    from planillas import OFICIAL as OF
    # 🔴 LA CABECERA SE BUSCA, NO SE CLAVA (ver CLAUDE.md). Esto leía
    # `A16:F` —la fila de la pre-temporada— y hoy la cabecera está en la
    # 1: la primera fila de datos se tomaba por cabecera y `index('Rapero')`
    # reventaba. Y sin mirar la respuesta, un 429 era una tabla vacía.
    import rankings as _R
    v = _R._leer(OF, 'Ranking Temporada!A%d:F'
                 % _R.fila_cabecera('Ranking Temporada'))
    cab2 = [str(x).strip() for x in v[0]]
    iR, iE = cab2.index('Rapero'), cab2.index('Ev')
    compitio = {}
    for f in v[1:]:
        f = list(f) + [''] * 6
        n = re.sub(r'[\U0001F1E6-\U0001F1FF]', '', str(f[iR])).replace('❓', '')
        try:
            ev = int(float(str(f[iE]).replace(',', '') or 0))
        except ValueError:
            ev = 0
        if n.strip():
            compitio[clave(n.strip())] = ev

    r = {'padron': 0, 'ver': 0, 'did': 0, 'corte': 0, 'compi': 0,
         'ver_compi': 0, 'ver_sin_compi': 0, 'compi_sin_ver': 0}
    for f in h.filas():
        f = list(f) + [''] * len(h.cabecera)
        def g(c):
            return str(f[idx[c]]).strip() if c in idx else ''
        nom = g('Nombre') or g('Rapero')
        if not nom.strip():
            continue
        V, D = '✅' in g('Verificado'), bool(g('Discord ID'))
        E = compitio.get(clave(nom), 0) > 0
        r['padron'] += 1
        r['ver'] += V
        r['did'] += D
        r['corte'] += (V and D)
        r['compi'] += E
        r['ver_compi'] += (V and E)
        r['ver_sin_compi'] += (V and not E)
        r['compi_sin_ver'] += (E and not V)
    return r


def main():
    if '--liga' in sys.argv:
        r = en_la_liga()
        print('\n══ «VERIFICADO» NO ES «EN LA LIGA» ══\n')
        for k, etq in (('padron', 'en el padrón'),
                       ('compi', 'compitieron alguna vez (Ev > 0)'),
                       ('ver', 'verificados ✅'),
                       ('did', 'con Discord ID'),
                       ('corte', '✅ + Discord ID — el corte de hoy'),
                       ('ver_compi', '✅ Y compitieron')):
            print('   %-38s %4d' % (etq, r[k]))
        print('\n   🔴 el corte de hoy falla en las DOS direcciones:')
        print('   %-38s %4d' % ('compitieron y NO están verificados',
                                r['compi_sin_ver']))
        print('   %-38s %4d' % ('verificados que NUNCA compitieron',
                                r['ver_sin_compi']))
        print('\n   ⚠️ Son dos preguntas distintas, no una mal medida:')
        print('      «verificado» es *sé quién sos*, «en la Liga» es *competís*.')
        print('      Cuál manda para emitir una tarjeta lo decide Dlx.\n')
        return 0

    if '--paises' in sys.argv:
        c = contradicciones()
        print('\n══ EL EMOJI DEL NOMBRE CONTRA LA COLUMNA `País` ══\n')
        print('   %d contradicción(es) en el padrón\n' % len(c))
        print('   %-14s %-18s %-7s %-7s %s'
              % ('nombre', 'como figura', 'emoji', 'columna', 'ident.'))
        for r in c:
            print('   %-14s %-18s %-7s %-7s %s'
                  % (r['nombre'][:14], r['crudo'][:18], r['emoji'],
                     r['columna'],
                     ('✅ ' if r['verificado'] else '   ')
                     + ('id' if r['discord_id'] else '--')))
        print('\n   ⚠️ Hoy gana la COLUMNA: la identidad sale del padrón.')
        print('      Cuál de los dos es el bueno no lo puede decidir un script.')
        print('      En el pool de 138 son 3; el resto ya tiene carta de País.\n')
        return 0

    p = cargar()
    con = lambda k: sum(1 for d in p.values() if d.get(k))    # noqa: E731
    print('\n══ EL PADRÓN ══\n')
    print('   %-26s %4d' % ('personas', len(p)))
    for k, etq in (('cc', 'con país (ISO)'), ('crew', 'con crew'),
                   ('discord_id', 'con Discord ID'), ('sv', 'con servidor'),
                   ('verificado', 'verificados ✅')):
        n = con(k)
        print('   %-26s %4d   %5.1f %%' % (etq, n, 100.0 * n / max(1, len(p))))
    listos = [k for k, d in p.items() if d['discord_id'] and d['verificado']]
    print('\n   🎴 EL CORTE DE IDENTIDAD PROPUESTO PARA LA T1')
    print('   %-26s %4d   ← discord_id + verificado' % ('lo cumplen',
                                                        len(listos)))
    # ⚠️ ACA DECIA «pueden tener tarjeta» Y ES MAS DE LO QUE ESE NUMERO
    # SABE. Medido el 20/09/2026, ese corte deja afuera a 492 que SI
    # compitieron y mete a 96 que nunca compitieron: `--liga` lo muestra.
    # Llamarlo «pueden tener tarjeta» convierte una propuesta sin decidir
    # en un hecho, y este repo ya tiene tres casos de eso.
    print('   %-26s %4s   ⚠️ es una PROPUESTA, no está decidido:'
          % ('', ''))
    print('   %-26s %4s      `python sheet/padron.py --liga`' % ('', ''))
    print('')


if __name__ == '__main__':
    main()
