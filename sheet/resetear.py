# -*- coding: utf-8 -*-
"""EL RESET DE TEMPORADA: borra los NUMEROS de la pre, no la identidad.

    python sheet/resetear.py             que borraria, SIN tocar nada
    python sheet/resetear.py --aplicar   lo hace (pide respaldo antes)

🔴 ESTO NO SE HACE A MANO, Y POR ESO ES UN SCRIPT.

Dlx, 21/09/2026: *«puedes ir borrando los datos de los sheets. Ojo los
datos refiriendome a los numeros en mayor parte y eventos de la
pretemporada»*. La distincion **numero vs identidad** es toda la
dificultad: el Sheet tiene las dos cosas mezcladas en la misma planilla,
y borrar una de mas es irreversible.

    se borra   los cuatro rankings, los eventos y los puntos MW
    NO se toca la Lista de Raperos (876), los AKAs (189) y Config (57)

⚠️ **`Lista de Raperos` ES LA IDENTIDAD Y VALE MAS QUE TODO LO DEMAS.**
Son 876 personas con su Discord ID, su pais y su crew — lo unico del
Sheet que **no se puede reconstruir** desde afuera. Los rankings salen de
volver a procesar eventos; un Discord ID perdido se pierde. Es la misma
regla que la carta: *«la bandera es identidad, el numero es ranking»*.

⚠️ **`Config` TAMPOCO**, aunque parezca de la pre: ahi viven los umbrales
de rango y las tablas de puntos, que es justamente lo que la T1 necesita
para arrancar.

⚠️ **`Ranking Mundial` TAMPOCO.** Tiene 82 filas y parece de la pre, pero
son las **selecciones por pais**, que arrancan en T2 — y de ahi sale el
Score Seleccion con el que `04_Pais` calcula el OVR Nacional.

QUE PASA CON LAS CARTAS, QUE ES LO QUE DLX PREGUNTO
----------------------------------------------------
*«pero no las tarjetas porque eso si va tomar tiempo me imagino no?»*.
Bien visto, y la respuesta tiene dos mitades:

**La Temporada y la Competitiva no hay que redibujarlas ni borrarlas.**
Desde el 21/09 `bot/subir_datos.py` arma `cs` con el REQUISITO y no con
el inventario de R2: con los numeros en cero nadie llega, `cs` las
suelta, `bl` toma su lugar y el bot pasa a servir la Bloqueada. El
archivo viejo se queda arriba sin que nadie lo pida.

**La de Pais y la de Servidor SI.** Su requisito no es un numero —tener
pais, y nada— asi que se siguen emitiendo, con los numeros de la pre
adentro, hasta que se redibujen. Medido: ~1,3 min por persona, 469
personas, **unas 10 horas** de Actions repartidas en varios dias de
tandas. Eso es el «va a tomar tiempo».

⚠️ **Y HAY QUE DIBUJAR LAS BLOQUEADAS ANTES DE BORRAR**, o la gente se
queda sin boton en el hueco. `bloqueada()` del Worker es «esta en `bl` y
no en `cs`»: si `cs` la suelta y `bl` no la tiene, el boton desaparece
—que quiere decir «no existe»— en vez de explicar que falta. Por eso el
paso 1 de este script es correr `bot/bloqueadas.py --generar`.

EL ORDEN, Y NO ES NEGOCIABLE
-----------------------------
    1. respaldo completo de las dos planillas
    2. las Bloqueadas que falten, dibujadas y subidas
    3. recien ahi, borrar
    4. un ciclo con `--sin-pools` para aceptar la caida del pool
    5. las tandas redibujan Pais y Servidor solas, en varios dias

⚠️ El paso 4 existe porque el ciclo tiene un guardian: si el pool cae mas
del 20 % **frena**, que es lo correcto —protege de un Sheet a medio
editar— y justo acá la caida es de verdad.

EL CAMINO DESTRUCTIVO, PROBADO SIN DESTRUIR NADA (21/09/2026)
--------------------------------------------------------------
`--aplicar` borra 1.634 filas y **nunca corrio**. Un borrado sin probar
es la peor clase de codigo sin probar, asi que se verifico por partes:

  · el endpoint `:clear` se llamo sobre `Entrada!A500:Z`, un rango que
    esta **garantizado vacio** —la hoja tiene 17 filas—. Contesto bien y
    dejo 0 filas donde habia 0: prueba la URL, la autenticacion y el
    formato del rango sin tocar un dato.
  · con un nombre de hoja inexistente, `cuantas()` devuelve el error y
    `main()` hace `return 1` **antes** del primer `limpiar()`.
    Verificado por posicion en el codigo, no de memoria.

⚠️ Lo que sigue sin probarse es el borrado de verdad, y no hay forma de
probarlo sin hacerlo. Por eso el paso 1 de la lista es el respaldo, y
por eso el script se niega a correr si no hay uno.
"""
import io
import json
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

