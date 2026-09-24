# -*- coding: utf-8 -*-
"""ESCRIBIR EN EL SHEET DESDE EL PIPELINE. La pieza que no existia.

    python sheet/escribir.py --ver                que hojas hay y donde arrancan
    python sheet/escribir.py --probar             escribe y borra una fila de prueba

Como modulo, que es para lo que existe:

    from sheet.escribir import Hoja
    h = Hoja('Resultados')
    h.agregar([[349, '20/09', 'DRA', '16+', 'Konan', 'ar', '1ro', 120, '', 120, '']])
    h.borrar_evento(349)          # idempotencia: saca las filas de ese evento

🔴 POR QUE EXISTE. Los tres scripts de `sheet/` piden
`spreadsheets.readonly`: leen el Sheet y escriben JSON local. Eso alcanzaba
mientras el Sheet era la fuente y alguien lo llenaba a mano. Con el bot
detectando eventos y subiendolos, hace falta el camino de vuelta.

⚠️ LA CUENTA SI PUEDE ESCRIBIR, y `docs/sheet_t1.md` decia que no. Esa
frase describia **lo que piden los scripts**, no lo que la cuenta tiene.
Medido el 20/09/2026 con un `batchUpdate` vacio: da **400 por el payload**,
no 403 por permiso.

LAS TRES PROTECCIONES, Y NINGUNA ES PARANOIA
---------------------------------------------
1. ⚠️ **NO ESCRIBE SALVO QUE SE LO PIDAN.** El default de `agregar()` es
   `dry=True`: dice cuantas filas pondria y donde, y no toca nada. Un script
   de escritura cuyo default escribe es un `rm` sin `-i`.

2. 🔴 **LA CABECERA SE BUSCA, NO SE SUPONE.** Cada hoja de este Sheet
   arranca en una fila distinta —`Lista de Raperos` en la 9, `Resultados` y
   `1v1` en la 3, `Eventos Procesados` en la 5— porque todas tienen banner
   arriba. Suponer la fila 1 no da error: **escribe encima del banner**.
   Ya me paso leyendo: supuse la 1 y el padron de 875 salio «vacio».

3. ⚠️ **EL ANCHO SE VERIFICA CONTRA LA CABECERA.** Mandar 9 valores a una
   hoja de 11 columnas no falla: deja las dos ultimas vacias y la fila entra
   corrida. `agregar()` corta antes si no coinciden.
"""
import io
import os
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

API = 'https://sheets.googleapis.com/v4/spreadsheets'
CREDS = os.path.join(BASE, 'creds.json')

# 🔴 EL ID NO SE ESCRIBE A MANO. Sale del `parentId` del proyecto de Apps
# Script, que es donde Google guarda a que planilla esta atado. Un ID a mano
# que exista apunta a otra planilla y **no avisa** — este repo ya se comio un
# `404 Unknown Guild` por eso mismo con Discord, y ese al menos fallo.
from explorar_operativo import id_operativo      # noqa: E402

_TOKEN = [None]


def token():
    if _TOKEN[0] is None:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
        cr = service_account.Credentials.from_service_account_file(
            CREDS, scopes=['https://www.googleapis.com/auth/spreadsheets'])
        cr.refresh(Request())
        _TOKEN[0] = cr.token
    return _TOKEN[0]


#: cuántas veces reintentar un 429, y cuánto esperar entre intentos.
#: ⚠️ La cuota de Sheets es **por minuto**, así que esperar sirve de
#: verdad: no es una falla, es un «ahora no».
# ⚠️ HASTA 90 s, Y NO 45: después de una ráfaga Google sigue
# diciendo 429 más de un minuto. Medido el 24/09/2026 a las 12:23 PM
# ET: del primer 429 al último pasaron 93 s con cinco intentos, y el
# paso de las vitrinas murió igual. El trabajo tiene 20 min de techo
# y tarda ~6: la paciencia entra.
REINTENTOS = (5, 15, 30, 60, 90)


def _pedir(metodo, ruta, **kw):
    """Un pedido a la API del Operativo, con reintento si la cuota dice basta.

    🔴 UN 429 TUMBABA EL CICLO ENTERO, y no es una falla: la cuota de
    lectura de Sheets es **por minuto**. Medido el 23/09/2026: el ciclo
    murió en el paso 2 con *«Quota exceeded for quota metric Read
    requests per minute»* **después** de haber cargado dos eventos y
    escrito las cinco vitrinas — o sea que tiró a la basura trabajo ya
    hecho por un límite que se pasa solo en sesenta segundos.

    ⚠️ Y EL CICLO AHORA LEE MUCHO MÁS QUE ANTES: cinco vitrinas, cada
    una con su cabecera y su verificación, más los builders. Llegar a la
    cuota dejó de ser raro, así que aguantarlo no es un lujo.

    ⚠️ SOLO SE REINTENTA EL 429 Y EL 5xx. Un 400 o un 404 no mejoran
    esperando: reintentarlos esconde el error real detrás de un minuto
    de espera.
    """
    import time
    for i, espera in enumerate((0,) + REINTENTOS):
        if espera:
            time.sleep(espera)
        r = requests.request(metodo, '%s/%s%s' % (API, id_operativo(), ruta),
                             headers={'Authorization': 'Bearer ' + token()},
                             timeout=90, **kw)
        if r.status_code < 300:
            return r.json() if r.content else {}
        if r.status_code != 429 and r.status_code < 500:
            break
        if i < len(REINTENTOS):
            print('   ⏳ Sheets dijo %d; espero %ds y reintento (%d/%d)'
                  % (r.status_code, REINTENTOS[i], i + 1, len(REINTENTOS)))
    try:
        m = r.json().get('error', {}).get('message', '')
    except ValueError:
        m = r.text[:200]
    raise RuntimeError('%s %s -> %s: %s' % (metodo, ruta, r.status_code, m[:200]))


