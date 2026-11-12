# -*- coding: utf-8 -*-
"""LAS TRES HOJAS DE DATOS DEL OPERATIVO, EN `datos/`. La etapa 1 de sacar el Sheet del medio.

    python sheet/espejo_t1.py              qué cambiaría, sin escribir nada
    python sheet/espejo_t1.py --aplicar    copia `Resultados`, `1v1` y `Eventos Procesados` a datos/ (el ciclo, 2g)
    python sheet/espejo_t1.py --comparar   el Sheet contra los archivos, celda por celda, sin escribir
    python sheet/espejo_t1.py --auto       el self-check, sin red (CI)

🔑 POR QUÉ (Dlx, 11/11/2026). *«¿Es necesario el Google Sheet a este punto?… yo ya no uso el Google Sheet»*, y a la
propuesta de sacarlo por etapas: *«si es que lo que estás proponiendo mejorará todo el sistema y optimizará todo pues
adelante, pero asegúrate de que todo esté bien»*. El Sheet nació como la vitrina de la Liga; con la página es sólo la
base de datos del ciclo, y como base de datos se nos rompió varias veces: `Entrada` llegó a 1.233.156 filas y frenó la
carga del 07 al 09/11 (`escribir.Hoja.recortar()`), el 11/11 la #471 y el ciclo se pisaron usando `Entrada` como mesa
de paso, cada corrida gasta ~2 de sus 10 minutos leyendo y escribiendo el Sheet, y las cartas salen de una vuelta
Sheet → vitrina → Sheet → pool.

LAS ETAPAS, Y CADA UNA SE PASA SÓLO SI DA LO MISMO
---------------------------------------------------
1. **Esto**: el ciclo sigue escribiendo el Sheet y además deja las tres hojas acá, tal cual. Nada lee estos archivos
   todavía; se mira que sigan iguales corrida tras corrida (`--comparar`).
2. Los lectores (las vitrinas, los pools, el padrón…) pasan a leer de acá, de a uno, comparando que lo que calculan
   salga idéntico.
3. Quien escribe (`procesar_entrada`, `resultados`) escribe acá primero, y el Sheet pasa a ser la copia.
4. La Lista, los AKAs y `Config`, lo mismo. Al final Dlx elige: espejo de sólo lectura o se apaga.

⚠️ EL VALOR DE VERDAD, NO LO QUE SE VE. Se guarda lo de `resultados._filas_crudas()` (`UNFORMATTED_VALUE`: los
números, números) y lo visible sale de ahí (`visible()`). Medido el 11/11/2026 sobre las 5.453 filas de las tres hojas:
las dos lecturas dan **0 celdas distintas**, así que no se pierde nada. Y cada `--aplicar` lo vuelve a medir: si algún
día una celda se ve distinta de su valor (un formato de número, una fecha), lo dice en vez de copiar algo que los
lectores leerían distinto.

⚠️ EL ORDEN DE LAS FILAS ES EL DEL SHEET. `rankings.py` ordena por evento y fecha, pero DENTRO de un evento manda el
orden de las filas (la racha de duelos): por eso es una lista y no un mapa por evento.

⚠️ UNA FILA POR LÍNEA Y SIN HORA ADENTRO. El ciclo commitea esto cada media hora: con una línea por fila, un evento
nuevo es un diff de veinte líneas y no un archivo entero; y sin la hora de la copia, una corrida sin cambios no escribe
nada (`guardar.sh` dice «nada cambió»).

🔴 NUNCA ACHICA A MENOS DE LA MITAD. Una lectura que vuelve vacía o cortada es el Sheet fallando, no la Liga perdiendo
la mitad de sus resultados: se planta y lo dice. La temporada que arranca de cero tiene sus propios archivos
(`t2_…`), así que el caso legítimo no pasa por acá.
"""
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path[:0] = [SCR, BASE]
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

from comun.temporada import ACTUAL                          # noqa: E402

#: hoja del Operativo -> nombre del archivo (`datos/<temporada>_<nombre>.json`)
HOJAS = {'Resultados': 'resultados', '1v1': '1v1', 'Eventos Procesados': 'eventos'}
#: una lectura que trae menos que esto de lo que ya había no se copia (ver el encabezado)
PISO = 0.5


#: 🏆 LAS VITRINAS DEL OFICIAL (etapa 4a, 11/11/2026). Las calcula `rankings.py`, y los pools las volvían a LEER del Sheet
#: (`Ranking Temporada` para los dos, `Ranking Competitivo` para el servidor elegido y el Score): la vuelta Sheet →
#: vitrina → Sheet → pool. Medido ese día: las cinco con la cabecera en la fila 1 y 0 celdas que se vean distinto de su
#: valor de verdad, igual que las tres de arriba.
VITRINAS = {'Ranking Temporada': 'vitrina_temporada', 'Ranking Competitivo': 'vitrina_competitivo',
            'Ranking Podios': 'vitrina_podios', 'Ranking Duelos': 'vitrina_duelos', 'Ranking Mundial': 'vitrina_mundial'}


#: 🪪 LAS HOJAS QUE SE LEEN ENTERAS (etapa 4b, 11/11/2026): la Lista de Raperos (el banner arriba, la cabecera en la
#: fila 9) y AKAs (dos bloques lado a lado y un panel). `construir_padron` y `construir_akas` piden la grilla completa
#: con `get_all_values()`, así que se guarda la grilla completa, COMO TEXTO —lo que muestra el Sheet—: un Discord ID
#: de 19 cifras como número perdería las últimas. `datos/padron.json`, ya en el repo, trae todo lo de la Lista.
GRILLAS = {'Lista de Raperos': 'lista', 'AKAs': 'akas',
           # 📋 y la cola de preguntas, la vista de ✅ Decidir y lo que se lee de Config (etapa 4c, 11/11/2026)
           'Pendientes': 'pendientes', '✅ Decidir': 'decidir', 'Config': 'config'}
#: ⚠️ DE `Config`, SÓLO LO QUE SE LEE: las tablas de puntos (`A7:B14`, `C7:D12`, `A18:B23`), los modificadores
#: (`F5:G15`) y el contador (`B27:B28`). El resto del tablero trae el registro viejo del Most Wanted (`J2:M22`), que no
#: lee nadie y no tiene por qué ir a un repo público.
GRILLAS_RANGO = {'Config': 'A1:H30'}


def ruta(hoja, temp=ACTUAL, base=BASE):
    return os.path.join(base, 'datos', '%s_%s.json' % (temp, HOJAS.get(hoja) or VITRINAS.get(hoja) or GRILLAS[hoja]))


def visible(c):
    """Lo que el Sheet MUESTRA de un valor de verdad (lo que da `Hoja.filas()`)."""
    if isinstance(c, bool):
        return 'TRUE' if c else 'FALSE'
    if isinstance(c, float) and c.is_integer():
        return str(int(c))
    return str(c)


def normal(f):
    """La fila como la devuelve el Sheet al leerla: sin las celdas vacías del final, `None` como vacío y un `1250.0`
    como `1250` (la API no manda «.0»). Así lo que deja quien escribe y lo que copia el paso 2g dan el mismo texto."""
    f = ['' if c is None else (int(c) if isinstance(c, float) and c.is_integer() else c) for c in f]
    while f and f[-1] == '':
        f.pop()
    return f


def volcar(hoja, cabecera, filas):
    """El texto del archivo: siempre el mismo para lo mismo, una fila por línea."""
    lineas = [json.dumps(normal(f), ensure_ascii=False) for f in filas]
    return ('{\n "hoja": %s,\n "cabecera": %s,\n "filas": [\n%s\n ]\n}\n'
            % (json.dumps(hoja, ensure_ascii=False), json.dumps(list(cabecera), ensure_ascii=False),
               ',\n'.join('  ' + x for x in lineas))) if filas else (
        '{\n "hoja": %s,\n "cabecera": %s,\n "filas": []\n}\n'
        % (json.dumps(hoja, ensure_ascii=False), json.dumps(list(cabecera), ensure_ascii=False)))