import requests                                          # noqa: E402

API = 'https://sheets.googleapis.com/v4/spreadsheets'
CREDS = os.path.join(BASE, 'creds.json')

# (planilla, hoja, desde que fila se limpia)
#
# ⚠️ `desde` NO ES 1 EN NINGUNA. Todas tienen cabecera —y varias tienen
# un panel de filtros arriba— y borrarla dejaria la hoja sin columnas:
# los builders leen por nombre de columna, asi que una hoja sin cabecera
# no da error, da cero filas. Es el mismo modo de fallar que ya costo una
# vuelta en `escribir.Hoja`.
A_BORRAR = [
    ('oficial',   'Ranking Temporada',   17),
    ('oficial',   'Ranking Competitivo', 13),
    ('oficial',   'Ranking Podios',      12),
    ('oficial',   'Ranking de Ligas',    10),
    ('operativo', 'Eventos Procesados',   6),
    ('operativo', 'MW Puntos',            2),
]

# lo que NO se toca, escrito para que se vea en la salida y nadie tenga
# que ir a buscarlo al codigo
INTOCABLES = [
    ('Lista de Raperos', 'la identidad: 876 con Discord ID, pais y crew'),
    ('AKAs',             'los alias, 189'),
    ('Config',           'umbrales de rango y tablas de puntos'),
    ('Ranking Mundial',  'las selecciones — arrancan en T2'),
    ('Entrada',          'el buzon del bot'),
    ('Pendientes',       'la cola de revision'),
    ('Lobby · Guía · Mi Perfil', 'la pagina publica'),
]


def token():
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
    cr = service_account.Credentials.from_service_account_file(
        CREDS, scopes=['https://www.googleapis.com/auth/spreadsheets'])
    cr.refresh(Request())
    return cr.token


def ids():
    """Las dos planillas. Salen de `sheet/planillas.py`, no de aca.

    ⚠️ ACA HABIA UN CAMINO MUERTO Y UN ID CLAVADO. La primera version
    leia `datos/sheets.json` —que **no existe**— y se caia a una copia
    del ID escrita a mano. O sea que el `if` no se ejecutaba nunca y la
    septima copia de la misma cadena de 44 caracteres se colaba igual.
    Un fallback que es el unico camino no es un fallback.
    """
    from planillas import OFICIAL, operativo
    return {'oficial': OFICIAL, 'operativo': operativo()}


def cuantas(tk, sid, hoja, desde):
    r = requests.get('%s/%s/values/%s!A%d:Z' % (API, sid,
                                                requests.utils.quote(hoja),
                                                desde),
                     headers={'Authorization': 'Bearer ' + tk}, timeout=60)
    if r.status_code >= 300:
        return None, '%s %s' % (r.status_code, r.text[:90])
    v = r.json().get('values', [])
    return sum(1 for f in v if any(str(c).strip() for c in f)), None


def limpiar(tk, sid, hoja, desde):
    r = requests.post('%s/%s/values/%s!A%d:Z:clear'
                      % (API, sid, requests.utils.quote(hoja), desde),
                      headers={'Authorization': 'Bearer ' + tk},
                      json={}, timeout=90)
    if r.status_code >= 300:
        raise RuntimeError('%s: %s %s' % (hoja, r.status_code, r.text[:140]))
    return True