def poner(a1, filas):
    """Escribe un rango y **comprueba leyendo** que quedó lo que se mandó.

    🔴 POR QUE NO ALCANZA CON EL 200. Una **celda combinada se traga los
    valores en silencio**: escribís cuatro, la API contesta
    `updatedCells: 4`, y sólo queda el primero. El resto desaparece sin un
    solo error.

    Pasó el 20/09/2026 escribiendo los ocho rangos en `Config`: la fila de
    `E` cayó sobre `T13:W13`, que estaba fusionada porque ahí vivía el
    título de otro bloque. Quedó `E` sola, sin su umbral, y los dos
    reportes —el de la API y el mío— decían que había salido bien.

    ⚠️ Es la misma forma que el resto del repo: **verificar el resultado y
    no el proceso**. El exportador de PNG mira las cuatro esquinas del
    archivo en vez de confiar en que el navegador respondió.
    """
    # por `_pedir()`: un 429 es «esperá», no «falló»
    _pedir('PUT', '/values/%s?valueInputOption=RAW' % requests.utils.quote(a1),
           json={'values': filas})
    leido = _pedir('GET', '/values/%s' % requests.utils.quote(a1)).get('values', [])
    malas = []
    for i, esperada in enumerate(filas):
        real = leido[i] if i < len(leido) else []
        for j, val in enumerate(esperada):
            v = str(val)
            got = str(real[j]) if j < len(real) else ''
            if v.strip() and got != v:
                malas.append((i, j, v, got))
    if malas:
        i, j, v, got = malas[0]
        raise RuntimeError(
            '%s: escribí %d celda(s) que NO quedaron. La primera es la fila '
            '%d, columna %d: mandé %r y hay %r. La causa habitual es una '
            'CELDA COMBINADA, que se come los valores sin dar error.'
            % (a1, len(malas), i + 1, j + 1, v, got))
    return sum(1 for f in filas for c in f if str(c).strip())


# 🔴 LA CABECERA DE CADA HOJA, DECLARADA. Adivinarla es lo que viene
# mordiendo, y las dos heuristicas que probe fallan en hojas distintas:
#
#   «la primera fila con 3+ celdas»  -> en `Eventos Procesados` elige la 1,
#                                       que es el panel de filtros
#   «la fila con MAS celdas»         -> en `Lista de Raperos` elige la 14,
#                                       porque los paneles de la derecha
#                                       hacen filas mas anchas que la
#                                       cabecera
#
# ⚠️ Y NINGUNA DE LAS DOS FALLA: las dos devuelven filas. Una cabecera mal
# elegida da un lector que lee y no encuentra nada, que es peor que uno que
# revienta.
#
# Estas se midieron una por una el 20/09/2026 leyendo las 16 primeras filas
# de cada hoja. El `ojo` es una columna que tiene que estar: si la hoja se
# reordena, el lector avisa en vez de leer otra fila.
CABECERAS = {
    'Entrada': (1, 'Evento'),
    'Pendientes': (1, 'Tipo'),
    'Lista de Raperos': (9, 'Rapero'),
    'AKAs': (1, 'Alias'),
    'Resultados': (3, 'Evento #'),
    '1v1': (3, 'Evento #'),
    'Eventos Procesados': (5, 'Evento'),
    'Anuncios': (1, 'Tipo'),
    'Log': (1, 'Acción'),
    'Consola': (4, 'Parámetro'),
    # ⚠️ `Config` y `MW Puntos` NO son tablas: son tableros con bloques
    # sueltos. No tienen una cabecera y pedirsela no tiene sentido.
    'Config': None,
    'MW Puntos': None,
}