def leer(hoja, temp=ACTUAL, base=BASE):
    """`{'hoja', 'cabecera', 'filas'}` del archivo, o `None` si todavía no hay."""
    try:
        with io.open(ruta(hoja, temp, base), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def crudas(hoja, temp=ACTUAL, base=BASE):
    """Las filas con su valor de verdad, como `resultados._filas_crudas()`."""
    d = leer(hoja, temp, base)
    return [list(f) for f in (d or {}).get('filas') or []]


def filas(hoja, temp=ACTUAL, base=BASE):
    """Las filas como se ven, como `Hoja(hoja).filas()`."""
    return [[visible(c) for c in f] for f in crudas(hoja, temp, base)]


#: 🛑 LAS HOJAS QUE YA NO SE LEEN NI SE ESCRIBEN EN EL SHEET (etapa 5, 11/11/2026; Dlx: «dale, sigue con dejar de
#: escribir el Sheet»). Su fuente es el archivo de `datos/` y nada más: `fuente()` y `base_para_escribir()` no leen el
#: Sheet, `resultados.reescribir()` y `renombrar_varios()` no lo escriben, y el paso 2g no las copia. Las tres de datos
#: primero, que tenían siete corridas seguidas en «igual» (7:52 a 10:22 PM) y el contador movido en los dos lugares.
#: ⚠️ Sin archivo NO se lee el Sheet: frena (`sin_archivo()`). El Sheet de estas hojas quedó congelado el 11/11.
SIN_SHEET = {'Resultados', '1v1', 'Eventos Procesados',
             # 🏆 y las cinco vitrinas (etapa 5b, 12/11/2026; Dlx: «espera dos corridas y hazlo esta noche»): lo que
             # calcula `rankings.py` dio igual al Sheet en las corridas de las 11:22 PM, 11:52 PM y 12:22 AM
             'Ranking Temporada', 'Ranking Competitivo', 'Ranking Podios', 'Ranking Duelos', 'Ranking Mundial'}


def sin_archivo(hoja):
    """Una hoja de `SIN_SHEET` sin su archivo es un error que hay que ver, no un caso para leer el Sheet viejo."""
    raise RuntimeError('🔴 %s ya no vive en el Sheet y no está su archivo (%s): no sigo con datos viejos o vacíos'
                       % (hoja, os.path.relpath(ruta(hoja), BASE)))


class HojaLocal(object):
    """🛑 Lo que `escribir.Hoja` sabía de una hoja (nombre, cabecera, ancho, `filas()`), desde su archivo: para las de
    `SIN_SHEET`, que ya no se leen del Sheet. Lo devuelve `hoja()`."""

    def __init__(self, nombre, base=BASE):
        d = leer(nombre, base=base)
        if d is None:
            sin_archivo(nombre)
        self.nombre, self._base = nombre, base
        self.cabecera = [str(c) for c in d.get('cabecera') or []]
        self.ancho = len(self.cabecera)
        self.fila_cab, self.fila_datos = 0, 0

    def __repr__(self):
        return '<HojaLocal %s ancho=%d>' % (self.nombre, self.ancho)

    def filas(self):
        return filas(self.nombre, base=self._base)


def hoja(nombre):
    """La hoja para leer o escribir: `HojaLocal` si ya no vive en el Sheet (`SIN_SHEET`), y si no `escribir.Hoja`."""
    if nombre in SIN_SHEET:
        return HojaLocal(nombre)
    from escribir import Hoja
    return Hoja(nombre)


def base_para_escribir(hoja, del_sheet, base=BASE):
    """🖊️ DE QUÉ FILAS PARTE QUIEN ESCRIBE (etapa 3d, 11/11/2026): las de datos/, que van a ser la fuente. Mientras
    `CONTROL` está prendido también lee el Sheet (`del_sheet`, una función: sólo se llama si hace falta) y, si no
    coinciden, parte del Sheet —todavía es la referencia— y lo dice en rojo. Sin archivo, el Sheet.
    🛑 Las de `SIN_SHEET`, sólo del archivo."""
    if hoja in SIN_SHEET:
        if leer(hoja, base=base) is None:
            sin_archivo(hoja)
        return crudas(hoja, base=base)
    mio = crudas(hoja, base=base) if leer(hoja, base=base) is not None else None
    if mio is not None and not CONTROL:
        return mio
    sh = [normal(f) for f in del_sheet()]
    if mio is None:
        return sh
    if sh != mio:
        entran, salen, cambian = resumen(mio, sh)
        print('   🔴 %s: el archivo no coincide con el Sheet (en el Sheet y no acá: %s · cambian: %s · acá y no en el '
              'Sheet: %s): parto del Sheet' % (hoja, sorted(entran)[:6], sorted(cambian)[:6], sorted(salen)[:6]))
        return sh
    return mio


#: 🔢 EL CONTADOR DE EVENTOS, TAMBIÉN ACÁ (etapa 3d). Era sólo `Config!B27` del Operativo. Un número nunca se reusa
#: —un evento sacado deja su hueco—, así que vale el mayor de los dos lugares y se escribe en los dos.
CONTADOR = 'contador'


def ruta_contador(temp=ACTUAL, base=BASE):
    return os.path.join(base, 'datos', '%s_%s.json' % (temp, CONTADOR))


def contador(temp=ACTUAL, base=BASE):
    try:
        with io.open(ruta_contador(temp, base), encoding='utf-8') as f:
            return int((json.load(f) or {}).get('ultimo') or 0)
    except (OSError, ValueError, TypeError):
        return 0


def guardar_contador(n, temp=ACTUAL, base=BASE):
    """Sólo sube: un contador que baja reusaría un número."""
    if int(n) <= contador(temp, base):
        return False
    with io.open(ruta_contador(temp, base), 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps({'ultimo': int(n)}, ensure_ascii=False) + '\n')
    return True


def un_escritor(que, entorno=None, argv=None):
    """🖊️ UN SOLO ESCRITOR (etapa 3c, 11/11/2026): lo que escribe los resultados corre en GitHub —el ciclo y
    `.github/workflows/recalcular.yml`, en la misma fila—, nunca desde una PC. El 11/11 un recálculo hecho en una PC y la
    corrida de las 6:52 PM se pisaron; con los datos en el repo, una PC atrasada reescribiría lo de horas atrás.
    `--desde-aca` lo saltea a propósito (sabiendo que el ciclo no corre). Devuelve `None` o el motivo, y sale con él."""
    entorno = os.environ if entorno is None else entorno
    argv = sys.argv if argv is None else argv
    if entorno.get('GITHUB_ACTIONS') == 'true' or '--desde-aca' in argv:
        return None
    motivo = ('🔴 %s escribe los resultados, y eso corre en GitHub para que nunca haya dos escritores a la vez:\n'
              '      gh workflow run recalcular.yml -f leer=<números> -f aplicar=true\n'
              '   (Si sabes que el ciclo no está corriendo y lo quieres igual desde acá: --desde-aca.)' % que)
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    sys.exit(motivo)


#: 🔎 LA PRUEBA DE LA ETAPA 2 (11/11/2026). Prendida, `fuente()` lee el archivo Y el Sheet, los compara, y si dan
#: distinto usa el Sheet —todavía es la fuente— y lo dice en rojo: lo que calcula cada lector sale idéntico a antes por
#: construcción. Se apaga, y con eso el Sheet deja de leerse, cuando varias corridas seguidas del ciclo dieron «igual»
#: en todos los lectores (se ve en el log: una línea por hoja y por proceso).
CONTROL = True
#: lo que ya se comparó en este proceso, `{hoja: igual}`: un lector que pide la misma hoja dos veces la dice una vez
_VISTO = {}


def fuente(hoja, lector='', base=BASE):
    """🗄️ Las filas de `hoja` como las da `Hoja(hoja).filas()`, pero desde datos/: lo que usan los lectores en vez de
    leer el Sheet (etapa 2). Sin archivo, el Sheet. Con `CONTROL`, ver arriba. 🛑 Las de `SIN_SHEET`, sólo del archivo."""
    if hoja in SIN_SHEET:
        if leer(hoja, base=base) is None:
            sin_archivo(hoja)
        return filas(hoja, base=base)
    mio = filas(hoja, base=base) if leer(hoja, base=base) is not None else None
    if mio is not None and not CONTROL:
        return mio
    from escribir import Hoja
    sh = [[str(c) for c in f] for f in Hoja(hoja).filas()]
    de = ' (%s)' % lector if lector else ''
    if mio is None:
        print('   ⚠️ %s: no está en datos/, leo el Sheet%s' % (hoja, de))
        return sh
    igual = sh == mio
    if _VISTO.get(hoja) != igual:
        print('   %s %s desde datos/: %s%s' % ('🗄️' if igual else '🔴', hoja, 'igual al Sheet' if igual else
              'DISTINTO del Sheet (%d contra %d filas): uso el Sheet' % (len(mio), len(sh)), de))
    _VISTO[hoja] = igual
    return mio if igual else sh


def _num(f):
    return visible(f[0]).strip() if f else ''


def resumen(antes, ahora):
    """Qué cambió, por evento: `(entran, salen, cambian)` como conjuntos de números."""
    def por_ev(fs):
        d = {}
        for f in fs:
            d.setdefault(_num(f), []).append(json.dumps(f, ensure_ascii=False))
        return d
    a, b = por_ev(antes), por_ev(ahora)
    return (set(b) - set(a), set(a) - set(b), {n for n in set(a) & set(b) if a[n] != b[n]})


def decidir(hoja, viejo, nuevas):
    """`(escribir, motivo)`: si una lectura nueva puede reemplazar al archivo. Pura."""
    antes = len((viejo or {}).get('filas') or [])
    if antes and len(nuevas) < antes * PISO:
        return False, ('🔴 %s: el Sheet trajo %d fila(s) y el archivo tiene %d. Una caída así es el Sheet fallando: '
                       'no la copio' % (hoja, len(nuevas), antes))
    return True, ''


def _texto_de(p):
    try:
        with io.open(p, encoding='utf-8', newline='') as f:
            return f.read().replace('\r\n', '\n')
    except OSError:
        return None


def al_escribir(hoja, cabecera, filas, base=BASE):
    """🖊️ Lo llaman los que escriben estas hojas (`resultados.reescribir()` y `renombrar_varios()`) con la tabla
    ENTERA que acaban de dejar en el Sheet: el archivo queda al día en el mismo momento, no al final de la corrida,
    que es lo que necesita un lector que lea de acá en la misma corrida (etapa 2). `True` si cambió el archivo.
    ⚠️ NUNCA LEVANTA: si no puede, lo dice y lo copia el paso 2g. El Sheet sigue siendo la fuente en esta etapa."""
    if hoja not in HOJAS:
        return None
    try:
        fs = [normal(f) for f in filas if any(str(c).strip() for c in f)]
        p = ruta(hoja, base=base)
        viejo = leer(hoja, base=base)
        ok, motivo = decidir(hoja, viejo, fs)
        if not ok:
            print('   ' + motivo)
            return None
        texto = volcar(hoja, cabecera, fs)
        if _texto_de(p) == texto:
            return False
        with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write(texto)
        return True
    except Exception as e:                                 # noqa: BLE001
        print('   ⚠️ no pude dejar %s en datos/ (%s): lo copia el paso 2g' % (hoja, str(e)[:80]))
        return None


def espejar(aplicar=False):
    """Lee las tres hojas y las deja en datos/. Devuelve `{hoja: 'igual' | 'cambió' | 'no'}`."""
    from escribir import Hoja
    import resultados as RES
    out = {}
    for hoja in HOJAS:
        if hoja in SIN_SHEET:
            # 🛑 ya no vive en el Sheet: copiarla de ahí pisaría lo nuevo con lo congelado el 11/11
            d = leer(hoja)
            print('   %-20s %s' % (hoja, 'la fuente es datos/ (%d fila(s)): el Sheet ya no se escribe'
                                 % len((d or {}).get('filas') or []) if d else '🔴 sin archivo'))
            out[hoja] = 'datos' if d else 'no'
            continue
        h = Hoja(hoja)
        cru = [normal(f) for f in RES._filas_crudas(h)]
        # ⚠️ lo que se ve tiene que ser lo que sale del valor de verdad: si no, los lectores leerían otra cosa
        vis = h.filas()
        emul = [[visible(c) for c in f] for f in cru]
        distintas = sum(1 for a, b in zip(vis, emul) if [str(x) for x in a] != b) + abs(len(vis) - len(emul))
        if distintas:
            print('   🔴 %s: %d fila(s) se ven distinto de su valor de verdad: no la copio (ver el encabezado)'
                  % (hoja, distintas))
            out[hoja] = 'no'
            continue
        viejo = leer(hoja)
        ok, motivo = decidir(hoja, viejo, cru)
        if not ok:
            print('   ' + motivo)
            out[hoja] = 'no'
            continue
        texto = volcar(hoja, h.cabecera, cru)
        ya = _texto_de(ruta(hoja))
        if ya == texto:
            print('   %-20s igual (%d fila(s))' % (hoja, len(cru)))
            out[hoja] = 'igual'
            continue
        entran, salen, cambian = resumen((viejo or {}).get('filas') or [], cru)
        # 🔴 desde que los que escriben dejan el archivo (`al_escribir()`), acá tiene que dar siempre «igual»: si no,
        # alguien escribió el Sheet por otro camino, y en la etapa 2 un lector habría leído algo viejo
        print('   %s%-20s %d fila(s) · eventos: %d nuevo(s), %d cambiado(s), %d que ya no está(n)%s'
              % ('🔴 atrasado: ' if viejo else '', hoja, len(cru), len(entran), len(cambian), len(salen),
                 '' if aplicar else '  [sin --aplicar: no escribo]'))
        if aplicar:
            with io.open(ruta(hoja), 'w', encoding='utf-8', newline='\n') as f:
                f.write(texto)
        out[hoja] = 'cambió'
    return out


def comparar():
    """El Sheet contra los archivos. 0 si son iguales."""
    from escribir import Hoja
    import resultados as RES
    malas = 0
    for hoja in HOJAS:
        if hoja in SIN_SHEET:
            print('   ·  %-20s la fuente es datos/: el Sheet quedó congelado el 11/11, no hay con qué comparar' % hoja)
            continue
        cru = [normal(f) for f in RES._filas_crudas(Hoja(hoja))]
        mio = crudas(hoja)
        if cru == mio:
            print('   ✅ %-20s igual: %d fila(s)' % (hoja, len(mio)))
            continue
        malas += 1
        entran, salen, cambian = resumen(mio, cru)
        print('   🔴 %-20s el Sheet %d fila(s), el archivo %d · en el Sheet y no acá: %s · cambian: %s · acá y no '
              'en el Sheet: %s' % (hoja, len(cru), len(mio), sorted(entran)[:8], sorted(cambian)[:8], sorted(salen)[:8]))
    return 1 if malas else 0


def _leer_oficial(hoja, modo='UNFORMATTED_VALUE'):
    """`(cabecera, filas)` de una vitrina del Oficial, desde su cabecera (`rankings.fila_cabecera()`), con reintento."""
    import requests
    import rankings as RK
    from escribir import token
    from reintentar import leer as _reint
    fc = RK.fila_cabecera(hoja)

    def _pedir():
        r = requests.get('https://sheets.googleapis.com/v4/spreadsheets/%s/values/%s'
                         % (RK.OFICIAL, requests.utils.quote("'%s'!A%d:AZ" % (hoja, fc))),
                         params={'valueRenderOption': modo}, headers={'Authorization': 'Bearer ' + token()}, timeout=90)
        r.raise_for_status()
        return r.json().get('values', [])
    v = _reint(_pedir)
    if not v:
        return [], []
    return [str(c).strip() for c in v[0]], [normal(f) for f in v[1:] if any(str(c).strip() for c in f)]


def espejar_vitrinas(aplicar=False):
    """🏆 Las cinco vitrinas del Oficial, a datos/ (etapa 4a). Devuelve `{hoja: 'igual' | 'cambió' | 'no'}`.
    ⚠️ Corre ANTES de los pools (paso 2 del ciclo) y otra vez en el 2g: lo de esta corrida tiene que estar."""
    out = {}
    for hoja in VITRINAS:
        if hoja in SIN_SHEET:
            d = leer(hoja)
            print('   %-20s %s' % (hoja, 'la fuente es datos/ (%d fila(s)): el Sheet ya no se escribe'
                                 % len((d or {}).get('filas') or []) if d else '🔴 sin archivo'))
            out[hoja] = 'datos' if d else 'no'
            continue
        try:
            cab, cru = _leer_oficial(hoja)
        except Exception as e:                             # noqa: BLE001
            print('   ⚠️ %s: no pude leerla (%s): queda como estaba' % (hoja, str(e)[:80]))
            out[hoja] = 'no'
            continue
        if not cab:
            print('   ⚠️ %s: vacía o sin cabecera: queda como estaba' % hoja)
            out[hoja] = 'no'
            continue
        viejo = leer(hoja)
        ok, motivo = decidir(hoja, viejo, cru)
        if not ok:
            print('   ' + motivo)
            out[hoja] = 'no'
            continue
        texto = volcar(hoja, cab, cru)
        if _texto_de(ruta(hoja)) == texto:
            print('   %-20s igual (%d fila(s))' % (hoja, len(cru)))
            out[hoja] = 'igual'
            continue
        # 🏆 en GitHub, `rankings.py` ya dejó acá lo que calculó (etapa 5b): distinto es que el cálculo y el Sheet no
        # coinciden, y mientras tanto manda el Sheet
        print('   %s%-20s %d fila(s), %s%s' % ('🔴 ' if _en_github() else '', hoja, len(cru),
                                           'lo calculado NO coincide con el Sheet: copio el Sheet' if _en_github()
                                           else 'cambió', '' if aplicar else '  [sin --aplicar: no escribo]'))
        if aplicar:
            with io.open(ruta(hoja), 'w', encoding='utf-8', newline='\n') as f:
                f.write(texto)
        out[hoja] = 'cambió'
    return out


def al_escribir_vitrina(hoja, cab, filas, base=BASE):
    """🏆 ETAPA 5b (11/11/2026): lo que `rankings.py` CALCULA de una vitrina, a su archivo, en el mismo momento en que
    la escribe en el Sheet (o ve que ya decía eso). La copia de antes de los pools (`espejar_vitrinas()`) compara con
    el Sheet: tiene que dar «igual» varias corridas antes de dejar de escribir las vitrinas en el Sheet.
    Sólo en GitHub (como `marcar_sucias()`). Nunca levanta. `True` si cambió el archivo."""
    if hoja not in VITRINAS or (hoja not in SIN_SHEET and not _en_github()):
        return None
    try:
        fs = [normal(f) for f in filas if any(str(c).strip() for c in f)]
        viejo = leer(hoja, base=base)
        ok, motivo = decidir(hoja, viejo, fs)
        if not ok:
            print('   ' + motivo)
            return None
        texto = volcar(hoja, [str(c).strip() for c in cab], fs)
        if _texto_de(ruta(hoja, base=base)) == texto:
            return False
        with io.open(ruta(hoja, base=base), 'w', encoding='utf-8', newline='\n') as f:
            f.write(texto)
        return True
    except Exception as e:                                 # noqa: BLE001
        print('   ⚠️ no pude dejar %s en datos/ (%s): la copia el paso 2' % (hoja, str(e)[:80]))
        return None


def grilla(hoja, base=BASE):
    """La vitrina como la devuelve `worksheet(hoja).get_all_values()` de gspread: la cabecera y las filas, todo como
    texto y con todas las filas del mismo ancho. `None` si no hay archivo."""
    d = leer(hoja, base=base)
    if d is None:
        return None
    filas = [[str(c) for c in d.get('cabecera') or []]] + [[visible(c) for c in f] for f in d.get('filas') or []]
    ancho = max((len(f) for f in filas), default=0)
    return [f + [''] * (ancho - len(f)) for f in filas]


def fuente_vitrina(hoja, del_sheet, lector='', base=BASE):
    """🏆 Lo que usan los pools en vez de `sh.worksheet(hoja).get_all_values()` (etapa 4a). Con `CONTROL`, igual que
    `fuente()`: llama a `del_sheet` (la lectura de siempre), compara y si no coincide usa el Sheet y lo dice."""
    mio = grilla(hoja, base=base)
    if hoja in SIN_SHEET:
        if mio is None:
            sin_archivo(hoja)
        return mio
    if mio is not None and not CONTROL:
        return mio
    sh = [[str(c) for c in f] for f in del_sheet()]
    de = ' (%s)' % lector if lector else ''
    if mio is None:
        print('   ⚠️ %s: no está en datos/, leo el Sheet%s' % (hoja, de))
        return sh
    igual = sh == mio
    if _VISTO.get(hoja) != igual:
        print('   %s %s desde datos/: %s%s' % ('🗄️' if igual else '🔴', hoja, 'igual al Sheet' if igual else
              'DISTINTO del Sheet (%d contra %d filas): uso el Sheet' % (len(mio), len(sh)), de))
    _VISTO[hoja] = igual
    return mio if igual else sh


def rectangular(filas):
    """Todas las filas del mismo ancho, como `get_all_values()` de gspread (`fill_gaps`)."""
    filas = [[str(c) for c in f] for f in filas]
    ancho = max((len(f) for f in filas), default=0)
    return [f + [''] * (ancho - len(f)) for f in filas]


def volcar_grilla(hoja, grilla):
    """El texto del archivo de una hoja entera: una fila por línea, siempre igual para lo mismo."""
    lineas = [json.dumps(list(f), ensure_ascii=False) for f in grilla]
    return ('{\n "hoja": %s,\n "grilla": [\n%s\n ]\n}\n' % (json.dumps(hoja, ensure_ascii=False),
                                                           ',\n'.join('  ' + x for x in lineas))
            if grilla else '{\n "hoja": %s,\n "grilla": []\n}\n' % json.dumps(hoja, ensure_ascii=False))


def _leer_grilla_sheet(hoja):
    """La hoja entera del Operativo, como la ve gspread: lo que se muestra, y rectangular."""
    import requests
    from escribir import token, id_operativo
    from reintentar import leer as _reint

    rng = "'%s'" % hoja + ('!' + GRILLAS_RANGO[hoja] if hoja in GRILLAS_RANGO else '')

    def _pedir():
        r = requests.get('https://sheets.googleapis.com/v4/spreadsheets/%s/values/%s'
                         % (id_operativo(), requests.utils.quote(rng)),
                         headers={'Authorization': 'Bearer ' + token()}, timeout=90)
        r.raise_for_status()
        return r.json().get('values', [])
    return rectangular(_reint(_pedir))


_GRILLA_MEM = {}


def grilla_guardada(hoja, base=BASE):
    """La grilla guardada de una hoja entera, o `None`. Se lee una vez por versión del archivo (fecha y tamaño)."""
    p = ruta(hoja, base=base)
    try:
        st = os.stat(p)
        firma = (st.st_mtime_ns, st.st_size)
    except OSError:
        return None
    m = _GRILLA_MEM.get(p)
    if m and m[0] == firma:
        return m[1]
    d = leer(hoja, base=base)
    g = None if d is None else rectangular(d.get('grilla') or [])
    _GRILLA_MEM[p] = (firma, g)
    return g


def espejar_grillas(aplicar=False):
    """🪪 La Lista y AKAs, enteras, a datos/ (etapa 4b). Corre antes de quien las lee (`construir_padron`, paso 2;
    `construir_akas`, paso 2d) y en el 2g. Devuelve `{hoja: 'igual' | 'cambió' | 'no'}`."""
    out = {}
    for hoja in GRILLAS:
        try:
            g = _leer_grilla_sheet(hoja)
        except Exception as e:                             # noqa: BLE001
            print('   ⚠️ %s: no pude leerla (%s): queda como estaba' % (hoja, str(e)[:80]))
            out[hoja] = 'no'
            continue
        viejo = grilla_guardada(hoja)
        if viejo and len(g) < len(viejo) * PISO:
            print('   🔴 %s: el Sheet trajo %d fila(s) y el archivo tiene %d: no la copio' % (hoja, len(g), len(viejo)))
            out[hoja] = 'no'
            continue
        texto = volcar_grilla(hoja, g)
        if _texto_de(ruta(hoja)) == texto:
            print('   %-20s igual (%d fila(s))' % (hoja, len(g)))
            if aplicar:
                _sin_marca(hoja)
            out[hoja] = 'igual'
            continue
        print('   %-20s %d fila(s), cambió%s' % (hoja, len(g), '' if aplicar else '  [sin --aplicar: no escribo]'))
        if aplicar:
            with io.open(ruta(hoja), 'w', encoding='utf-8', newline='\n') as f:
                f.write(texto)
            _sin_marca(hoja)                               # 🗄️ recién copiada: ya no está «sucia»
        out[hoja] = 'cambió'
    return out


def _celdas(a1):
    """`(hoja, fila1, col1, fila2, col2)` de un rango A1, base 1 y con `None` donde el rango no dice (`A2:C` no tiene
    fila final; `AKAs` sola es la hoja entera). Pura."""
    import re as _re
    hoja, _, celdas = str(a1).rpartition('!')
    if not hoja:
        hoja, celdas = celdas, ''
    if len(hoja) >= 2 and hoja[0] == hoja[-1] == "'":
        hoja = hoja[1:-1].replace("''", "'")

    def col(s):
        n = 0
        for ch in s.upper():
            n = n * 26 + ord(ch) - 64
        return n

    partes = [p for p in celdas.split(':') if p] if celdas else []
    ext = []
    for p in partes:
        m = _re.match(r'^([A-Za-z]*)(\d*)$', p)
        if not m:
            return hoja, None, None, None, None
        ext.append((col(m.group(1)) if m.group(1) else None, int(m.group(2)) if m.group(2) else None))
    if not ext:
        return hoja, None, None, None, None
    (c1, f1), (c2, f2) = ext[0], ext[-1]
    if len(ext) == 1:
        c2, f2 = c1, f1
    return hoja, f1, c1, f2, c2


def valores_de(grilla, a1):
    """Lo que la API contestaría a `GET /values/<a1>` (texto formateado) desde la grilla guardada: sin las celdas
    vacías del final de cada fila, sin las filas vacías del final, y una del medio vacía como `[]`. Pura."""
    _h, f1, c1, f2, c2 = _celdas(a1)
    f1, c1 = (f1 or 1), (c1 or 1)
    filas = grilla[f1 - 1:(f2 if f2 else len(grilla))]
    out = []
    for f in filas:
        f = list(f[c1 - 1:(c2 if c2 else len(f))])
        while f and f[-1] == '':
            f.pop()
        out.append(f)
    while out and not out[-1]:
        out.pop()
    return out


def hojas_de_pedido(metodo, ruta, kw, titulo_de_id=None):
    """🖊️ Qué hojas toca un pedido de ESCRITURA a la API (`escribir._pedir()`): `PUT /values/<a1>`, `/values/<a1>:clear`
    o `:append`, `/values:batchUpdate` (cada `range`) y `:batchUpdate` (cada `sheetId`, con `titulo_de_id`). Pura."""
    from urllib.parse import unquote
    if metodo not in ('PUT', 'POST'):
        return set()
    cuerpo = (kw or {}).get('json') or {}
    if ruta.startswith('/values:batchUpdate'):
        return {_celdas(d.get('range', ''))[0] for d in cuerpo.get('data') or []}
    if ruta.startswith('/values/'):
        a1 = ruta[len('/values/'):].split('?')[0]
        for suf in (':clear', ':append'):
            if a1.endswith(suf):
                a1 = a1[:-len(suf)]
        return {_celdas(unquote(a1))[0]}
    if ruta.startswith(':batchUpdate'):
        ids = set()
        for r in cuerpo.get('requests') or []:
            for v in r.values():
                if isinstance(v, dict):
                    sid = v.get('sheetId', (v.get('range') or {}).get('sheetId') if isinstance(v.get('range'), dict) else None)
                    if sid is not None:
                        ids.add(sid)
        if titulo_de_id is None:
            return set(GRILLAS) if ids else set()
        return {titulo_de_id(i) for i in ids} - {None}
    return set()


#: 🖊️ las hojas enteras que este proceso escribió: su archivo se refresca al terminar (o antes de leerlas)
_SUCIAS = set()
#: 🔎 cuántas lecturas de la Lista y AKAs se compararon con su archivo en este proceso, y cuántas dieron distinto; y
#: cuántas se contestaron desde el archivo sin ir al Sheet (`leer_de_archivo()`, desde el 12/11/2026)
_COMPARADAS = {'iguales': 0, 'distintas': 0, 'archivo': 0}
_AL_SALIR = []


def _al_salir():
    for hoja in sorted(_SUCIAS):
        refrescar(hoja)
    if _COMPARADAS['archivo']:
        print('   🗄️ lecturas del Operativo (Lista, AKAs, Pendientes, ✅ Decidir, Config) desde datos/: %d, sin pedirle '
              'al Sheet' % _COMPARADAS['archivo'])
    if _COMPARADAS['iguales'] or _COMPARADAS['distintas']:
        print('   %s lecturas del Operativo (Lista, AKAs, Pendientes, ✅ Decidir, Config) desde datos/: %d iguales al Sheet%s'
              % ('🗄️' if not _COMPARADAS['distintas'] else '🔴', _COMPARADAS['iguales'],
                 ', %d DISTINTAS' % _COMPARADAS['distintas'] if _COMPARADAS['distintas'] else ''))


def _registrar_salida():
    if not _AL_SALIR:
        import atexit
        atexit.register(_al_salir)
        _AL_SALIR.append(True)


def _en_github():
    """⚠️ SÓLO EN GITHUB (o con `ESPEJO_SIEMPRE=1` para probar): una PC escribe la Lista con `lista_raperos.py`, y
    refrescar su `datos/` dejaría el repo de esa PC modificado contra lo que commitea el ciclo, que es el que vale."""
    return os.environ.get('GITHUB_ACTIONS') == 'true' or os.environ.get('ESPEJO_SIEMPRE') == '1'


def marcar_sucias(hojas):
    """🖊️ Lo llama `escribir._pedir()` después de cada escritura que salió bien. Nunca levanta."""
    if not _en_github():
        return
    nuevas = {h for h in hojas if h in GRILLAS}
    if nuevas:
        _SUCIAS.update(nuevas)
        _registrar_salida()
        # 🗄️ Y SE DEJA DICHO EN DISCO, no sólo en la memoria de este proceso: si muere antes de refrescarla, el
        # próximo que la lea no tiene que creerle al archivo (`de_archivo()`)
        for h in nuevas:
            try:
                with io.open(_marca(h), 'w', encoding='utf-8') as f:
                    f.write('escrita en el Sheet y sin copiar todavía\n')
            except OSError:
                pass


def refrescar(hoja):
    """Vuelve a copiar una hoja entera del Sheet a su archivo (después de que alguien la escribió). Nunca levanta."""
    try:
        g = _leer_grilla_sheet(hoja)
        viejo = grilla_guardada(hoja)
        if viejo and len(g) < len(viejo) * PISO:
            print('   🔴 %s: el Sheet trajo %d fila(s) y el archivo tiene %d: no la copio' % (hoja, len(g), len(viejo)))
            return False
        texto = volcar_grilla(hoja, g)
        if _texto_de(ruta(hoja)) != texto:
            with io.open(ruta(hoja), 'w', encoding='utf-8', newline='\n') as f:
                f.write(texto)
        _SUCIAS.discard(hoja)
        _sin_marca(hoja)
        return True
    except Exception as e:                                 # noqa: BLE001
        print('   ⚠️ no pude refrescar %s en datos/ (%s): lo copia el paso 2g' % (hoja, str(e)[:80]))
        return False


def comparar_lectura(ruta_get, respuesta):
    """🔎 Lo llama `escribir._pedir()` después de cada `GET /values/<a1>` de la Lista o AKAs (etapa 4b): lo que habría
    contestado el archivo contra lo que contestó el Sheet. Sólo mide y avisa; nunca cambia lo que se devuelve."""
    try:
        from urllib.parse import unquote
        if not ruta_get.startswith('/values/') or not _en_github():
            return
        crudo = ruta_get[len('/values/'):]
        if '?' in crudo:
            return                                         # con opciones (UNFORMATTED, etc.): no es lo que se guarda
        a1 = unquote(crudo)
        hoja, _f1, _c1, f2, c2 = _celdas(a1)
        if hoja not in GRILLAS or hoja in _SUCIAS:
            return
        if hoja in GRILLAS_RANGO:
            # sólo se guardó un pedazo (ver `GRILLAS_RANGO`): lo que se pide afuera de él no se puede comparar
            _h, _a, _b, lf, lc = _celdas('%s!%s' % (hoja, GRILLAS_RANGO[hoja]))
            if not f2 or not c2 or f2 > lf or c2 > lc:
                return
        g = grilla_guardada(hoja)
        if g is None:
            return
        _registrar_salida()
        real = [[str(c) for c in f] for f in (respuesta or {}).get('values') or []]
        if valores_de(g, a1) == real:
            _COMPARADAS['iguales'] += 1
        else:
            _COMPARADAS['distintas'] += 1
            if _COMPARADAS['distintas'] <= 3:
                print('   🔴 %s: lo leído del Sheet no coincide con datos/ (%d filas contra %d)'
                      % (a1, len(real), len(valores_de(g, a1))))
    except Exception:                                      # noqa: BLE001
        pass


def fuente_grilla(hoja, del_sheet, lector='', base=BASE):
    """🪪 Lo que usan `construir_padron` y `construir_akas` en vez de `worksheet(hoja).get_all_values()` (etapa 4b).
    Con `CONTROL`, como `fuente()`: compara con la lectura de siempre (`del_sheet`) y si no coincide usa el Sheet."""
    if base == BASE and de_archivo(hoja):
        _registrar_salida()
        _COMPARADAS['archivo'] += 1
        return grilla_guardada(hoja)                       # 🗄️ la prueba apagada: el archivo, al día (12/11/2026)
    if hoja in _SUCIAS and base == BASE:
        refrescar(hoja)                                    # este mismo proceso la escribió: primero, al día
    mio = grilla_guardada(hoja, base=base)
    if mio is not None and not CONTROL:
        return mio
    sh = rectangular(del_sheet())
    de = ' (%s)' % lector if lector else ''
    if mio is None:
        print('   ⚠️ %s: no está en datos/, leo el Sheet%s' % (hoja, de))
        return sh
    igual = sh == mio
    if _VISTO.get(hoja) != igual:
        print('   %s %s desde datos/: %s%s' % ('🗄️' if igual else '🔴', hoja, 'igual al Sheet' if igual else
              'DISTINTO del Sheet (%d contra %d filas): uso el Sheet' % (len(mio), len(sh)), de))
    _VISTO[hoja] = igual
    return mio if igual else sh


# 🗄️ LA PRUEBA DE LAS GRILLAS, APAGADA (12/11/2026; Dlx: «dale, sigue con apagar la prueba de la Lista»). La Lista,
# AKAs, Pendientes, ✅ Decidir y Config se siguen ESCRIBIENDO en el Sheet, pero el ciclo ya no les pregunta para
# leerlas: las copia a datos/ al arrancar (`al_dia()`) y de ahí en más las contesta el archivo
# (`leer_de_archivo()`, que llama `escribir._pedir()` ANTES de ir a la API, y `fuente_grilla()`).
#
# ⚠️ AL ARRANCAR Y NO EN EL PASO 2: medido en la corrida de las 11:52 PM del 11/11, `procesar_entrada` (paso 1) leyó
# `Pendientes` distinto de su archivo dos veces. Alguien la había cambiado desde una PC entre dos corridas, y una
# escritura desde una PC no refresca `datos/` (`_en_github()`). Con la copia al arrancar, eso entra en esa misma vuelta.
#
# ⚠️ LO QUE SE ESCRIBE EN LA CORRIDA SE VUELVE A COPIAR ANTES DE LEERLO: `marcar_sucias()` la deja «sucia» en memoria y
# en disco (`<archivo>.sucia`), y `de_archivo()` la refresca primero. Si no puede, esa lectura va al Sheet. Lo mismo si
# la copia de arranque falló para esa hoja: sólo se le cree al archivo de las que quedaron al día.
#
# ⚠️ SÓLO EN EL CICLO DE GITHUB, y sólo después de `al_dia()`: lo dice `ESPEJO_GRILLAS` en el entorno, que heredan los
# pasos. Una PC, `recalcular.yml` y el trabajo `dibujar` siguen leyendo el Sheet como antes: su `datos/` puede ser de
# hace media hora.
ENV_AL_DIA = 'ESPEJO_GRILLAS'


def _marca(hoja):
    return ruta(hoja) + '.sucia'


def _sin_marca(hoja):
    try:
        os.remove(_marca(hoja))
    except OSError:
        pass


def al_dia():
    """🗄️ Copia las cinco grillas del Sheet a datos/ y deja dicho en el entorno (`ESPEJO_GRILLAS`) cuáles quedaron al
    día: ésas se leen del archivo en el resto de la corrida. Sólo en GitHub. Devuelve ese conjunto. Nunca levanta."""
    if not _en_github():
        return set()
    try:
        r = espejar_grillas(aplicar=True)
    except Exception as e:                                 # noqa: BLE001
        print('   ⚠️ no pude copiar las grillas (%s): se leen del Sheet, como antes' % str(e)[:80])
        r = {}
    listas = {h for h, v in r.items() if v in ('igual', 'cambió')}
    for h in listas:
        _sin_marca(h)
    os.environ[ENV_AL_DIA] = '|'.join(sorted(listas))
    faltan = sorted(set(GRILLAS) - listas)
    print('   🗄️ %d de %d grillas al día en datos/: se leen de ahí%s'
          % (len(listas), len(GRILLAS), '' if not faltan else ' (%s, del Sheet)' % ', '.join(faltan)))
    return listas


def de_archivo(hoja):
    """🗄️ ¿Esta grilla se lee de su archivo, sin preguntarle al Sheet? Sólo si `al_dia()` la dejó al día en esta
    corrida y, si alguien la escribió después, se pudo volver a copiar. Nunca levanta."""
    try:
        if hoja not in GRILLAS or not _en_github():
            return False
        if hoja not in (os.environ.get(ENV_AL_DIA) or '').split('|'):
            return False
        if (hoja in _SUCIAS or os.path.exists(_marca(hoja))) and not refrescar(hoja):
            return False
        return grilla_guardada(hoja) is not None
    except Exception:                                      # noqa: BLE001
        return False


def leer_de_archivo(ruta_get):
    """🗄️ Lo que `escribir._pedir('GET', '/values/<a1>')` contesta desde datos/ sin ir al Sheet, o `None` (y va al
    Sheet). Sólo el texto que se ve (sin `?valueRenderOption`…) y sólo lo que se guarda (`GRILLAS_RANGO`). Nunca
    levanta."""
    try:
        from urllib.parse import unquote
        if not ruta_get.startswith('/values/'):
            return None
        crudo = ruta_get[len('/values/'):]
        if '?' in crudo:
            return None
        a1 = unquote(crudo)
        hoja, _f1, _c1, f2, c2 = _celdas(a1)
        if hoja not in GRILLAS:
            return None
        if hoja in GRILLAS_RANGO:
            _h, _a, _b, lf, lc = _celdas('%s!%s' % (hoja, GRILLAS_RANGO[hoja]))
            if not f2 or not c2 or f2 > lf or c2 > lc:
                return None
        if not de_archivo(hoja):
            return None
        g = grilla_guardada(hoja)
        if g is None:
            return None
        _registrar_salida()
        _COMPARADAS['archivo'] += 1
        out = {'range': a1, 'majorDimension': 'ROWS'}
        v = valores_de(g, a1)
        if v:
            out['values'] = v                              # como la API: sin nada, la clave no viene
        return out
    except Exception:                                      # noqa: BLE001
        return None


def _self_check():
    import tempfile
    fallas = 0

    def ok(cond, que):
        nonlocal fallas
        print('   %s %s' % ('✅' if cond else '🔴', que))
        if not cond:
            fallas += 1

    cab = ['Evento #', 'Fecha', 'Rapero', 'Puntos', 'Notas']
    fs = [[471, '14/10', 'Teito', 1250], [471, '14/10', 'Geoka', 1250.0, 'Nadie siguió'], [472, '15/10', 'Ñandú 🇦🇷', 833.5]]
    # ⚠️ las pruebas de las etapas 1 a 4 son de una hoja que TODAVÍA vive en el Sheet: se corren con `SIN_SHEET` vacío,
    # y las de la etapa 5 (sin el Sheet), al final, con lo de verdad
    sin_sheet0 = set(SIN_SHEET)
    SIN_SHEET.clear()
    t = volcar('Resultados', cab, fs)
    d = json.loads(t)
    ok(d['filas'] == [list(f) for f in fs] and d['cabecera'] == cab and volcar('Resultados', cab, d['filas']) == t,
       'volcar y leer dan lo mismo, y volcar lo leído da el mismo texto (sin hora adentro)')
    ok(t.count('\n') == len(fs) + 6 and '"Ñandú 🇦🇷"' in t, 'una fila por línea, sin escapar los acentos ni las banderas')
    ok(json.loads(volcar('1v1', cab, []))['filas'] == [], 'una hoja vacía es un archivo válido')
    ok([visible(c) for c in [471, 1250.0, 833.5, '', True, '14/10']] == ['471', '1250', '833.5', '', 'TRUE', '14/10'],
       'lo visible: los enteros sin «.0», el resto tal cual')
    e, s, c = resumen(fs, [fs[0], [471, '14/10', 'Geoka', 1250, 'x'], [473, '16/10', 'Otro', 1]])
    ok(e == {'473'} and s == {'472'} and c == {'471'}, 'el resumen dice qué eventos entran, salen y cambian')
    ok(decidir('R', {'filas': fs * 10}, fs)[0] is False and decidir('R', {'filas': fs}, fs[:2])[0] is True
       and decidir('R', None, [])[0] is True, 'nunca achica a menos de la mitad; sin archivo, copia lo que haya')
    with tempfile.TemporaryDirectory() as tmp:
        os.makedirs(os.path.join(tmp, 'datos'))
        with io.open(ruta('Resultados', 't9', tmp), 'w', encoding='utf-8', newline='\n') as f:
            f.write(t)
        ok(crudas('Resultados', 't9', tmp) == [list(x) for x in fs]
           and filas('Resultados', 't9', tmp)[1] == ['471', '14/10', 'Geoka', '1250', 'Nadie siguió']
           and leer('1v1', 't9', tmp) is None and filas('1v1', 't9', tmp) == [],
           'los archivos se leen como el Sheet: crudas, visibles, y sin archivo no hay filas')
    ok(normal([471, 1250.0, '', 'x', '', None]) == [471, 1250, '', 'x'] and normal(['', '']) == [],
       'una fila como la devuelve el Sheet: sin vacías al final, «1250.0» es 1250')
    with tempfile.TemporaryDirectory() as tmp:
        os.makedirs(os.path.join(tmp, 'datos'))
        pad = [list(f) + [''] * (5 - len(f)) for f in fs]
        r1 = al_escribir('Resultados', cab, pad, base=tmp)
        r2 = al_escribir('Resultados', cab, fs, base=tmp)
        mal = al_escribir('Resultados', cab, fs[:1], base=tmp)
        r4 = al_escribir('Resultados', cab, fs + [[473, '16/10', 'Otro', 1.0, '']], base=tmp)
        ok(r1 is True and r2 is False and mal is None and len(crudas('Resultados', base=tmp)) == 4 and r4 is True
           and crudas('Resultados', base=tmp)[3] == [473, '16/10', 'Otro', 1]
           and al_escribir('Lista de Raperos', cab, fs, base=tmp) is None,
           'quien escribe deja el archivo: con relleno o sin él es el mismo texto, no lo achica y sólo las tres hojas')
    # 🔎 fuente(): con la prueba prendida compara con el Sheet (acá, uno de mentira) y si dan distinto gana el Sheet
    global CONTROL
    import types
    real, ctrl = sys.modules.get('escribir'), CONTROL
    hoja_falsa = {'filas': [['471', '14/10', 'Teito', '1250'], ['471', '14/10', 'Geoka', '1250', 'Nadie siguió']]}
    falso = types.ModuleType('escribir')
    falso.Hoja = lambda nombre: types.SimpleNamespace(filas=lambda: [list(f) for f in hoja_falsa['filas']])
    sys.modules['escribir'] = falso
    try:
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, 'datos'))
            sin = fuente('Resultados', base=tmp)
            al_escribir('Resultados', cab, fs[:2], base=tmp)
            _VISTO.clear()
            igual = fuente('Resultados', base=tmp)
            hoja_falsa['filas'] = hoja_falsa['filas'] + [['472', '15/10', 'Nuevo', '1']]
            distinto = fuente('Resultados', base=tmp)
            CONTROL = False
            hoja_falsa['filas'] = []
            apagado = fuente('Resultados', base=tmp)
        ok(sin == [['471', '14/10', 'Teito', '1250'], ['471', '14/10', 'Geoka', '1250', 'Nadie siguió']]
           and igual == sin and len(distinto) == 3 and distinto[2][2] == 'Nuevo' and apagado == sin,
           'fuente(): sin archivo lee el Sheet; igual, el archivo; distinto, el Sheet; con la prueba apagada, sólo el archivo')
    finally:
        CONTROL = ctrl
        _VISTO.clear()
        if real is not None:
            sys.modules['escribir'] = real
        else:
            sys.modules.pop('escribir', None)
    # 🖊️ la base de quien escribe y el contador
    ctrl0 = CONTROL
    try:
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, 'datos'))
            sin = base_para_escribir('Resultados', lambda: [list(f) for f in fs], base=tmp)
            al_escribir('Resultados', cab, fs, base=tmp)
            igual = base_para_escribir('Resultados', lambda: [list(f) for f in fs], base=tmp)
            distinto = base_para_escribir('Resultados', lambda: [list(f) for f in fs[:2]], base=tmp)
            CONTROL = False
            apagado = base_para_escribir('Resultados', lambda: 1 / 0, base=tmp)
            c0 = contador(base=tmp)
            s1, s2, s3 = guardar_contador(607, base=tmp), guardar_contador(600, base=tmp), guardar_contador(608, base=tmp)
            c1 = contador(base=tmp)
        ok(sin == [normal(f) for f in fs] and igual == sin and distinto == [normal(f) for f in fs[:2]] and apagado == sin,
           'quien escribe parte del archivo si coincide con el Sheet; si no, del Sheet; con la prueba apagada, sin leerlo')
        ok(c0 == 0 and s1 and not s2 and s3 and c1 == 608, 'el contador sólo sube (un número nunca se reusa)')
    finally:
        CONTROL = ctrl0
    # 🪪 la Lista y AKAs: los rangos, las lecturas emuladas y qué hojas toca cada escritura
    ok(_celdas("'Lista de Raperos'!A1001:J1001") == ('Lista de Raperos', 1001, 1, 1001, 10)
       and _celdas('AKAs!A2:C') == ('AKAs', 2, 1, None, 3) and _celdas('AKAs') == ('AKAs', None, None, None, None)
       and _celdas("'Lista de Raperos'!E12") == ('Lista de Raperos', 12, 5, 12, 5),
       'los rangos A1: con comillas, sin fila final, la hoja entera y una sola celda')
    g = rectangular([['Alias', 'Nombre Real', '', 'x'], ['a', 'A'], ['', ''], ['b', 'B', '', ''], ['', '', '', '']])
    ok(valores_de(g, 'AKAs!A1:C') == [['Alias', 'Nombre Real'], ['a', 'A'], [], ['b', 'B']]
       and valores_de(g, 'AKAs!B2:B2') == [['A']] and valores_de(g, 'AKAs') == [['Alias', 'Nombre Real', '', 'x'],
                                                                              ['a', 'A'], [], ['b', 'B']],
       'leer de la grilla da lo mismo que la API: sin vacías al final de la fila ni filas vacías al final')
    ok(hojas_de_pedido('PUT', "/values/%27Lista%20de%20Raperos%27%21E12?valueInputOption=RAW", {}) == {'Lista de Raperos'}
       and hojas_de_pedido('POST', '/values:batchUpdate', {'json': {'data': [{'range': 'AKAs!A3:C3'},
                                                                               {'range': "'Lista de Raperos'!B4"}]}})
       == {'AKAs', 'Lista de Raperos'}
       and hojas_de_pedido('POST', '/values/AKAs%21A2%3AC:clear', {'json': {}}) == {'AKAs'}
       and hojas_de_pedido('POST', ':batchUpdate', {'json': {'requests': [{'deleteDimension': {'range': {'sheetId': 7}}}]}},
                           lambda i: {7: 'Entrada'}.get(i)) == {'Entrada'}
       and hojas_de_pedido('GET', '/values/AKAs', {}) == set(),
       'qué hoja toca cada escritura: un rango, varios, un clear y un cambio de filas (por su sheetId)')
    # 🖊️ un solo escritor: en GitHub pasa, en una PC no (salvo --desde-aca)
    try:
        un_escritor('x', entorno={}, argv=['p', '--aplicar'])
        en_pc = 'pasó'
    except SystemExit as e:
        en_pc = str(e)
    ok(un_escritor('x', entorno={'GITHUB_ACTIONS': 'true'}, argv=['p']) is None
       and un_escritor('x', entorno={}, argv=['p', '--desde-aca']) is None
       and 'gh workflow run recalcular.yml' in en_pc,
       'un solo escritor: en GitHub escribe; en una PC se niega y dice cómo pedirlo, salvo --desde-aca')
    ok(set(HOJAS) == {'Resultados', '1v1', 'Eventos Procesados'}
       and ruta('1v1').endswith(os.path.join('datos', ACTUAL + '_1v1.json')), 'las tres hojas, con la temporada en el nombre')
    # 🛑 ETAPA 5: las que ya no viven en el Sheet se leen y se escriben sólo en su archivo, y sin archivo frena
    SIN_SHEET.update(sin_sheet0)
    ok({'Resultados', '1v1', 'Eventos Procesados'} | set(VITRINAS) == SIN_SHEET,
       'las tres de datos y las cinco vitrinas ya no viven en el Sheet')
    real, ctrl = sys.modules.get('escribir'), CONTROL
    falso = types.ModuleType('escribir')

    def _no_al_sheet(*a, **k):
        raise AssertionError('leyó el Sheet')
    falso.Hoja = _no_al_sheet
    sys.modules['escribir'] = falso
    try:
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, 'datos'))
            try:
                fuente('Resultados', base=tmp)
                frena = False
            except RuntimeError as e:
                frena = 'no está su archivo' in str(e)
            al_escribir('Resultados', cab, fs, base=tmp)
            CONTROL = True
            lee = fuente('Resultados', base=tmp)
            parte = base_para_escribir('Resultados', _no_al_sheet, base=tmp)
            h = HojaLocal('Resultados', base=tmp)
            hf = h.filas()
        ok(frena and lee == [[visible(c) for c in normal(f)] for f in fs] and parte == [normal(f) for f in fs]
           and h.cabecera == cab and h.ancho == 5 and hf == lee,
           'sin el Sheet: aun con la prueba prendida lee y parte sólo del archivo, nunca del Sheet; sin archivo, frena')
    finally:
        CONTROL = ctrl
        if real is not None:
            sys.modules['escribir'] = real
        else:
            sys.modules.pop('escribir', None)

    # 🗄️ LA PRUEBA DE LAS GRILLAS, APAGADA (12/11/2026): en el ciclo se copian al arrancar y se leen del archivo; lo que
    # se escribe se vuelve a copiar antes de leerlo, y lo que no se pudo copiar se lee del Sheet
    from urllib.parse import quote
    G = globals()
    ruta0, leer0 = G['ruta'], G['_leer_grilla_sheet']
    env0 = {k: os.environ.get(k) for k in ('GITHUB_ACTIONS', 'ESPEJO_SIEMPRE', ENV_AL_DIA)}
    del_sheet = {'Lista de Raperos': [['Rapero', 'País'], ['Oasis', 'ar']], 'AKAs': [['Alias', 'Nombre Real'], ['a', 'A']],
                 'Pendientes': [['x']], '✅ Decidir': [['¿?']], 'Config': [['Puesto', 'Puntos'], ['1', '1000']]}
    pedidas = []

    def _falso(h):
        pedidas.append(h)
        if h == 'Pendientes':
            raise RuntimeError('429')                      # ésta no se pudo copiar al arrancar
        return [list(f) for f in del_sheet[h]]

    def _caido(h):
        raise RuntimeError('caído')
    try:
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, 'datos'))
            G['ruta'] = lambda hoja, temp=ACTUAL, base=BASE: os.path.join(tmp, 'datos', '%s_%s.json' % (temp, GRILLAS[hoja]))
            G['_leer_grilla_sheet'] = _falso
            for k in env0:
                os.environ.pop(k, None)
            en_pc = al_dia() == set() and leer_de_archivo('/values/AKAs%21A1%3AC') is None and not pedidas
            os.environ['ESPEJO_SIEMPRE'] = '1'
            listas = al_dia()
            n0 = len(pedidas)
            r1 = leer_de_archivo('/values/AKAs%21A1%3AC')
            otras = [leer_de_archivo(x) for x in ('/values/AKAs%21A1%3AC?valueRenderOption=UNFORMATTED_VALUE',
                                                   '/values/Pendientes%21A2%3AH', '/values/Config%21J2%3AM22',
                                                   '/values/Config', '?fields=sheets.properties', '/values/Resultados%21A1')]
            r_cfg = leer_de_archivo('/values/Config%21A2%3AB2')
            sin_pedir = len(pedidas) == n0
            del_sheet['AKAs'].append(['b', 'B'])            # alguien escribe AKAs en esta corrida
            marcar_sucias({'AKAs'})
            marcada = os.path.exists(_marca('AKAs'))
            r2 = leer_de_archivo('/values/AKAs')
            recopiada = pedidas[n0:] == ['AKAs'] and not os.path.exists(_marca('AKAs')) and 'AKAs' not in _SUCIAS
            io.open(_marca('Lista de Raperos'), 'w', encoding='utf-8').write('otro proceso\n')
            G['_leer_grilla_sheet'] = _caido                # quedó sucia en otro proceso y ahora no se puede copiar
            r3 = leer_de_archivo('/values/' + quote("'Lista de Raperos'!A1:B2"))
            al_sheet = fuente_grilla('Lista de Raperos', lambda: [['Rapero', 'País'], ['Oasis', 'ar']])
    finally:
        G['ruta'], G['_leer_grilla_sheet'] = ruta0, leer0
        for k, v in env0.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        _SUCIAS.clear()
        _COMPARADAS['archivo'] = 0
        _VISTO.clear()
    ok(en_pc, 'grillas en una PC: nada cambia, se leen del Sheet')
    ok(listas == set(GRILLAS) - {'Pendientes'} and sin_pedir
       and r1 == {'range': 'AKAs!A1:C', 'majorDimension': 'ROWS', 'values': [['Alias', 'Nombre Real'], ['a', 'A']]}
       and r_cfg == {'range': 'Config!A2:B2', 'majorDimension': 'ROWS', 'values': [['1', '1000']]}
       and otras == [None] * 6,
       'grillas en el ciclo: al día al arrancar y del archivo sin pedirle al Sheet; con opciones, fuera de lo guardado, '
       'otra hoja o la que no se copió, al Sheet')
    ok(marcada and recopiada and (r2 or {}).get('values') == [['Alias', 'Nombre Real'], ['a', 'A'], ['b', 'B']],
       'grillas: lo escrito en la corrida queda sucio en disco y se vuelve a copiar antes de leerlo')
    ok(r3 is None and al_sheet == [['Rapero', 'País'], ['Oasis', 'ar']],
       'grillas: sucia de otro proceso y sin poder copiarla, se lee del Sheet')
    print('\n   %s' % ('✅ todo bien' if not fallas else '🔴 %d mal' % fallas))
    return 1 if fallas else 0