def hay_respaldo():
    """El respaldo mas nuevo de cada planilla, o None."""
    import glob
    out = {}
    for etq in ('oficial', 'operativo'):
        fs = sorted(glob.glob(os.path.join(BASE, 'docs', 'sheet_respaldo',
                                           'COMPLETO_%s_*.json' % etq)))
        out[etq] = os.path.basename(fs[-1]) if fs else None
    return out


def main():
    aplicar = '--aplicar' in sys.argv
    print('\n══ RESET DE TEMPORADA ══\n')

    rp = hay_respaldo()
    for etq, f in rp.items():
        print('   respaldo %-10s %s' % (etq, f or '🔴 NO HAY'))
    if not all(rp.values()):
        print('\n   🔴 falta respaldo. Corré `python sheet/respaldar.py`.\n')
        return 1

    tk, sid = token(), ids()
    print('\n   ── se va a BORRAR ──')
    total = 0
    for pl, hoja, desde in A_BORRAR:
        n, err = cuantas(tk, sid[pl], hoja, desde)
        if err:
            print('   🔴 %-22s %s' % (hoja, err))
            return 1
        total += n
        print('   %-10s %-22s %4d fila(s)  (desde la %d)'
              % (pl, hoja, n, desde))
    print('   %s %d filas en total' % (' ' * 33, total))

    print('\n   ── NO se toca ──')
    for nom, por in INTOCABLES:
        print('   %-26s %s' % (nom[:26], por))

    # 🔴 LAS BLOQUEADAS VAN PRIMERO, Y AHORA SE PREGUNTA EN VEZ DE
    # PEDIRLO POR ESCRITO. Esto decía «⚠️ antes de aplicar, corré
    # bloqueadas --generar» y nada más: un orden que vive en una línea
    # de salida es un orden que alguien invierte el día del reset, que
    # es justo cuando no hay deshacer. Sin las Bloqueadas publicadas,
    # al caer el requisito `cs` suelta la carta, `bl` no la tiene, y a
    # esa gente se le va el botón.
    #
    # ⚠️ NO FRENA EL SIMULACRO. Se informa siempre y se bloquea sólo el
    # `--aplicar`: la gracia del simulacro es poder mirarlo antes de
    # tener todo listo.
    falta_bl = None
    try:
        sys.path.insert(0, os.path.join(BASE, 'bot'))
        import bloqueadas as BL
        n, tot = BL.faltan_en_r2()
        falta_bl = n
        print('\n   Bloqueadas en R2   %d de %d  %s'
              % (tot - n, tot, '✅' if not n else '🔴 faltan %d' % n))
    except Exception as e:                               # noqa: BLE001
        print('\n   Bloqueadas en R2   ·  no pude preguntar (%s)'
              % str(e)[:50])

    if not aplicar:
        print('\n   (simulacro: no toqué nada — corré con --aplicar)')
        print('   ⚠️ Antes de aplicar: `python bot/bloqueadas.py --generar`')
        print('      o la gente se queda sin botón. Ver el encabezado.\n')
        return 0

    # ⚠️ Y SI NO SE PUDO PREGUNTAR, TAMPOCO. `None` no es «están»: un
    # chequeo que se saltea cuando falla no es un chequeo.
    if falta_bl is None or falta_bl:
        print('\n   🔴 No reseteo. %s'
              % ('faltan %d Bloqueadas en R2' % falta_bl if falta_bl
                 else 'no pude comprobar las Bloqueadas'))
        print('      Corré `python bot/bloqueadas.py --generar` primero.')
        print('      (`--igual` para resetear sin ellas, a sabiendas)\n')
        if '--igual' not in sys.argv:
            return 1
        print('      … `--igual`: sigo.\n')

    print('\n   borrando…')
    for pl, hoja, desde in A_BORRAR:
        limpiar(tk, sid[pl], hoja, desde)
        n, _ = cuantas(tk, sid[pl], hoja, desde)
        # ⚠️ SE VERIFICA LEYENDO. Un 200 dice que la API acepto el pedido,
        # no que la hoja quedo vacia.
        print('   %s %-22s -> %d fila(s)' % ('✅' if not n else '🔴', hoja, n))
    print('\n   Ahora, en este orden:')
    print('     1. python bot/pipeline.py --correr --sin-pools   (aceptar la caída)')
    print('     2. las tandas redibujan País y Servidor solas\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