class Hoja(object):
    """Una hoja del Operativo, con su cabecera encontrada y su ancho."""

    def __init__(self, nombre, ojo=None):
        if ojo is None:
            declarada = CABECERAS.get(nombre, 'DESCONOCIDA')
            if declarada is None:
                raise RuntimeError(
                    '%r no es una tabla: es un tablero de bloques sueltos. '
                    'No tiene cabecera.' % nombre)
            if declarada != 'DESCONOCIDA':
                ojo = declarada[1]
        self.nombre = nombre
        d = _pedir('GET', '/values/%s!A1:Z20' % requests.utils.quote(nombre))
        v = d.get('values', [])
        # 🔴 LA CABECERA ES LA FILA CON MAS CELDAS, NO LA PRIMERA CON TRES.
        # La version anterior tomaba «la primera con 3 o mas» y en
        # `Eventos Procesados` eso eligio la fila 1, que tiene el panel de
        # filtros: `🔍 Filtrar | 📊 Resumen | 🎯 Most Wanted`. Tres celdas,
        # tres cabeceras falsas.
        #
        # ⚠️ Y NO FALLO: devolvio «351 eventos» con todos los campos
        # vacios, porque las columnas que se le pedian no existian en esa
        # cabecera. Un lector que elige mal la cabecera **no da error**:
        # da filas.
        #
        # La de verdad esta en la 5 y tiene nueve celdas. Tomando la de
        # MAS celdas —y la primera en caso de empate— sale siempre la
        # tabla y no el adorno.
        self.fila_cab = None
        mejor = 0
        for i, f in enumerate(v):
            llenas = [str(c).strip() for c in f if str(c).strip()]
            if ojo is not None:
                # con `ojo` no hay que adivinar: la cabecera es la que lo tiene
                if ojo in llenas:
                    self.fila_cab, self.cabecera = i + 1, [str(c).strip() for c in f]
                    break
                continue
            if len(llenas) > mejor and len(llenas) >= 3:
                mejor = len(llenas)
                self.fila_cab, self.cabecera = i + 1, [str(c).strip() for c in f]
        if self.fila_cab is None:
            raise RuntimeError(
                'no encontré la cabecera de %r en las primeras 20 filas%s'
                % (nombre, ' (buscaba la columna %r)' % ojo if ojo else ''))
        # el ancho es hasta la ultima columna con nombre
        while self.cabecera and not self.cabecera[-1]:
            self.cabecera.pop()
        self.ancho = len(self.cabecera)
        self.fila_datos = self.fila_cab + 1

    def __repr__(self):
        return '<Hoja %s cab=%d ancho=%d>' % (self.nombre, self.fila_cab, self.ancho)

    def filas(self):
        """Las filas con datos, como listas."""
        d = _pedir('GET', '/values/%s!A%d:%s'
                   % (requests.utils.quote(self.nombre), self.fila_datos,
                      chr(ord('A') + self.ancho - 1)))
        return [f for f in d.get('values', [])
                if any(str(c).strip() for c in f)]

    def agregar(self, filas, dry=True):
        """Pone filas al final. `dry=True` por defecto: dice y no escribe."""
        if not filas:
            return 0
        malas = [i for i, f in enumerate(filas) if len(f) != self.ancho]
        if malas:
            raise RuntimeError(
                '%s tiene %d columnas y %d fila(s) traen otra cantidad '
                '(la primera, %d). Mandar de menos NO falla: entra corrida.'
                % (self.nombre, self.ancho, len(malas), len(filas[malas[0]])))
        hay = len(self.filas())
        destino = self.fila_datos + hay
        if dry:
            print('   [dry] %s: pondria %d fila(s) desde la %d '
                  '(hoy tiene %d)' % (self.nombre, len(filas), destino, hay))
            return 0
        _pedir('POST', '/values/%s!A%d:append?valueInputOption=RAW'
                       '&insertDataOption=INSERT_ROWS'
               % (requests.utils.quote(self.nombre), destino),
               json={'values': filas})
        return len(filas)


def ver():
    d = _pedir('GET', '?fields=properties.title,sheets.properties')
    print('\n══ %s ══\n' % d['properties']['title'])
    print('   %-24s %6s %7s  %s' % ('hoja', 'cab', 'ancho', 'filas con datos'))
    for s in d['sheets']:
        n = s['properties']['title']
        try:
            h = Hoja(n)
            print('   %-24s %6d %7d  %d' % (n, h.fila_cab, h.ancho, len(h.filas())))
        except Exception as e:                   # noqa: BLE001
            print('   %-24s %s' % (n, str(e)[:60]))
    print('')


def probar():
    """Escribe una fila de prueba en `Log` y la deja ahi.

    ⚠️ SE PRUEBA EN `Log` Y NO EN `Resultados`, a proposito: el Log es para
    esto —dejar rastro de lo que pasa— y una fila de mas ahi no corrompe
    ningun calculo. Escribir de prueba en una hoja de datos si.
    """
    import time
    h = Hoja('Log', ojo='Acción')
    print('\n   %r' % h)
    fila = [time.strftime('%d/%m %H:%M'), 'Apps Script',
            'Prueba de escritura', 'sheet/escribir.py verificando el permiso',
            'Sistema'] + [''] * (h.ancho - 5)
    antes = len(h.filas())
    h.agregar([fila], dry=True)
    n = h.agregar([fila], dry=False)
    despues = len(h.filas())
    print('   escribio %d fila(s): %d -> %d' % (n, antes, despues))
    print('   %s' % ('✅ la escritura funciona' if despues == antes + 1
                     else '🔴 no aparecio la fila'))
    print('')


def main():
    if '--probar' in sys.argv:
        return probar()
    if '--ver' in sys.argv:
        return ver()
    print(__doc__)


if __name__ == '__main__':
    main()
