# -*- coding: utf-8 -*-
"""DE UNA LLAVE A PUESTOS Y PUNTOS. El calculo que hoy vive en el Apps Script.

    python sheet/motor.py --tablas     las tablas de Config, como las lee
    python sheet/motor.py --probar     una llave de 16 completa, de punta a punta

    from sheet.motor import procesar
    ev = procesar(batallas, num=349, fecha='20/09', servidor='DRA')
    from sheet.resultados import guardar
    guardar(ev, dry=False)

UNA BATALLA ES UNA FILA DE NUEVE CAMPOS, que es el formato de la hoja
`Entrada` y por lo tanto el unico que ya esta acordado:

    evento · servidor · fecha · participantes · ronda · ladoA · ladoB
    · ganador · notas

🔴 POR QUE SE PORTA, SI `Code.gs` YA LO HACE.

`procesarEvento` calcula esto desde 2025 y **nunca se ejecuto**: el `Log`
del Operativo dice `Total entradas 0` y los 348 eventos entraron por otro
camino. Dlx, 20/09: *«todo es automatico, lo del sheet es viejo»* — el bot
detecta y sube, sin pasar por el menu de la planilla. Este modulo es ese
calculo del lado de Python, para que `sheet/resultados.guardar()` reciba
algo que sumar.

⚠️ **LAS TABLAS SE LEEN DE `Config`, NO SE ESCRIBEN ACA.** Los puntos por
puesto son una decision de la Liga y viven en la planilla; copiarlos a
Python seria el cuarto lugar donde vive un numero que ya tiene duenio, y
este proyecto tiene tres casos documentados de lo que pasa entonces. El
costo es una llamada por evento, que ocurre una vez por torneo.

LO QUE CAMBIA RESPECTO DEL ORIGINAL, Y POR QUE
-----------------------------------------------
**1 · Los nombres se resuelven contra el padron ENTERO.**
`leerRaperos()` lee `A5:A500`. Los datos arrancan en la fila 10 y hay 875
raperos —hasta la 884—, asi que **ve 491 y no ve 384**: a un nombre de esa
mitad no lo encuentra y el evento termina en `Pendientes`, que es
exactamente lo que hay ahi. Aca entra por `sheet/padron.py`, que lee todo.

**2 · `Semifinal` sale de `Config` en vez de calcularse.** El original
ignora la fila `Semifinal` de la tabla y usa `floor((tercero+cuarto)/2)`.
Hoy dan lo mismo en las tres escalas —5250, 3500, 2625— asi que no hay
diferencia que medir; la diferencia es que **si alguien edita esa fila,
en el original no pasa nada**. Se usa el valor declarado y se avisa si no
coincide con el promedio, que es el chequeo que el original no tiene.

⚠️ **LOS PUNTOS DE MOST WANTED NO ESTAN PORTADOS.** `Code.gs` los suma
leyendo el registro de `Config!J2:M22`, y sin ese bloque cada fila sale con
`MW pts` vacio y `Puntos sin MW` igual al total. Es la respuesta honesta
—la misma que la carta Pais da con `—`— y no un cero disfrazado de dato.
Cuando se porten, entran en `_mw()` y nada mas cambia.
"""
import os
import re
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

# Las tres escalas y de que celdas sale cada tabla. ⚠️ SON RANGOS FIJOS,
# igual que en `Code.gs`, y por eso `docs/sheet_operativo.md` dice que en
# `Config` no se insertan ni se borran filas: mover una no falla, calcula mal.
RANGOS = {'16+': 'Config!A7:B14', '8-15': 'Config!C7:D12',
          '4-7': 'Config!A18:B23'}
MODS = 'Config!F5:G15'

# interno -> como se escribe en la hoja `Resultados`
ETIQUETA = {'campeon': 'Campeón', 'subcampeon': 'Subcampeón',
            'tercero': 'Tercero', 'cuarto': 'Cuarto',
            'semifinal': 'Semifinal', 'cuartos': 'Cuartos',
            'octavos': 'Octavos', 'r32': 'R32'}

# las rondas eliminatorias, de la mas honda a la menos, con su puesto
CAIDA = [('cuartos', 'cuartos'), ('octavos', 'octavos'), ('r32', 'r32')]

# 🔴 EL PUENTE ENTRE DOS VOCABULARIOS QUE TENIAN QUE COINCIDIR Y NO
# COINCIDIAN. `bot/escuchar.py` normaliza **toda** forma de escribir una
# ronda a un juego de nombres —`SEMIFINALES`, `TERCER LUGAR`,
# `DIECISEISAVOS`— y este modulo buscaba otros: `semifinal`, `tercer
# puesto`, `r32`. Tres de ocho no se encontraban nunca.
#
# Lo que costaba, medido el 23/09/2026 sobre las llaves cargadas:
# `por('semifinal')` devolvia **[]** en las dos, asi que **los cuatro
# perdedores de semifinal no recibieron ninguna fila**. Los de cuartos
# si —esa palabra coincide— y el campeon y el subcampeon tambien. O sea
# que la llave se cargaba entera menos una ronda, y justo la que mas
# puntos da despues del podio: `Config` dice **5250** para una de 16+.
#
# ⚠️ NO FALLABA NI AVISABA. Salia un evento valido al que le faltan dos
# personas, y esas dos quedan con `Ev=0` — o sea con su Bloqueada
# diciendo «0/1 PARTICIPACION» despues de haber llegado a semifinales.
# Se vio mirando la carta de MAU KC, no leyendo el codigo.
#
# ⚠️ Y LA DIRECCION DEL PUENTE IMPORTA: manda el lector, porque es lo
# que queda escrito en `Entrada`. Cambiar los nombres del motor y no los
# de la hoja dejaria los datos viejos sin leer.
DE_LLAVE = {
    'semifinales': 'semifinal',
    'tercer lugar': 'tercer puesto',
    'dieciseisavos': 'r32',
    'gran final': 'final',
    'cuartos de final': 'cuartos',
}