def main():
    a = sys.argv[1:]
    if '--auto' in a:
        return _self_check()
    if '--comparar' in a:
        print('\n══ EL SHEET CONTRA datos/ ══\n')
        return comparar()
    if '--vitrinas' in a:
        print('\n══ LAS VITRINAS DEL OFICIAL, EN datos/ (etapa 4a) ══\n')
        espejar_vitrinas(aplicar='--aplicar' in a)
        if '--grillas' not in a:
            return 0
    if '--grillas' in a:
        print('\n══ LA LISTA Y AKAs, EN datos/ (etapa 4b) ══\n')
        espejar_grillas(aplicar='--aplicar' in a)
        return 0
    print('\n══ EL OPERATIVO, EN datos/ (etapa 1) ══\n')
    r = espejar(aplicar='--aplicar' in a)
    print('\n══ LAS VITRINAS DEL OFICIAL, EN datos/ (etapa 4a) ══\n')
    espejar_vitrinas(aplicar='--aplicar' in a)
    print('\n══ LA LISTA Y AKAs, EN datos/ (etapa 4b) ══\n')
    espejar_grillas(aplicar='--aplicar' in a)
    # ⚠️ NUNCA FRENA EL CICLO: una hoja que no se copia queda como estaba, y lo dice arriba
    return 0 if r else 0


if __name__ == '__main__':
    sys.exit(main())