def norm(s):
    """minusculas sin tildes. Es `normPos` de Code.gs, igual."""
    s = unicodedata.normalize('NFD', str(s or '').lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').strip()


def ronda_de(r):
    """El nombre que usa este módulo para esa ronda. Ver `DE_LLAVE`."""
    n = norm(r)
    return DE_LLAVE.get(n, n)


def escala_de(participantes):
    n = int(participantes or 0)
    return '16+' if n >= 16 else '8-15' if n >= 8 else '4-7' if n >= 4 else None


#: Lo que la llave escribe **al lado** del nombre y no es el nombre:
#: `(sustituto)`, y los emoji que no son banderas —`👻` marca algo del
#: torneo—. Las banderas ya las saca `comun/claves.clave()`.
_ANOTACION = re.compile(r'\([^)]*\)')
_EMOJI = re.compile('[\U0001F300-\U0001FAFF☀-➿]')


def _sin_anotaciones(n):
    """El nombre sin lo que la llave le agrega. Ver `resolver()`."""
    return _EMOJI.sub('', _ANOTACION.sub('', str(n or ''))).strip()


def equipo(nombre):
    """Los integrantes de un lado. Vive en `sheet/equipos.py`.

    🔴 ESTO PARTIA SOLO POR COMA Y POR ESO NUNCA SE ACTIVO. La division
    de puntos de `sumar()` esta escrita desde siempre —`pts // len(ms)`—
    y el primer evento por equipos de la T1 igual le dio el puesto
    completo a cada equipo: la gente escribe `sosa+papa+ bna🇯🇴`, no
    `sosa, papa, bna`. Medido el 22/09/2026 sobre #349: de 5 lados por
    equipos, **0 se partieron**, y los 15 integrantes reales no sumaron
    un punto. No fallo nada — se cargaron cinco «raperos» inventados.

    Es la forma que `CLAUDE.md` documenta tres veces: la decision existia
    en el codigo, leyendo otro formato. Ahora el separador vive en un solo
    lugar y lo usan tambien `resultados._filas_uno()` y el lector.
    """
    from equipos import integrantes
    ns, _cortado = integrantes(nombre)
    return ns


# ── lo que se lee de la planilla ──────────────────────────────────────

def _leer(rng):
    # 🔴 CON REINTENTO: las tablas de puntos se leen en cada carga de
    # eventos del ciclo, y un 429 acá tumbaba la carga entera. Es el mismo
    # agujero que mató el ciclo de las 6:52 AM ET del 24/09/2026 desde otro
    # archivo. Ver `sheet/reintentar.py`.
    import requests
    from escribir import token, API, id_operativo
    from reintentar import leer

    def _pedir():
        r = requests.get('%s/%s/values/%s'
                         % (API, id_operativo(), requests.utils.quote(rng)),
                         headers={'Authorization': 'Bearer ' + token()},
                         timeout=60)
        r.raise_for_status()
        return r.json().get('values', [])
    return leer(_pedir)


def _pct(v):
    """`50%` o `0,5` o `0.5` -> 0.5. Vacio -> 0."""
    s = str(v or '').strip().replace(',', '.')
    if not s:
        return 0.0
    if s.endswith('%'):
        return float(s[:-1]) / 100.0
    x = float(s)
    # ⚠️ UN `50` SUELTO ES 50 %, NO 5000 %. La celda esta formateada como
    # porcentaje, asi que la API puede devolver `50%` o `0.5` segun como se
    # la haya escrito. Un numero mayor que 1 solo puede ser lo primero.
    return x / 100.0 if x > 1 else x


def tablas():
    """{escala: {puesto: puntos}} desde `Config`."""
    out = {}
    for esc, rng in RANGOS.items():
        d = {}
        for f in _leer(rng):
            if len(f) >= 2 and str(f[0]).strip() and str(f[1]).strip():
                try:
                    d[norm(f[0])] = int(float(str(f[1]).replace(',', '')))
                except ValueError:
                    continue
        out[esc] = d
    return out


def modificadores():
    filas = {}
    for i, f in enumerate(_leer(MODS)):
        filas[5 + i] = f
    def col(n, j=1):
        f = filas.get(n) or []
        return f[j] if len(f) > j else ''
    return {'walkin': {0: _pct(col(7)), 1: _pct(col(8)),
                       2: _pct(col(9)), 3: 0.0},
            'revivido': _pct(col(12)), 'invitado': _pct(col(14))}


def _resolvedor():
    """nombre suelto -> nombre del padron. Cae con gracia si no responde.

    🔴 Y ANOTA LOS QUE NO ENCUENTRA, EN `resolver.fallo`.

    Sin eso, un nombre mal tipeado **se convierte en un rapero nuevo** y
    nadie se entera: probado el 20/09/2026, escribir `Konnan` en la final
    de una llave de 16 da un `Konnan` campeon con 10.000 puntos, sin un
    solo aviso. En un flujo donde las llaves las carga una persona a mano
    —que es el caso, Dlx 20/09— **ese es el fallo mas probable de todos**,
    y encima el mas caro: ensucia el padron, el ranking y las tarjetas a
    la vez, y se descubre cuando alguien pregunta quien es Konnan.

    ⚠️ Devolver el nombre tal cual sigue siendo lo correcto: el motor no
    puede decidir que hacer. Lo que no puede pasar es que no se avise.
    """
    def _pelado(n):
        return str(n or '').strip()

    try:
        from padron import seguro
        from comun.claves import clave
        p = seguro()
    except Exception:                                    # noqa: BLE001
        _pelado.fallo = set()
        _pelado.padron = {}
        return _pelado, 0
    porclave = {}
    for d in p.values():
        nom = d.get('nombre') or ''
        if nom:
            porclave.setdefault(clave(nom), nom)

    # 🔴 Y LOS AKAs, QUE ESTE RESOLVEDOR NO MIRABA. Dlx, 22/09/2026:
    # *«deberia usarse los AKAS registrados de como se verificaron o como
    # se encuentran en lista de raperos o akas»*.
    #
    # El indice se armaba **solo con los nombres del padron**, asi que un
    # alias registrado no servia de nada acá. Medido ese dia sobre la
    # llave #349: `Pichulitamc` cayo en `Pendientes` como «no esta en el
    # padron» **teniendo su fila en `AKAs`** —`Pichulitamc -> PichulaMc`,
    # uno de los 185 alias cargados—. La hoja existe, la cargamos, la
    # construye `sheet/construir_akas.py`, y el unico paso que resuelve
    # nombres de llaves leia otra cosa.
    #
    # Es la misma forma que `comun/crews.py` ya denunciaba de esta misma
    # hoja: *«la hoja AKAs del Operativo resuelve kibak -> valen, y este
    # cruce NO los resuelve»*.
    #
    # ⚠️ VAN DESPUES Y CON `setdefault`: un nombre real NUNCA lo pisa un
    # alias. Si alguien se llama igual que el alias de otro, gana la
    # persona — que es lo que evita unir a dos por parecido.
    try:
        import construir_akas as _AK
        _alias = (_AK.cargar() or {}).get('alias') or {}
        for _a, _real in _alias.items():
            k = clave(_a)
            if k and _real:
                # y el alias apunta al nombre del padron, no al texto
                # crudo de la hoja: si `PichulaMc` esta escrito distinto
                # alla, se resuelve una vez acá y no en cada llamada.
                porclave.setdefault(k, porclave.get(clave(_real), _real))
    except Exception:                                    # noqa: BLE001
        # sin AKAs se sigue con el padron: menos resolucion, no un fallo
        pass

    def resolver(n):
        n = str(n or '').strip()
        if not n:
            return ''
        hallado = porclave.get(clave(n))
        if hallado is None:
            # 🔴 SEGUNDO INTENTO SIN LAS ANOTACIONES DE LA LLAVE, y esto
            # es lo unico que las separa de un nombre desconocido.
            # Medido el 22/09/2026 sobre #349: `Pichulitamc🇦🇷👻`,
            # `Neo🇦🇷👻(pollo)` y `agus🇦🇷(yinn)` cayeron en `Pendientes`
            # como «no esta en el padron». Dos de los tres SI estan —Neo
            # y Agus— y lo que sobraba era el `👻` y el `(sustituto)` que
            # la llave escribe al lado del nombre.
            #
            # ⚠️ ES UN **RESPALDO**, NO UNA LIMPIEZA DE ENTRADA, y la
            # diferencia importa: `TøKīØ🦠🧠` es un nombre real del padron
            # **con emoji**. Limpiar siempre lo romperia. Se prueba tal
            # cual primero y solo si no aparece se reintenta pelado.
            #
            # ⚠️ Y `(algo)` SE TIRA, o sea que el puesto queda del titular
            # del casillero. `agus🇦🇷(yinn)` en la final quiere decir que
            # yinn entro por agus: quien cobra es una decision de la Liga,
            # no del parser, y el titular es la lectura conservadora. Si
            # Dlx decide al reves, se cambia aca y en un solo lugar.
            pelado = _sin_anotaciones(n)
            if pelado and pelado != n:
                hallado = porclave.get(clave(pelado))
            if hallado is None:
                # 🔴 SIN EL `(algo)`, AUNQUE NO ESTÉ EN EL PADRÓN. Antes se
                # devolvía `n` tal cual, así que un desconocido quedaba
                # bautizado con su anotación: `money maker(cj)` y `money
                # maker` eran dos personas en la vitrina —las dos estaban
                # en la hoja el 24/09/2026— y en `1v1` el duelo salía a
                # nombre de la versión con paréntesis. Lo de adentro es
                # a quién le ganó o quién entró por él, nunca su nombre.
                #
                # ⚠️ SÓLO EL PARÉNTESIS, NO LOS EMOJIS: `TøKīØ🦠🧠` es un
                # nombre real con emoji, que es la razón de arriba para
                # probar primero tal cual. Y sigue anotado como
                # desconocido, así que va a `Pendientes` igual — con el
                # nombre que alguien puede buscar.
                limpio = _ANOTACION.sub('', n).strip() or n
                resolver.fallo.add(limpio)
                return limpio
        return hallado
    resolver.fallo = set()
    resolver.padron = porclave
    return resolver, len(porclave)


def parecidos(nombre, resolver, n=3):
    """Los nombres del padron mas parecidos, para sugerir en un typo.

    ⚠️ ES LA MITAD DEL VALOR DE DETECTARLO. «no encontre Konnan» manda a
    alguien a buscar a mano entre 875 nombres; «no encontre Konnan,
    ¿sera Konan?» se arregla en cinco segundos.
    """
    import difflib
    from comun.claves import clave
    pad = getattr(resolver, 'padron', None) or {}
    if not pad:
        return []
    cerca = difflib.get_close_matches(clave(nombre), list(pad), n=n, cutoff=0.7)
    return [pad[c] for c in cerca]


# ── el calculo ────────────────────────────────────────────────────────

def _perdedor(b):
    """El lado que no gano. Se compara por CLAVE y no por texto.

    ⚠️ `Code.gs` hace `ladoA === ganador`, comparacion exacta de cadenas.
    Con `Konan ` y `Konan`, o `KONAN` y `Konan`, da falso y devuelve el
    lado equivocado: el campeon pasa a subcampeon **sin fallar**. Es el
    caso mas caro posible y lo decide un espacio.
    """
    g = norm(b.get('ganador'))
    a, c = b.get('ladoA', ''), b.get('ladoB', '')
    if norm(a) == g:
        return c
    if norm(c) == g:
        return a
    # el ganador no es ninguno de los dos lados tal cual: puede ser un
    # miembro de un equipo. Se busca por miembro antes de rendirse.
    if g in [norm(x) for x in equipo(a)]:
        return c
    if g in [norm(x) for x in equipo(c)]:
        return a
    return None


def procesar(batallas, num, fecha, servidor, participantes=None,
             tab=None, mods=None, resolver=None):
    """De una lista de batallas al dict que `resultados.guardar()` toma."""
    if not batallas:
        raise ValueError('no hay batallas')
    if participantes is None:
        participantes = max(int(b.get('participantes') or 0) for b in batallas)
    esc = escala_de(participantes)
    if not esc:
        raise ValueError('con %s participantes no hay escala (el minimo es 4)'
                         % participantes)
    tab = (tab or tablas())[esc]
    mods = mods if mods is not None else modificadores()
    if resolver is None:
        resolver, _ = _resolvedor()
    # ⚠️ SE MIRA LO QUE FALLA EN ESTE EVENTO, NO EN TODA LA CORRIDA. El
    # resolvedor se reusa entre eventos —cuesta una lectura del padron— asi
    # que sin este corte el segundo evento hereda los nombres rotos del
    # primero y no se sabe cual es de quien.
    antes = set(getattr(resolver, 'fallo', ()))

    res, avisos = {}, []

    def sumar(lado, pts, puesto, salvo=()):
        ms = equipo(lado)
        if not ms:
            return
        # ⚠️ EL EQUIPO DIVIDE Y REDONDEA PARA ABAJO, como el original.
        cuota = pts // len(ms) if len(ms) > 1 else pts
        for m in ms:
            q = resolver(m)
            # la cuota es la del equipo entero; `salvo` sólo saltea a quien
            # ya cobró un puesto más alto. Ver el bucle de `CAIDA`.
            if q in salvo:
                continue
            d = res.setdefault(q, {'rapero': q, 'puntos': 0, 'posicion': '',
                                   'notas': ''})
            d['puntos'] += cuota
            d['posicion'] = ETIQUETA.get(puesto, puesto)

    def por(r):
        # ⚠️ LA RONDA DE LA BATALLA PASA POR `DE_LLAVE` ANTES DE
        # COMPARAR. Ver su comentario: el lector escribe `semifinales` y
        # acá se pregunta por `semifinal`.
        return [b for b in batallas if ronda_de(b.get('ronda')) == r]

    final = (por('final') or [None])[0]
    tercer = (por('tercer puesto') or [None])[0]

    if final:
        sumar(final.get('ganador'), tab.get('campeon', 0), 'campeon')
        sub = _perdedor(final)
        if sub is None:
            avisos.append('la final: el ganador %r no es ninguno de los dos '
                          'lados' % final.get('ganador'))
        else:
            sumar(sub, tab.get('subcampeon', 0), 'subcampeon')

    if tercer:
        sumar(tercer.get('ganador'), tab.get('tercero', 0), 'tercero')
        c4 = _perdedor(tercer)
        if c4 is not None:
            sumar(c4, tab.get('cuarto', 0), 'cuarto')
    else:
        semis = por('semifinal')
        if len(semis) >= 2:
            # ⚠️ EL VALOR DECLARADO MANDA, Y SE COMPRUEBA. Ver el docstring.
            prom = (tab.get('tercero', 0) + tab.get('cuarto', 0)) // 2
            sf = tab.get('semifinal', prom)
            if sf != prom:
                avisos.append('Config dice Semifinal=%d y el promedio de '
                              'tercero/cuarto da %d. Uso el de Config.'
                              % (sf, prom))
            for b in semis:
                p = _perdedor(b)
                if p is not None:
                    sumar(p, sf, 'semifinal')

    # ⚠️ EL QUE YA TIENE PUESTO NO SE PISA. Quien perdio en cuartos pero
    # jugo el tercer puesto ya cobro; el original lo cuida igual.
    for ronda, puesto in CAIDA:
        for b in por(ronda):
            p = _perdedor(b)
            if p is None:
                continue
            # 🔴 SE MIRA A CADA INTEGRANTE, NO SÓLO AL PRIMERO. Esto
            # preguntaba si el PRIMER integrante del equipo perdedor ya
            # tenía puesto, y si lo tenía salteaba al equipo ENTERO. En
            # CARABOBO (25/09/2026) `nc` perdió cuartos con `g8` y después
            # llegó a la final con otra dupla: como `nc` ya cobraba el
            # subcampeonato, `g8` se quedaba sin sus cuartos. Ahora cobra
            # cada uno el que no tiene un puesto más alto, con la cuota
            # del equipo completo.
            ya = {resolver(m) for m in (equipo(p) or [p])} & set(res)
            if ya and len(ya) == len(equipo(p) or [p]):
                continue
            sumar(p, tab.get(puesto, 0), puesto, salvo=ya)

    # 🔴 LOS MODIFICADORES CAEN SOBRE **LOS DOS LADOS**, Y ESO PARECE UN
    # BUG DEL ORIGINAL. `Code.gs:336` hace
    # `for (const n of [b.ladoA, b.ladoB])`, asi que una nota de
    # `Walk-in 3` en una batalla deja en **cero** a los dos: al que
    # salteo rondas y al que peleo normal.
    #
    # Medido el 21/09/2026 con una final Konan vs Axinu y `Walk-in 3`:
    #
    #     Konan   Campeon      0    Walk-in 3
    #     Axinu   Subcampeon   0    Walk-in 3      <- este no hizo nada
    #
    # Lo mismo con `Revivido`: los dos a la mitad.
    #
    # ⚠️ SE PORTA IGUAL A PROPOSITO. Cambiarlo es una decision de reglas
    # —a quien castiga un walk-in— y no la puede tomar el que escribe el
    # motor. Pero **hay que decidirlo antes de la T1**: con eventos de
    # verdad esto le baja los puntos a gente que peleo bien, y el
    # sintoma seria «me faltan puntos» sin nada en que apoyarse.
    #
    # Si se decide que solo castiga al que salteo, la nota tiene que
    # decir **a quien** —hoy es una nota de la batalla, no de la
    # persona—, asi que tambien cambia el formato de `Entrada`.
    #
    # Anotado en ESTADO.md, en lo que queda para Dlx.
    for b in batallas:
        n = str(b.get('notas') or '').lower()
        if not n:
            continue
        lados = equipo(b.get('ladoA')) + equipo(b.get('ladoB'))
        if 'revivido' in n:
            for x in lados:
                d = res.get(resolver(x))
                if d:
                    d['puntos'] = int(d['puntos'] * mods['revivido'])
                    d['notas'] += '(R) '
        # 🔑 `Walk-in N: nombre` CASTIGA SOLO A ESE NOMBRE. La guia de
        # formatos de Dlx (23/09/2026, §4.1) decide lo que el comentario
        # de arriba dejaba abierto: el walk-in cobra menos «porque se
        # salto camino», no su rival. Sin nombre se porta como antes.
        mq = re.search(r'walk-in\s+(\d+)\s*:\s*([^;|]+)',
                       str(b.get('notas') or ''), re.I)
        if mq:
            rondas = min(int(mq.group(1)), 3)
            pct = mods['walkin'].get(rondas, 0.0)
            d = res.get(resolver(mq.group(2).strip()))
            if d:
                d['puntos'] = int(d['puntos'] * pct)
                d['notas'] += 'Walk-in %d ' % rondas
            continue
        m = re.search(r'walk-in\s+(\d+)', n)
        if m:
            rondas = min(int(m.group(1)), 3)
            pct = mods['walkin'].get(rondas, 0.0)
            for x in lados:
                d = res.get(resolver(x))
                if d:
                    d['puntos'] = int(d['puntos'] * pct)
                    d['notas'] += 'Walk-in %d ' % rondas

    # 🔴 LOS NOMBRES DE LOS DUELOS SE RESUELVEN, IGUAL QUE LOS DE LOS
    # RESULTADOS. Esto guardaba el nombre **crudo de la llave** —`MASINO
    # 🇨🇱`— mientras `ev['resultados']` guardaba el resuelto —`Masino`—,
    # asi que la misma persona entraba DOS VECES a todo lo que agrega
    # las dos hojas.
    #
    # ⚠️ EL SINTOMA ERA UN RANKING A MEDIAS, no un error. Medido el
    # 23/09/2026 sobre el primer `Ranking Duelos` con datos: siete de
    # ocho filas salieron **sin servidor y sin rango**, porque esos dos
    # se buscan por el nombre del padron y ahi estaba el de la llave.
    # Nada fallo: la tabla salio, con dos columnas vacias.
    #
    # ⚠️ Y ROMPE `DNA`/`DIN` DE LA CARTA DE PAIS, que cruzan el rival
    # contra el padron para saber su nacionalidad: con el nombre crudo,
    # ese cruce no engancha.
    # ⚠️ POR INTEGRANTE, NO POR LADO. Un lado puede ser un equipo
    # —`Krtman, Trot`— y resolverlo entero lo manda a `Pendientes` como
    # un nombre desconocido que no existe. Se parte, se resuelve cada
    # uno y se vuelve a juntar: el lado sigue leyendose igual y cada
    # integrante queda con el nombre del padron.
    def _r(x):
        n = str(x or '').strip()
        if not n:
            return ''
        ms = equipo(n)
        if len(ms) <= 1:
            return resolver(n)
        return ', '.join(resolver(m) for m in ms)

    duelos = [{'ronda': b.get('ronda', ''), 'a': _r(b.get('ladoA')),
               'b': _r(b.get('ladoB')), 'ganador': _r(b.get('ganador')),
               'notas': b.get('notas', '')} for b in batallas]

    # ⚠️ LA NOTA `NUEVO` YA EXISTE EN LA HOJA Y SIGNIFICA ESTO.
    # `Entrada` documenta siete notas validas y una es **«NUEVO · rapero no
    # registrado»**: o sea que la convencion para «este nombre no esta en
    # el padron a proposito» **ya estaba acordada** antes de que yo pusiera
    # el freno por nombre desconocido. Honrarla es gratis y evita inventar
    # una segunda forma de decir lo mismo — que es como nacen las dos
    # fuentes que este repo documenta tres veces.
    esperados = set()
    for b in batallas:
        if 'nuevo' in str(b.get('notas') or '').lower():
            esperados |= {x.strip() for x in
                          equipo(b.get('ladoA')) + equipo(b.get('ladoB'))}
    # 🔴 LA MISMA PERSONA A LOS DOS LADOS DE UNA BATALLA ES IMPOSIBLE, y
    # cuando pasa es porque un alias fusionó a dos que no son uno. Es el
    # error que la guía de formatos de Dlx (23/09/2026, parte 5) llama
    # «el alias peligroso»: *«si un alias y su nombre real aparecen AMBOS
    # en el mismo evento como personas distintas, NO los fusiones»* — con
    # BNA y Hassan de rivales, la IA los juntó y dejó a Hassan en los dos
    # equipos de la final.
    #
    # ⚠️ Pasó el 25/09/2026 con un alias que se declaró ese mismo día:
    # `Fleivacheck -> fleivaman`, y en ELRAP FECHA 6 los dos pelean en la
    # misma batalla de octavos. Se avisa acá porque el mapa de AKAs es
    # global y la contradicción sólo se ve dentro de un evento.
    for b in batallas:
        a, c = b.get('ladoA'), b.get('ladoB')
        if a and c and len(equipo(a)) <= 1 and len(equipo(c)) <= 1:
            ra, rc = resolver(a), resolver(c)
            if ra and ra == rc and _sin_anotaciones(a) != _sin_anotaciones(c):
                avisos.append('«%s» y «%s» pelean en la misma batalla y el '
                              'mapa de AKAs los hace la misma persona (%s): '
                              'revisar ese alias' % (a, c, ra))

    sin = sorted(set(getattr(resolver, 'fallo', ())) - antes - esperados)
    return {'num': num, 'fecha': fecha, 'servidor': servidor, 'escala': esc,
            'participantes': participantes,
            'resultados': sorted((dict(v, notas=v['notas'].strip())
                                  for v in res.values()),
                                 key=lambda r: -r['puntos']),
            'duelos': duelos, 'avisos': avisos, 'sin_resolver': sin}


# ── la llave de prueba ────────────────────────────────────────────────

def _llave16():
    """Una llave de 16 completa: 8 de R16, 4 de cuartos, 2 semis, 3º y final.

    ⚠️ CON UN EQUIPO Y UN WALK-IN A PROPOSITO. Los dos caminos que el
    original trata distinto -dividir y multiplicar- no aparecen en una
    llave limpia, o sea que una prueba sin ellos no prueba lo que importa.
    """
    # 16 CASILLEROS, 17 PERSONAS: uno de los lados es un duo, que es como
    # un equipo entra de verdad —ocupa un casillero, no dos—. Ese duo
    # termina CUARTO, asi que la division cae sobre 4500 y se ve en el
    # resultado; con el duo perdiendo en octavos habria que mirar 1250/2 y
    # el caso interesante no se distinguiria del redondeo.
    n = ['Konan', 'Axinu', 'Bau', 'Rodas', 'Val', 'Bloody', 'MCO', 'Ceko',
         'Vize', 'Tam', 'Jupiter', 'Provenza', 'Krtman, Trot', 'Rayo',
         'Am', 'Olaf']
    b = []
    def bat(ronda, a, c, g, notas=''):
        b.append({'evento': 'Prueba', 'servidor': 'DRA', 'fecha': '20/09',
                  'participantes': 16, 'ronda': ronda, 'ladoA': a,
                  'ladoB': c, 'ganador': g, 'notas': notas})
    for i in range(8):
        bat('Octavos', n[i * 2], n[i * 2 + 1], n[i * 2],
            'Walk-in 1' if i == 7 else '')
    g8 = [n[i * 2] for i in range(8)]
    for i in range(4):
        bat('Cuartos', g8[i * 2], g8[i * 2 + 1], g8[i * 2])
    g4 = [g8[i * 2] for i in range(4)]
    # 🔴 LOS NOMBRES SON LOS QUE ESCRIBE EL LECTOR, NO LOS DE ESTE
    # MODULO. Decían `Semifinal` y `Tercer puesto` —el vocabulario
    # interno— y por eso la prueba pasaba mientras el código no
    # encontraba **ninguna** semifinal de las llaves reales, que llegan
    # como `semifinales`. Un fixture escrito en el idioma del código no
    # puede cazar una discrepancia de idioma: se prueba a sí mismo.
    #
    # ⚠️ Lo que vale es lo que queda en `Entrada`, y eso lo decide
    # `bot/escuchar.py` con su tabla `ALIAS`. Ver `DE_LLAVE`.
    bat('SEMIFINALES', g4[0], g4[1], g4[0])
    bat('SEMIFINALES', g4[2], g4[3], g4[2])
    bat('TERCER LUGAR', g4[1], g4[3], g4[1])
    bat('FINAL', g4[0], g4[2], g4[0])
    return b


def _self_check():
    """Que la llave de 16 siga dando lo que el codigo dice que da.

    🔴 EL FIXTURE YA ESTABA Y NADIE LO AFIRMABA. `--probar` imprime la
    tabla y la lee una persona: si manana un cambio le saca la division al
    equipo, la tabla sale igual de prolija con el numero mal.

    ⚠️ SE COMPRUEBAN RELACIONES, NO VALORES. Los puntos salen de la hoja
    `Config` y se pueden ajustar; afirmar `10000` seria una alarma que
    salta cuando Dlx cambia la tabla, o sea pidiendo el arreglo
    equivocado. Lo que el codigo implementa —y lo que tiene que seguir
    valiendo— es que el equipo divide, que el walk-in castiga y que el
    orden de los puestos se respeta.
    """
    mal = 0
    print('\n══ EL MOTOR, SOBRE LA LLAVE DE 16 ══\n')
    try:
        ev = procesar(_llave16(), num=9999, fecha='20/09', servidor='DRA',
                      participantes=16)
    except Exception as e:                               # noqa: BLE001
        print('   🔴 no pudo procesar la llave: %s' % str(e)[:80])
        return 1

    pts = {r['rapero']: r for r in ev['resultados']}
    por_puesto = {}
    for r in ev['resultados']:
        por_puesto.setdefault(r['posicion'], []).append(r)

    def ok(que, cond, detalle=''):
        nonlocal_mal[0] += 0 if cond else 1
        print('   %s %-46s %s' % ('✅' if cond else '🔴', que, detalle))

    nonlocal_mal = [0]

    # 1 · 16 casilleros y 17 personas: el duo ocupa uno y cobran los dos
    ok('17 personas con puntos de 16 casilleros', len(pts) == 17,
       '%d' % len(pts))

    # 2 · EL EQUIPO DIVIDE. Los dos del duo tienen que cobrar exactamente
    #     la mitad de lo que cobra un cuarto puesto solo.
    duo = [r for r in ev['resultados'] if r['rapero'] in ('Krtman', 'Trot')]
    ok('el dúo son dos filas', len(duo) == 2, '%d' % len(duo))
    if len(duo) == 2:
        ok('los dos del dúo cobran lo mismo',
           duo[0]['puntos'] == duo[1]['puntos'],
           '%d y %d' % (duo[0]['puntos'], duo[1]['puntos']))
        solo = next((r['puntos'] for r in ev['resultados']
                     if r['posicion'] == duo[0]['posicion']
                     and r['rapero'] not in ('Krtman', 'Trot')), None)
        if solo is None:
            # nadie mas quedo cuarto: se compara contra la tabla
            t = tablas()[ev['escala']]
            solo = int(t.get('cuarto') or 0)
        ok('el dúo cobra la MITAD de un cuarto solo',
           solo and duo[0]['puntos'] * 2 == solo,
           '%d x 2 = %d, solo=%s' % (duo[0]['puntos'],
                                     duo[0]['puntos'] * 2, solo))

    # 3 · EL WALK-IN CASTIGA. Quien lo perdio cobra menos que un octavos
    #     normal, y los dos estan en el mismo puesto.
    olaf = pts.get('Olaf')
    normal = next((r for r in ev['resultados']
                   if r['posicion'] == (olaf or {}).get('posicion')
                   and not (r.get('notas') or '')), None)
    ok('el que pierde por walk-in existe', olaf is not None)
    if olaf and normal:
        ok('y cobra MENOS que el mismo puesto sin walk-in',
           olaf['puntos'] < normal['puntos'],
           '%d < %d' % (olaf['puntos'], normal['puntos']))

    # 4 · EL ORDEN DE LOS PUESTOS. Campeon > subcampeon > tercero.
    cam = next((r['puntos'] for r in ev['resultados']
                if r['posicion'] == 'Campeón'), 0)
    sub = next((r['puntos'] for r in ev['resultados']
                if r['posicion'] == 'Subcampeón'), 0)
    ter = next((r['puntos'] for r in ev['resultados']
                if r['posicion'] == 'Tercero'), 0)
    ok('campeón > subcampeón > tercero', cam > sub > ter > 0,
       '%d > %d > %d' % (cam, sub, ter))

    # 5 · LOS DUELOS. 16 batallas, y cada una deja un ganador y un perdedor.
    ok('16 batallas -> 16 duelos', len(ev.get('duelos') or []) == 16,
       '%d' % len(ev.get('duelos') or []))

    # 🔴 Y LAS 16 NO SON 16 EN `1v1`: LAS DEL DUO NO SON DUELOS. Esto no
    # se probaba en ningun lado, y por eso el filtro pudo pasar meses
    # mirando la coma mientras el dato venia con `+`. `ev['duelos']` son
    # las batallas **crudas**; el filtro vive en `resultados._filas_uno()`
    # y es el que Dlx definio: *«solo vale cuando el formato es 1v1, no
    # 1v3 o 2v2»*. Se prueba aca porque aca esta la llave con un duo.
    try:
        import resultados as _RES
        crudo = dict(ev)
        crudo.update({'num': 0, 'fecha': '', 'servidor': ''})
        filas = _RES._filas_uno(crudo)
        del_duo = [b for b in ev['duelos']
                   if len(equipo(b.get('a'))) > 1 or len(equipo(b.get('b'))) > 1]
        ok('las batallas del dúo NO entran a `1v1`',
           len(filas) == len(ev['duelos']) - len(del_duo),
           '%d de %d (el dúo peleó %d)'
           % (len(filas), len(ev['duelos']), len(del_duo)))
        ok('y el dúo peleó al menos una, o esto no prueba nada',
           len(del_duo) >= 1, '%d' % len(del_duo))
    except Exception as e:                               # noqa: BLE001
        ok('las batallas del dúo NO entran a `1v1`', False, str(e)[:60])
    ok('ningún nombre quedó sin resolver', not ev.get('sin_resolver'),
       '%s' % (ev.get('sin_resolver') or '—'))

    # 🔴 QUE EL MOTOR ENTIENDA **TODAS** LAS RONDAS QUE EL LECTOR ESCRIBE.
    #
    # Son dos vocabularios que tienen que coincidir y vivían en archivos
    # distintos sin nada que los cruzara: `bot/escuchar.py` normaliza a
    # `SEMIFINALES` y acá se buscaba `semifinal`. Tres de ocho nombres no
    # se encontraban nunca, y el precio fueron **los cuatro perdedores de
    # semifinal de las dos llaves de la T1**, sin una sola fila.
    #
    # ⚠️ Se pregunta contra el lector de verdad, importándolo. Escribir
    # la lista acá sería una tercera copia del mismo vocabulario, que es
    # justo la forma que este repo documenta que se queda vieja.
    try:
        sys.path.insert(0, os.path.join(BASE, 'bot'))
        import escuchar as _E
        # lo que el lector puede dejar escrito: los destinos de su ALIAS
        # más las alternativas literales de su regex de ronda
        vocab = set(_E.ALIAS.values())
        vocab |= {'CLASIFICATORIAS', 'PRELIMINARES', 'DIECISEISAVOS',
                  'OCTAVOS', 'CUARTOS', 'SEMIFINALES', 'TERCER LUGAR',
                  'FINAL'}
        conocidas = ({'final', 'tercer puesto', 'semifinal'}
                     | {r for r, _p in CAIDA}
                     | {'clasificatorias', 'preliminares'})
        raras = sorted(v for v in vocab if ronda_de(v) not in conocidas)
        ok('el motor entiende toda ronda que el lector escribe',
           not raras, '%s' % (raras or '—'))
    except Exception as e:                               # noqa: BLE001
        ok('el motor entiende toda ronda que el lector escribe', False,
           'no pude preguntarle a escuchar.py: %s' % str(e)[:50])

    mal = nonlocal_mal[0]
    print('')
    if mal:
        print('   🔴 %d relación(es) del motor dejaron de valer\n' % mal)
        return mal
    print('   ✅ el motor hace lo que dice: el dúo divide, el walk-in '
          'castiga,\n      y los puestos se ordenan\n')
    return 0


def main():
    if '--tablas' in sys.argv:
        print('\n══ LAS TABLAS DE `Config` ══\n')
        t = tablas()
        puestos = ['campeon', 'subcampeon', 'tercero', 'cuarto', 'semifinal',
                   'cuartos', 'octavos', 'r32']
        print('   %-12s %8s %8s %8s' % ('', '16+', '8-15', '4-7'))
        for p in puestos:
            print('   %-12s %8s %8s %8s'
                  % (p, t['16+'].get(p, '—'), t['8-15'].get(p, '—'),
                     t['4-7'].get(p, '—')))
        m = modificadores()
        print('\n   walk-in  %s' % '  '.join('%d rondas %.0f%%' % (k, v * 100)
                                             for k, v in sorted(m['walkin'].items())))
        print('   revivido %.0f%%   ·   invitado %.0f%%'
              % (m['revivido'] * 100, m['invitado'] * 100))
        # ⚠️ el chequeo que el original no tiene
        for esc, d in t.items():
            prom = (d.get('tercero', 0) + d.get('cuarto', 0)) // 2
            if 'semifinal' in d and d['semifinal'] != prom:
                print('   ⚠️ %s: Semifinal=%d y el promedio da %d'
                      % (esc, d['semifinal'], prom))
        print('')
        return 0

    if '--auto' in sys.argv:
        sys.exit(1 if _self_check() else 0)

    if '--probar' not in sys.argv:
        print(__doc__)
        return 0

    print('\n══ UNA LLAVE DE 16, DE PUNTA A PUNTA ══\n')
    resolver, cuantos = _resolvedor()
    print('   el padrón resuelve %d nombre(s)\n' % cuantos)
    ev = procesar(_llave16(), num=9999, fecha='20/09', servidor='DRA',
                  resolver=resolver)
    print('   escala %s · %d participante(s) · %d con puntos · %d duelo(s)\n'
          % (ev['escala'], ev['participantes'], len(ev['resultados']),
             len(ev['duelos'])))
    print('   %-16s %-12s %8s  %s' % ('rapero', 'puesto', 'puntos', 'notas'))
    for r in ev['resultados']:
        print('   %-16s %-12s %8d  %s'
              % (r['rapero'][:16], r['posicion'], r['puntos'], r['notas']))
    for a in ev['avisos']:
        print('\n   ⚠️ %s' % a)
    print('\n   (no se escribió nada: esto arma el dict, `resultados.guardar()`'
          ' lo sube)\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
