# -*- coding: utf-8 -*-
"""LAS LLAVES, GUARDADAS PARA EL HUB: el botón «Ver llaves» de «Lo que pasó».

    python sheet/llaves_web.py          las que hay guardadas
    python sheet/llaves_web.py --auto   el self-check

Dlx, 25/09/2026: *«en lo que pasó quizás tener un registro de las llaves
en el website también? … un botón de ver llaves de evento y vemos ahí la
info y las llaves de forma detallada»*.

🔴 LA LLAVE NO QUEDABA GUARDADA EN NINGÚN LADO. `procesar_entrada` la lee
de `Entrada`, la reparte en `Resultados` y `1v1`, y `--limpiar` vacía la
hoja. Lo único que sobrevivía era la copia cruda del día
(`datos/entrada_*.json`), que no dice qué número le tocó a cada evento ni
dónde se publicó. Por eso se guarda acá, **después** de que la escritura
quedó, y con los nombres que ya resolvió el motor: los mismos de la tabla.

⚠️ SE FUSIONA POR NÚMERO, NO SE REESCRIBE. El ciclo relee las llaves que
Discord sigue mostrando. El día que una vieja se caiga de esa ventana, su
registro no puede irse con ella.

⚠️ EL ANUNCIO Y LA LLAVE NO COMPARTEN NINGUNA CLAVE. «Lo que pasó» sale
de los anuncios (`datos/anuncios.json`) y la llave es otro mensaje, en
otro canal, publicado horas después y a veces con otro nombre: el mismo
evento se anunció como «CARABOBO NUNCA SE RINDE VOL.1» y su llave dice
«CARABOBO NO SE RINDE VOL.1». `cruzar()` los junta por servidor, fecha y
nombre, y **los números del nombre tienen que coincidir**: «TOKYO VOL 11»
y «TOKYO VOL 12» se parecen un 95 %, y son dos eventos distintos.

⚠️ SI NO ESTÁ SEGURO, NO CUELGA NADA. Un botón que abre la llave de otro
evento es peor que no tener botón: *sin dato no hay pieza*.

🔑 Y A VECES EL NÚMERO ESTÁ MAL ESCRITO (Dlx, 29/09/2026, con captura): FFA
anunció «DESGRACIAS EN TOKYO VOL 17 1VS1» y la llave de ese evento dice
«VOL 16». *«A veces pasa esto que el anuncio y el título de la llave no
tienen sentido pero son del mismo… asegúrate de tener cuidado con ello»*.
Para eso está la segunda pasada de `cruzar()`, la de la llave huérfana:
ver `_huerfanas()`.

⚠️ VIAJA DENTRO DEL LOBBY Y NO EN UNA CLAVE PROPIA DE KV. Son las llaves
de «Lo que pasó» —seis como mucho, ~12 KB— y el lobby ya se escribe sólo
cuando cambia. Una clave aparte gastaría escrituras de una cuota de 1.000
por día que se agotó el 24/09/2026, y pediría otra ruta en el Worker.
"""
import datetime
import difflib
import io
import json
import os
import re
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)

ARCHIVO = os.path.join(BASE, 'datos', 'llaves_t1.json')
LINKS = os.path.join(BASE, 'datos', 'llaves_links.json')

#: de la primera ronda a la final. Lo que no está acá va antes, en el
#: orden en que llegó (una clasificatoria, una preliminar).
ORDEN = ['r64', 'r32', 'octavos', 'cuartos', 'semifinal', 'tercer puesto',
         'final']

#: cómo se lee cada ronda en la página, sea como sea que la escribió la llave
ETIQUETA = {
    'filtros': 'Filtros', 'dieciseisavos': 'Dieciseisavos',
    'r32': 'Dieciseisavos', 'octavos': 'Octavos', 'cuartos': 'Cuartos',
    'cuartos de final': 'Cuartos', 'semifinal': 'Semifinales',
    'semifinales': 'Semifinales', 'tercer puesto': 'Tercer puesto',
    'tercer lugar': 'Tercer puesto', 'final': 'Final', 'gran final': 'Final',
}

#: cuánto tiene que parecerse el nombre del anuncio al de la llave, cuando
#: no son iguales. CARABOBO NUNCA/NO da 0.889.
PARECIDO = 0.8

#: la llave se publica el mismo día del anuncio o hasta dos después
#: (un evento de las 11 PM termina pasada la medianoche)
DIAS = (-1, 2)
#: 🔴 …PERO NO UN DÍA ANTES DE QUE ARRANQUE (05/10/2026). `DIAS` cuenta días del calendario, y «COPA SOOLAR 3» (el
#: domingo a las 9 PM) se llevó la llave de «COPA SOOLAR», publicada el sábado: un número contra ninguno no choca. Con
#: el instante de los dos, una llave de más de estas horas ANTES del arranque es de otro evento
ANTES_MAX_H = 12
#: dos anuncios que arrancan con esta diferencia o menos son EL MISMO evento anunciado otra vez —«FAT BATTLES FECHA 4
#: (DOMINGO - MAÑANA)» y «(DOMINGO - HOY)», ACAD—: comparten la llave. Ver `cruzar()`
MISMO_EVENTO_H = 2

#: 🔑 LA LLAVE HUÉRFANA: el anuncio que la primera pasada dejó sin llave
#: porque los números chocan («VOL 17» contra «VOL 16», el mismo evento).
#: Se la lleva sólo si todo lo demás coincide —ver `_huerfanas()`—: la
#: llave puede salir hasta estos minutos ANTES del anuncio…
HUERFANA_ANTES_MIN = 15
#: …y hasta estas horas después, o hasta el siguiente anuncio de la serie
HUERFANA_HORAS = 24
#: cuánto tiene que parecerse la serie (el nombre sin números ni modalidad).
#: Más que `PARECIDO`: acá el número ya no ayuda a separar.
SERIE = 0.9


def limpio(nombre):
    """El nombre sin el subrayado de Discord: `__ TOKYO __` es `TOKYO`."""
    return str(nombre or '').strip().strip('_*~ ').strip()


def clave_nombre(s):
    """Para comparar: minúsculas, sin tildes y sólo letras y números."""
    s = unicodedata.normalize('NFKD', str(s or '').lower())
    return ''.join(c for c in s if c.isalnum() and not unicodedata.combining(c))


def _digitos(s):
    return ''.join(c for c in s if c.isdigit())


#: 🔑 «T2» ES LA TEMPORADA DEL ORGANIZADOR, NO LA EDICIÓN. Urban Freestyle
#: anunció «COMPE DEL VACILE T2 #1» y su llave dice «COMPE DEL VACILE 1»:
#: comparando todos los dígitos juntos era «21» contra «1», no se juntaban y
#: el calendario mostraba el evento dos veces (Dlx, 28/09/2026, con captura).
_TEMPORADA = re.compile(r'(?i)(?<![a-z0-9])(?:temporada|season|temp|t)\s*[.#:-]?\s*(\d+)')
#: 🔑 Y LA MODALIDAD TAMPOCO: FFA anunció «DESGRACIAS EN TOKYO VOL 14 1vs1»
#: y su llave dice «VOL.14»: era «1411» contra «14», y la VOL 13 «2VS2»
#: igual. Medido sobre los 97 anuncios de la T1 al arreglar la temporada.
_MODALIDAD = re.compile(r'(?i)(?<![a-z0-9])\d+\s*(?:vs|v|x)\s*\d+(?![a-z0-9])')


def _numeros(nombre):
    """`(temporada, edición)` de un nombre, en dígitos.

    «COMPE DEL VACILE T2 #1» -> ('2', '1') · «TOKYO VOL 11» -> ('', '11')
    · «SNAKE INSIGNIA 3/8» -> ('', '38').
    """
    # ⚠️ NFKD, COMO `clave_nombre()`: la llave de SEVEN STREET escribe «⁷⁷⁷»
    # en superíndice y el anuncio «777». Sin normalizar, eran dos números
    # ⚠️ con `_nfkd()` y no NFKD a secas: «1🆚1» es una modalidad y el 🆚 no se descompone solo, así que sus dígitos
    # se sumaban a la edición acá y no en la página (`numerosEv()` de llave_vivo.js). Revisión del 05/10/2026
    s = _MODALIDAD.sub(' ', _nfkd(nombre))
    return ''.join(m.group(1) for m in _TEMPORADA.finditer(s)), _digitos(_TEMPORADA.sub(' ', s))


def _chocan(x, y):
    """¿Los números de dos nombres se contradicen?

    La EDICIÓN distinta, sí: «VOL 11» y «VOL 12» son dos eventos. Un número
    contra ninguno, no: «SNAKE INSIGNIA» y su llave «SNAKE INSIGNIA 3/8». Y
    la TEMPORADA sólo choca si la dicen los dos: el anuncio dice «T2 #1» y la
    llave, «1».
    """
    tx, ex = _numeros(x)
    ty, ey = _numeros(y)
    return bool((ex and ey and ex != ey) or (tx and ty and tx != ty))


def _nfkd(s):
    # 🆚 no se descompone con NFKD: «1🆚️1» (URBF) es un 1vs1. Y trae el
    # selector de variante pegado (U+FE0F), que no es espacio para la regex
    s = unicodedata.normalize('NFKD', str(s or '')).replace('\U0001f19a', 'vs')
    return s.replace('️', '').replace('︎', '')


def _serie(nombre):
    """El nombre sin números ni modalidad: la serie del organizador.

    «DESGRACIAS EN TOKYO VOL 17 1VS1» y «DESGRACIAS EN TOKYO VOL 16» son
    la misma: `'desgraciasentokyovol'`.
    """
    s = _TEMPORADA.sub(' ', _MODALIDAD.sub(' ', _nfkd(nombre)))
    return clave_nombre(''.join(c for c in s if not c.isdigit()))


def _misma_serie(a, b):
    return bool(a and b and (a == b or difflib.SequenceMatcher(None, a, b).ratio() >= SERIE))


_FORMA = re.compile(r'(?i)(?<![a-z0-9])(\d+)\s*(?:vs|v)\s*(\d+)(?![a-z0-9])')


def forma_anuncio(mod):
    """`'solos'`, `'equipos'` o `''` (no se sabe), por la modalidad del anuncio.

    ⚠️ «4x4» NO es de equipos: en el rap son entradas de 4 compases (la
    modalidad de SNAKE INSIGNIA dice «4x4 3E Libre»). Por eso la `x` no
    cuenta acá, aunque `_MODALIDAD` la saque del número. Y el MULTIVERSE
    es de cualquier tamaño (2v2, 1v3, 8v1): no se sabe.

    ⚠️ Y «PANDILLAS» TAMPOCO SE SABE: ELRAP FECHA 6 se anunció así y su
    llave son batallas de 3 y 4 personas, cada una por su cuenta. Con
    «pandillas = equipos» perdía su llave (medido al escribir esto).
    """
    s = _nfkd(mod)
    t = s.lower()
    if 'multiverse' in t or 'pandilla' in t:
        return ''
    if re.search(r'dupla|equipo', t):
        return 'equipos'
    m = _FORMA.search(s)
    if not m:
        return ''
    a, b = int(m.group(1)), int(m.group(2))
    return 'solos' if a == b == 1 else ('equipos' if a == b else '')


def forma_llave(r):
    """`'solos'`, `'equipos'` o `''`, por los lados de la llave guardada: un
    lado de equipo trae los nombres con coma («27, Piyi»)."""
    lados = [str(l) for x in (r.get('rondas') or ()) for b in (x.get('b') or ())
             for l in ((b[0] if b else None) or ())]
    if not lados:
        return ''
    eq = sum(1 for l in lados if ',' in l)
    return 'equipos' if eq * 2 > len(lados) else ('solos' if not eq else '')


def forma_del_anuncio(p):
    """La forma de un anuncio entero: la de su modalidad, salvo que su NOMBRE
    diga otra — entonces no se sabe.

    🔴 FFA anunció «DESGRACIAS EN TOKYO VOL 24 2v2» con la modalidad «1v1»
    (05/10/2026): copió el anuncio de la VOL 23 y cambió sólo el título. Su
    llave era de equipos, y con la modalidad sola el «1v1» no se la llevaba:
    el evento se jugaba en vivo sin llave. Un anuncio que se contradice no
    dice nada. ⚠️ El nombre sólo ANULA la modalidad, nunca descarta solo: un
    anuncio sin modalidad sigue sin forma, como antes.
    """
    m = forma_anuncio(p.get('mod') or p.get('modalidad'))
    n = forma_anuncio(p.get('nombre'))
    return '' if (m and n and m != n) else m


def _formas_chocan(p, r):
    """¿Un 1vs1 contra una llave de equipos, o al revés?"""
    a = forma_del_anuncio(p)
    b = forma_llave(r)
    return bool(a and b and a != b)


def anuncio_de(nombre, sv, dia, anuncios):
    """El anuncio de ese servidor que respalda la llave `nombre` del día `dia`, o `None`.

    El mismo criterio que `cruzar()`, mirado desde la llave: mismo servidor,
    la llave entre un día antes y dos después del anuncio, y el nombre igual
    —o parecido y sin números que choquen—. `dia` es un `date`; `anuncios`,
    los de `datos/anuncios.json` (con `servidor`) o los del payload (con
    `sv`). Lo usan la regla de las llaves de broma de `bot/llaves_a_entrada.py`
    y la de las llaves sin título, que no toman un anuncio que ya tiene la suya.
    """
    b = clave_nombre(nombre)
    if not b or not dia:
        return None
    for p in anuncios or ():
        if (p.get('servidor') or p.get('sv') or '') != sv:
            continue
        pd = _dia_este(p.get('cuando'))
        if not pd or not DIAS[0] <= (dia - pd).days <= DIAS[1]:
            continue
        a = clave_nombre(p.get('nombre'))
        if a and (a == b or (not _chocan(p.get('nombre'), nombre)
                             and difflib.SequenceMatcher(None, a, b).ratio() >= PARECIDO)):
            return p
    return None


def anunciado(nombre, sv, dia, anuncios):
    """¿Algún anuncio de ese servidor respalda la llave `nombre` del día `dia`? Ver `anuncio_de()`."""
    return anuncio_de(nombre, sv, dia, anuncios) is not None


def fecha_iso(fecha):
    """`'24/09'` -> `'2026-09-24'`. La llave no trae año: sale del
    arranque de la temporada, como en `rankings._orden_fecha()`."""
    try:
        dia, mes = [int(x) for x in str(fecha).strip().split('/')[:2]]
        from comun.temporada import INICIO
        anio0, mes0 = int(INICIO[:4]), int(INICIO[5:7])
        return datetime.date(anio0 + (1 if mes < mes0 else 0), mes, dia).isoformat()
    except (ValueError, ImportError):
        return ''


def _et():
    try:
        import zoneinfo
        return zoneinfo.ZoneInfo('America/New_York')
    except Exception:                                    # noqa: BLE001
        return datetime.timezone(datetime.timedelta(hours=-4))


def _instante_iso(cuando):
    try:
        t = datetime.datetime.fromisoformat(str(cuando).replace('Z', '+00:00'))
    except ValueError:
        return None
    if t.tzinfo is None:
        t = t.replace(tzinfo=datetime.timezone.utc)
    return t


def _dia_este(cuando):
    """La fecha, en hora del este, de un instante ISO en UTC."""
    t = _instante_iso(cuando)
    return t.astimezone(_et()).date() if t else None


def instante(link):
    """Cuándo se publicó el mensaje de ese link, en ms.

    🔑 EL ID DEL MENSAJE YA LO TRAE: un ID de Discord lleva en sus 42 bits
    de arriba los milisegundos desde el 1/1/2015. No hace falta pedirle
    nada a Discord ni guardar otra columna.
    """
    try:
        i = int(str(link).rstrip('/').rsplit('/', 1)[-1])
    except (ValueError, TypeError):
        return None
    return (i >> 22) + 1420070400000 if i > 0 else None


def _primero(links):
    ms = [x for x in (instante(l) for l in (links or ())) if x]
    return min(ms) if ms else None


def instantes(regs=None):
    """`{número de evento: ms}`: cuándo se publicó la llave de cada uno."""
    out = {}
    for n, r in (leer() if regs is None else regs).items():
        ms = _primero(r.get('links'))
        if ms is not None and str(n).isdigit():
            out[int(n)] = ms
    return out


def ms_de_fecha(fecha):
    """`'23/09'` -> el mediodía de ese día en hora del este, en ms."""
    iso = fecha_iso(fecha)
    if not iso:
        return None
    d = datetime.date.fromisoformat(iso)
    return int(datetime.datetime(d.year, d.month, d.day, 12,
                                 tzinfo=_et()).timestamp() * 1000)


def orden(ms, fecha, desempate):
    """La clave para poner eventos en el orden en que se jugaron.

    🔴 NI EL `Evento #` NI LA FECHA ALCANZAN. Los eventos de una corrida
    se numeraban en orden ALFABÉTICO, y FFA juega tres o cuatro por día:
    el 23/09 la racha leía TöKĪØ (6:56 PM ET) antes que TOKYO VOL.12 (5:36
    PM ET). Manda el instante en que se publicó la llave; sin link —una
    llave cargada a mano—, el mediodía de su fecha; y el `desempate` al
    final (auditoría del 25/09/2026).
    """
    if ms is None:
        ms = ms_de_fecha(fecha)
    return (ms if ms is not None else float('inf'), desempate)


def duelos(regs=None):
    """Los 1v1 de las llaves, del más viejo al más nuevo: `[(num, a, b, ganador)]`.

    🔑 UN SOLO LUGAR, con la regla de `equipos.es_duelo()` —la misma de la
    hoja `1v1`, de donde salen los duelos de las cartas—: dos lados de una
    persona, con ganador, sin triples, ni el tercero del podio, ni pokémon.
    Lo usan el perfil de la página, las insignias y los Clásicos; contar
    distinto en cada uno fue el bug de Colesito (2/3 en su carta, 3/4 en su
    perfil, 27/09/2026).
    """
    import equipos as _EQ
    regs = leer() if regs is None else regs
    inst = instantes(regs)
    nums = sorted((n for n in regs if str(n).isdigit()),
                  key=lambda n: orden(inst.get(int(n)), regs[n].get('fecha'), int(n)))
    out = []
    for n in nums:
        for R in regs[n].get('rondas') or []:
            for b in R.get('b') or []:
                lados = b[0] if b else []
                g = b[1] if len(b) > 1 else ''
                if len(lados) == 2 and _EQ.es_duelo(lados[0], lados[1], g, b[2] if len(b) > 2 else ''):
                    out.append((int(n), lados[0], lados[1], g))
    return out


def _bandas(nota):
    """`'triple (4 bandas, pasan 2)'` -> `(4, 2)`; sin bandas, `(0, 0)`."""
    s = str(nota or '').lower()
    if 'banda' not in s:
        return 0, 0
    nums, act = [], ''
    for c in s + ' ':
        if c.isdigit():
            act += c
        elif act:
            nums.append(int(act))
            act = ''
    n = nums[0] if nums else 0
    m = nums[1] if len(nums) > 1 and 'pasan' in s else 1
    return n, m


def _juntar(bs):
    """Las filas de una batalla de 3 o 4 bandas, otra vez en una.

    Van juntas las filas seguidas con el mismo que pasó y la misma nota de
    bandas, hasta completar las bandas que la nota dice. ⚠️ SE COMPARA LA
    PARTE DE LAS BANDAS, no la nota entera: en TOKYO VOL.12 (#355) una fila
    dice «…; Revivido: SNOW» y su compañera no, y quedaban como dos
    batallas. Sirve también para las llaves ya guardadas: no cambia una
    batalla que ya está completa.
    """
    out = []
    for lados, g, nota in bs:
        n, m = _bandas(nota)
        base = str(nota or '').split(';')[0].strip()
        ult = out[-1] if out else None
        if (n > 2 and ult and ult[0] and lados and ult[0][0] == lados[0]
                and ult[1] == g and str(ult[2]).split(';')[0].strip() == base
                and len(ult[0]) < n - m + 1):
            for x in lados[1:]:
                if x not in ult[0]:
                    ult[0].append(x)
            continue
        out.append([list(lados), g, nota])
    # ⚠️ EL LADO VACÍO ES «NO PASÓ NADIE» (un grupo del filtro, ver
    # `llaves_a_entrada.filas_de`): junta el grupo, pero no se dibuja.
    for b in out:
        b[0] = [x for x in b[0] if x]
    return out


#: las batallas que esperan en ✅ Decidir, de `datos/batallas_sin_ganador.json`
SIN_GANADOR = os.path.join(BASE, 'datos', 'batallas_sin_ganador.json')
#: cómo se dibuja una batalla que espera en ✅ Decidir
NOTA_DECIDIR = 'sin ganador: espera en ✅ Decidir'


def _sin_ganador(archivo=SIN_GANADOR):
    """`[(evento, sv, fecha, ronda, [lados])]` de las batallas que esperan en ✅ Decidir. `[]` si no se puede leer."""
    try:
        with io.open(archivo, encoding='utf-8') as f:
            ds = (json.load(f) or {}).get('batallas') or []
    except (OSError, ValueError):
        return []
    out = []
    for d in ds:
        p = str(d).rsplit(' · ', 4)
        if len(p) == 5:
            out.append((p[0], p[1], p[2], p[3], [x.strip() for x in p[4].split('🆚') if x.strip()]))
    return out


def armar(ev, links=(), pendientes=None):
    """El registro de un evento ya procesado por el motor.

    Cada batalla es `[lados, ganador, nota]`.

    ⚠️ UNA BATALLA DE TRES O CUATRO BANDAS VUELVE A SER UNA. `Entrada`
    tiene dos lados, así que el lector la parte en una fila por cada uno
    que cae —con `triple (N bandas)` en la nota— y la llave la mostraba
    como tres duelos que nunca existieron. Se juntan las filas seguidas
    de esa ronda con el mismo que pasó y la misma nota, hasta completar
    las bandas que la nota dice.

    ⚠️ CUANDO PASAN DOS, AL SEGUNDO NO LO TRAE NINGUNA FILA: el lector
    anota sólo a quienes caen, contra uno de los que pasó (ver
    `llaves_a_entrada`). La línea sale con un lado menos y la nota dice
    cuántas bandas eran y cuántas pasaron: incompleta, pero no inventa.
    """
    import motor
    rondas, donde, orden = [], {}, {}
    fase = []                     # la fase de una nave de funa: [nombre, cayó]
    for i, d in enumerate(ev.get('duelos') or ()):
        crudo = str(d.get('ronda') or '').strip()
        canon = motor.ronda_de(crudo)
        # 🔑 LA FASE DE UNA NAVE DE FUNA NO SON BATALLAS: es una lista, con ❌ en
        # los que cayeron (Dlx, 29/09/2026). Dibujada como cuadro serían trece
        # «batallas» contra nadie. Ver `llaves_a_entrada.filas_funa()`.
        if canon == motor.FUNA_R:
            if d.get('b'):
                nota = str(d.get('notas') or '')
                fase.append([d['b'], 'en pie' not in nota])
                # y en qué ronda cayó, si la llave lo dijo (`llaves_a_entrada.filas_funa()`): la página lo muestra
                # ronda por ronda (Dlx, 03/10/2026: «¿podrías dar más detalles?»)
                m = re.search(r'en la ronda (\d+)', nota)
                if m:
                    fase[-1].append(int(m.group(1)))
            continue
        etq = ETIQUETA.get(motor.norm(crudo)) or crudo.capitalize() or '—'
        if etq not in donde:
            donde[etq] = len(rondas)
            rondas.append({'r': etq, 'b': []})
            orden[etq] = (ORDEN.index(canon) if canon in ORDEN else -1, i)
        a, b = d.get('a') or '', d.get('b') or ''
        g, nota = d.get('ganador') or '', str(d.get('notas') or '').strip()
        rondas[donde[etq]]['b'].append([[a, b], g, nota])
    for R in rondas:
        R['b'] = _juntar(R['b'])
    # 🔑 Y LAS BATALLAS QUE ESPERAN EN ✅ DECIDIR, CON SU GENTE (02/10/2026). Una batalla sin ganador no da filas, así
    # que la llave guardada no la traía y el cuadro dibujaba ese lugar «por jugarse» en un evento ya terminado: en la
    # DOS GENERACIONES VOL 2, Korey, Eyou y Tayo —que estaban en la llave— no aparecían. Va con su nota, sin ganador.
    for nom, sv, fec, crudo, lados in (pendientes if pendientes is not None else _sin_ganador()):
        if (clave_nombre(nom) != clave_nombre(ev.get('nombre')) or sv != (ev.get('servidor') or '')
                or fec != (ev.get('fecha') or '') or len(lados) < 2):
            continue
        canon = motor.ronda_de(crudo)
        etq = ETIQUETA.get(motor.norm(crudo)) or crudo.capitalize() or '—'
        if etq not in donde:
            donde[etq] = len(rondas)
            rondas.append({'r': etq, 'b': []})
            orden[etq] = (ORDEN.index(canon) if canon in ORDEN else -1, len(orden) + 10000)
        ya = {frozenset(b[0]) for b in rondas[donde[etq]]['b']}
        if frozenset(lados) not in ya:
            rondas[donde[etq]]['b'].append([list(lados), '', NOTA_DECIDIR])
    rondas.sort(key=lambda r: orden[r['r']])
    res = sorted(ev.get('resultados') or (),
                 key=lambda r: (-int(r.get('puntos') or 0), str(r.get('rapero'))))
    # 🔑 LOS EQUIPOS SIN INTEGRANTES (TEAM VENECIA): la página los dibuja como
    # equipo y no como una persona sin perfil. Ver `llaves_a_entrada.marcar_equipos()`.
    sin = sorted({x.strip() for R in rondas for b in R['b']
                  for x in re.findall(r'sin integrantes\s*:\s*([^;|]+)', str(b[2] or ''), re.I)
                  if x.strip()})
    # la fase entera: primero los que pasaron (están en alguna batalla de
    # después), y los que cayeron
    if fase:
        pasaron = []
        for R in rondas:
            for b in R['b']:
                for x in b[0]:
                    for m in [p.strip() for p in str(x).split(',') if p.strip()]:
                        if m not in pasaron:
                            pasaron.append(m)
        fase = [[m, False] for m in pasaron] + fase
    return {
        'n': int(ev['num']),
        'nombre': limpio(ev.get('nombre')),
        'sv': ev.get('servidor') or '',
        'fecha': ev.get('fecha') or '',
        'dia': fecha_iso(ev.get('fecha')),
        'escala': ev.get('escala') or '',
        'participantes': int(ev.get('participantes') or 0),
        'rondas': rondas,
        'tabla': [[r.get('rapero') or '', r.get('posicion') or '',
                   int(r.get('puntos') or 0)] for r in res],
        'links': list(links or ()),
        **({'sin': sin} if sin else {}),
        **({'funa': fase} if fase else {}),
    }


def leer(archivo=ARCHIVO):
    try:
        with io.open(archivo, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def guardar(planes, archivo=ARCHIVO, links_archivo=LINKS):
    """Fusiona los eventos de esta corrida en `datos/llaves_t1.json`.

    Devuelve cuántos registros cambiaron. Si nada cambió no toca el
    archivo, así el ciclo no commitea lo mismo cada media hora.
    """
    links = leer(links_archivo)
    d = leer(archivo)
    antes = json.dumps(d, ensure_ascii=False, sort_keys=True)
    cambiaron = 0
    for ev in planes:
        k = '|'.join(str(ev.get(c) or '').strip()
                     for c in ('nombre', 'servidor', 'fecha'))
        viejo = d.get(str(ev['num'])) or {}
        # ⚠️ SI ESTA CORRIDA NO TRAJO LINKS SE CONSERVAN LOS DE ANTES: el
        # archivo de links lo deja el lector con `--aplicar`, y un
        # reproceso a mano sin él no puede borrarle el link a nadie.
        nuevo = armar(ev, links.get(k) or viejo.get('links') or ())
        if nuevo != viejo:
            cambiaron += 1
        d[str(ev['num'])] = nuevo
    if json.dumps(d, ensure_ascii=False, sort_keys=True) != antes:
        with io.open(archivo, 'w', encoding='utf-8', newline='') as f:
            json.dump(d, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write(chr(10))
    return cambiaron


def _miembros(lado):
    """`'Hassan, PichulaMc'` -> `{'hassan', 'pichulamc'}`."""
    out = set()
    for x in str(lado or '').replace('+', ',').split(','):
        k = clave_nombre(x)
        if k:
            out.add(k)
    return out


def enlazar(rondas):
    """Las rondas con un cuarto dato en cada batalla: de qué batallas de la
    ronda anterior vienen sus lados (índices). Es lo que dibuja el árbol.

    🔑 Dlx, 25/09/2026, con la imagen de una llave clásica: *«pensé que ibas
    a crear algo así y rellenar los nombres en esos huecos»*. Para dibujar
    las ramas hay que saber qué batalla alimenta a cuál, y la llave no lo
    dice: lo dicen los nombres.

    1. POR NOMBRE: el que ganó en la ronda anterior aparece en un lado de
       ésta. Con equipos alcanza uno —«NC, MCNadie» ganó como «MCNadie, NC»—.
       Por nombre y no por orden: en CARABOBO (#354) la primera semi viene
       de los cuartos 3 y 1.
    2. LO QUE QUEDA SUELTO VA AL HUECO DE AL LADO. En una batalla de 3 bandas
       donde pasan 2, al segundo que pasa no lo anota nadie (ver
       `llaves_a_entrada`): en ELRAP FECHA 6 (#353), Presagio llega a cuartos
       sin haber «ganado» nada. La llave lista las batallas en su orden, así
       que su batalla es la vecina de la que ya engancha.

    ⚠️ Una batalla no alimenta a más batallas que los que pasan de ella, y
    una no recibe más ramas que lados. Lo que no engancha queda sin rama —un
    walk-in, un revivido— y se dibuja igual, en su columna. El tercer puesto
    no es parte del árbol.

    🔴 Y EL PASO 2 SUPONE QUE LA LLAVE VA EN ORDEN, y no siempre va. Dlx,
    01/10/2026: *«a veces se hacen batallas de otras llaves antes que la
    anterior»*. Dos Generaciones Vol 2 (FFA) armó sus cuartos con los
    ganadores a medida que llegaban —el del grupo 2 contra el del 6— y «al
    hueco de al lado» colgaba cada cruce de grupos que no eran los suyos. Se
    usa sólo si lo que ya enganchó por nombre está en orden (`_en_orden()`).
    Y del grupo donde pasan dos engancha cualquiera de los dos por nombre.
    """
    out = [{'r': R['r'], 'b': [b + [[]] for b in _juntar([x[:3] for x in R['b']])]}
           for R in rondas]
    arbol = [R for R in out if R['r'] != 'Tercer puesto']
    for k in range(1, len(arbol)):
        prev, cur = arbol[k - 1]['b'], arbol[k]['b']
        usos = [0] * len(prev)
        for b in cur:
            m = set()
            for lado in b[0]:
                m |= _miembros(lado)
            for i, a in enumerate(prev):
                if len(b[3]) >= len(b[0]) or usos[i] >= _pasan(a):
                    continue
                # el que ganó; y si pasan varios, cualquiera de los lados
                pasaron = (_miembros(a[1]) if _pasan(a) < 2
                           else set().union(*[_miembros(x) for x in a[0]]))
                if pasaron & m:
                    b[3].append(i)
                    usos[i] += 1
        if _en_orden(cur):
            for i in range(len(prev)):
                if usos[i]:
                    continue
                for b in cur:
                    if len(b[3]) < len(b[0]) and any(abs(j - i) == 1 for j in b[3]):
                        b[3].append(i)
                        usos[i] = 1
                        break
        for b in cur:
            b[3].sort()
    return out


def _pasan(a):
    """Cuántos pasan de la batalla `a`: el `pasan 2` de su nota; si no lo dice, uno."""
    m = re.search(r'pasan (\d+)', str(a[2] or ''))
    return int(m.group(1)) if m else 1


def _en_orden(cur):
    """¿Lo que ya enganchó por nombre va en el orden de la llave? Cada batalla,
    de batallas posteriores a las de la anterior. Ver `enlazar()`."""
    ult = -1
    for b in cur:
        if not b[3]:
            continue
        if min(b[3]) <= ult:
            return False
        ult = max(b[3])
    return True


def _elegir(p, regs):
    """La primera pasada: la llave de un anuncio por su nombre, o `None`.

    Mismo servidor, la llave entre un día antes y dos después del anuncio,
    y el nombre igual —o parecido y con los mismos números—. Con un empate
    no se elige.
    """
    e = _elegir_con(p, regs)
    return e[0] if e else None


def _elegir_con(p, regs):
    """`(n, puntaje, cerca)` de `_elegir()`, o `None`: con qué la eligió, para que `cruzar()` sepa a qué anuncio le
    queda una llave que eligieron dos."""
    dia = _dia_este(p.get('cuando'))
    _ini = _instante_iso(p.get('cuando'))
    ini = int(_ini.timestamp() * 1000) if _ini else None
    a = clave_nombre(p.get('nombre'))
    if not dia or not a:
        return None
    cands = []
    for n, r in (regs or {}).items():
        if (r.get('sv') or '') != (p.get('sv') or ''):
            continue
        try:
            rd = datetime.date.fromisoformat(r.get('dia') or '')
        except ValueError:
            continue
        dd = (rd - dia).days
        if not DIAS[0] <= dd <= DIAS[1]:
            continue
        b = clave_nombre(r.get('nombre'))
        if not b:
            continue
        # 🔑 UN 1VS1 NO SE LLEVA UNA LLAVE DE EQUIPOS, NI AL REVÉS. La noche
        # del 28/09 FFA jugó la TOKYO VOL 16 dos veces —el 2VS2 y el 1VS1—
        # y las dos llaves dicen «VOL 16»: el nombre solo no las separa.
        if _formas_chocan(p, r):
            continue
        if a == b:
            puntaje = 2.0
        # ⚠️ DOS NÚMEROS DISTINTOS SE DESCARTAN; UN NÚMERO CONTRA NINGUNO,
        # NO. Snake Rap anuncia «SNAKE INSIGNIA» y su llave dice «SNAKE
        # INSIGNIA 3/8» (la edición): nada se contradice, y sin esto su
        # anuncio no llevaba nunca el botón. VOL 11 contra VOL 12 sigue
        # afuera —si fue un error de tipeo, lo levanta `_huerfanas()`—. Y la
        # temporada del organizador aparte: ver `_chocan()`.
        elif _chocan(p.get('nombre'), r.get('nombre')):
            continue
        else:
            puntaje = difflib.SequenceMatcher(None, a, b).ratio()
        if puntaje >= PARECIDO:
            # ⚠️ LO MÁS CERCA EN EL TIEMPO, EN MINUTOS Y NO EN DÍAS: dos
            # llaves con el mismo nombre el mismo día empataban siempre y
            # el anuncio se quedaba sin botón. Con el instante de la
            # llave, gana la que se publicó más cerca del arranque.
            ms = _primero(r.get('links'))
            # 🔴 y no publicada un día antes de que arranque: ver `ANTES_MAX_H`
            if ms is not None and ini and ms < ini - ANTES_MAX_H * 3600000:
                continue
            cerca = (-(abs(ms - ini) // 60000) if ms is not None and ini
                     else -abs(dd) * 1440)
            cands.append((puntaje, cerca, str(n)))
    if not cands:
        return None
    cands.sort(reverse=True)
    if len(cands) > 1 and cands[0][:2] == cands[1][:2]:
        return None
    return cands[0][2], cands[0][0], cands[0][1]


def _pub_ms(p):
    """Cuándo se publicó el anuncio —no cuándo arranca el evento—, en ms.

    ⚠️ «Lo que pasó» y el calendario guardan en `cuando` el ARRANQUE, y la
    llave de TOKYO VOL 17 salió 19 minutos antes del arranque («EN 30
    MINUTOS»). Por eso sale del ID del mensaje del anuncio cuando viene el
    link, igual que `instante()` con la llave.
    """
    ms = instante(p.get('link')) if p.get('link') else None
    if ms:
        return ms
    t = _instante_iso(p.get('pub') or p.get('cuando'))
    return int(t.timestamp() * 1000) if t else None


def _huerfanas(faltan, ctx, regs, tomadas):
    """La segunda pasada: `[(anuncio, n)]` para los que quedaron sin llave
    porque el número del nombre no coincide.

    🔑 Dlx, 29/09/2026: el anuncio decía «TOKYO VOL 17 1VS1» y la llave
    «VOL 16». No se relaja el número —«VOL 11» y «VOL 12» SÍ son dos
    eventos—: se pide TODO lo demás, y cada cosa descarta por sí sola:

    - el mismo servidor y la misma **serie** (el nombre sin números ni
      modalidad, `_serie()`);
    - una llave que **ningún otro anuncio se llevó** en la primera pasada
      (`tomadas`, calculada sobre TODOS los anuncios y no sólo los que se
      muestran);
    - publicada **después del anuncio** —con `HUERFANA_ANTES_MIN` de gracia—
      y **antes del siguiente anuncio de esa serie** en ese servidor, o de
      `HUERFANA_HORAS`;
    - la misma **forma**: un 1vs1 no se lleva una llave de equipos.

    Con dos candidatas no elige: *sin dato no hay pieza*.
    """
    out = []
    for p in faltan:
        sv, serie, pub = p.get('sv') or '', _serie(p.get('nombre')), _pub_ms(p)
        if not serie or pub is None:
            continue
        hasta = pub + HUERFANA_HORAS * 3600000
        for q in ctx:
            qp = _pub_ms(q)
            if (q is not p and (q.get('sv') or '') == sv and qp is not None
                    and pub < qp < hasta and _misma_serie(_serie(q.get('nombre')), serie)):
                hasta = qp
        cands = []
        for n, r in (regs or {}).items():
            if str(n) in tomadas or (r.get('sv') or '') != sv:
                continue
            ms = _primero(r.get('links'))
            if ms is None or not pub - HUERFANA_ANTES_MIN * 60000 <= ms < hasta:
                continue
            if not _misma_serie(_serie(r.get('nombre')), serie) or _formas_chocan(p, r):
                continue
            cands.append(str(n))
        if len(cands) == 1:
            out.append((p, cands[0]))
            tomadas.add(cands[0])
    return out


def _mismo_evento(a, b):
    """¿`a` y `b` anuncian el mismo evento? El mismo servidor y el arranque a `MISMO_EVENTO_H` o menos."""
    if (a.get('sv') or '') != (b.get('sv') or ''):
        return False
    ta, tb = _instante_iso(a.get('cuando')), _instante_iso(b.get('cuando'))
    return bool(ta and tb and abs((ta - tb).total_seconds()) <= MISMO_EVENTO_H * 3600)


def _id_mensaje(link):
    """El id del mensaje al final de un link de Discord, o `''`."""
    m = re.search(r'/(\d{15,22})/?$', str(link or ''))
    return m.group(1) if m else ''


def anuncio_de_llave():
    """`{id del mensaje de la llave: id del mensaje de su anuncio}` de `datos/nombres_llaves.json` (campo `anuncio`)."""
    try:
        with io.open(os.path.join(BASE, 'datos', 'nombres_llaves.json'), encoding='utf-8') as f:
            d = (json.load(f) or {}).get('llaves') or {}
    except (OSError, ValueError):
        return {}
    return {str(k): str(v['anuncio']) for k, v in d.items() if isinstance(v, dict) and v.get('anuncio')}


def cruzar(pasados, regs, todos=None, de_anuncio=None):
    """Cuelga `llave: n` de cada anuncio de «Lo que pasó» que tenga su
    llave, y devuelve `{n: registro}` con las que colgó.

    Tres pasadas: la llave que su anuncio nombró (`de_anuncio`, abajo), por
    nombre (`_elegir()`) y, para el que quedó sin llave, la huérfana
    (`_huerfanas()`). `todos` son los demás anuncios —con la misma forma que
    `pasados`—, para saber qué llaves ya son de otro: «Lo que pasó» muestra
    seis, y la llave de un séptimo no es huérfana.
    """
    out = {}
    regs = regs or {}
    # 🔑 LA LLAVE QUE SU ANUNCIO NOMBRÓ ES DE ÉSE (07/10/2026). Cuando una llave no trae nombre, el lector la nombra con
    # su anuncio y guarda el id de ese anuncio en `datos/nombres_llaves.json`. Si el nombre después cambia —«PRITTY FREE
    # CLASIFICATORIA 3», para no juntarla con la de la mañana—, por nombre ya no se cruza y el calendario la mostraba
    # dos veces. Con el id no hay parecido que medir: va primero, y esa llave no la elige nadie más.
    # ⚠️ Y NO SE RESUELVE CAMBIÁNDOLE EL NOMBRE: el evento se identifica por nombre, servidor y fecha, y el 07/10 a las
    # 12:52 AM «PRITTY FREE 3» entró como OTRO evento (#417) con el #412 cargado: el mismo evento dos veces
    de_anuncio = anuncio_de_llave() if de_anuncio is None else de_anuncio
    fija = {}
    for n, r in regs.items():
        am = de_anuncio.get(_id_mensaje((r.get('links') or [''])[0]))
        if am:
            fija[am] = n
    fijas = set(fija.values())
    libres = {n: r for n, r in regs.items() if n not in fijas} if fijas else regs
    ya = {p.get('link') for p in pasados if p.get('link')}
    otros = [q for q in (todos or ()) if not (q.get('link') and q.get('link') in ya)]
    # 🔴 UNA LLAVE ES DE UN SOLO EVENTO (05/10/2026). Cada anuncio elegía la suya por separado, y «COPA SOOLAR» y
    # «COPA SOOLAR 3» se llevaron las dos la #394: el calendario dio por jugada la 3 mientras se jugaba, y el Inicio la
    # sacó de «en vivo». Ahora la llave queda para el anuncio que más se le parece y, a igual parecido, el más cerca en
    # el tiempo —y para los que arrancan a la misma hora que ése (`MISMO_EVENTO_H`): el mismo evento anunciado otra
    # vez—. Dos eventos distintos empatados exacto: ninguno, como `_elegir()`. Los demás siguen a la huérfana sin ella.
    mios = {id(p) for p in pasados}
    por_llave = {}
    for p in list(pasados) + otros:
        if id(p) in mios:
            p.pop('llave', None)
        n_fijo = fija.get(_id_mensaje(p.get('link')))
        if n_fijo is not None:
            if id(p) in mios:
                p['llave'] = int(n_fijo)
                out[n_fijo] = regs[n_fijo]
            continue
        e = _elegir_con(p, libres)
        if e is not None:
            por_llave.setdefault(e[0], []).append(((e[1], e[2]), p))
    for n, cs in por_llave.items():
        cs.sort(key=lambda x: x[0], reverse=True)
        gana = cs[0][1]
        if any(k == cs[0][0] and not _mismo_evento(q, gana) for k, q in cs[1:]):
            continue
        for _k, q in cs:
            if id(q) in mios and (q is gana or _mismo_evento(q, gana)):
                q['llave'] = int(n)
                out[n] = regs[n]
    faltan = [p for p in pasados if not p.get('llave')]
    if not faltan:
        return out
    # las de un empate también quedan tomadas: no son huérfanas de un tercero. Y las que su anuncio nombró, también
    tomadas = set(por_llave) | fijas
    for p, n in _huerfanas(faltan, list(pasados) + otros, regs, tomadas):
        p['llave'] = int(n)
        out[n] = regs[n]
    return out


def _self_check():
    import tempfile
    print('')
    print('  llaves_web.py — self-check')
    print('')
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('ok' if cond else '🔴', que))

    ev = {'num': 360, 'nombre': '__ PRUEBA VOL.2 __', 'servidor': 'FFA',
          'fecha': '24/09', 'escala': '8-15', 'participantes': 9,
          'duelos': [
              {'ronda': 'FINAL', 'a': 'Ana', 'b': 'Bea', 'ganador': 'Ana', 'notas': ''},
              {'ronda': 'octavos', 'a': 'Ana', 'b': 'Ceci', 'ganador': 'Ana', 'notas': ''},
              {'ronda': 'SEMIFINALES', 'a': 'Ana', 'b': 'Dani', 'ganador': 'Ana', 'notas': ''},
              {'ronda': 'filtros', 'a': 'Eva', 'b': 'Fede', 'ganador': 'Eva',
               'notas': 'triple (3 bandas)'},
              {'ronda': 'filtros', 'a': 'Eva', 'b': 'Gus', 'ganador': 'Eva',
               'notas': 'triple (3 bandas)'},
              {'ronda': 'filtros', 'a': 'Eva', 'b': 'Kim', 'ganador': 'Eva',
               'notas': 'triple (3 bandas)'},
              # un grupo del filtro del que no pasó nadie (SNAKE INSIGNIA)
              {'ronda': 'filtros', 'a': '', 'b': 'Lu', 'ganador': '',
               'notas': 'triple (3 bandas, pasan 0)'},
              {'ronda': 'filtros', 'a': '', 'b': 'Mia', 'ganador': '',
               'notas': 'triple (3 bandas, pasan 0)'},
              {'ronda': 'filtros', 'a': '', 'b': 'Noa', 'ganador': '',
               'notas': 'triple (3 bandas, pasan 0)'},
              {'ronda': 'octavos', 'a': 'Hugo', 'b': 'Ivan', 'ganador': 'Hugo',
               'notas': 'triple (4 bandas, pasan 2)'},
              {'ronda': 'octavos', 'a': 'Hugo', 'b': 'Juan', 'ganador': 'Hugo',
               'notas': 'triple (4 bandas, pasan 2)'},
              {'ronda': 'semifinales', 'a': 'Bea', 'b': 'Eva', 'ganador': 'Bea', 'notas': ''},
          ],
          'resultados': [
              {'rapero': 'Bea', 'puntos': 7000, 'posicion': 'Subcampeón'},
              {'rapero': 'Ana', 'puntos': 10000, 'posicion': 'Campeón'},
          ]}
    r = armar(ev, ['https://discord.com/channels/1/2/3'])
    ok([x['r'] for x in r['rondas']] == ['Filtros', 'Octavos', 'Semifinales', 'Final'],
       'las rondas, de la primera a la final  %s' % [x['r'] for x in r['rondas']])
    ok(len(r['rondas'][2]['b']) == 2,
       'las dos semis juntas aunque una diga SEMIFINALES y otra semifinales')
    ok(r['rondas'][0]['b'][0][2] == 'triple (3 bandas)', 'la nota de la batalla viaja')
    ok(r['rondas'][0]['b'][0][0] == ['Eva', 'Fede', 'Gus'] and len(r['rondas'][0]['b']) == 3,
       'la de 3 bandas vuelve a ser una batalla  %s' % r['rondas'][0]['b'])
    ok(r['rondas'][0]['b'][2][:2] == [['Lu', 'Mia', 'Noa'], ''],
       'el grupo del filtro sin nadie que pase: los tres, sin lado vacío  %s'
       % r['rondas'][0]['b'][2][:2])
    ok(r['rondas'][1]['b'][1][0] == ['Hugo', 'Ivan', 'Juan'],
       'la de 4 donde pasan 2: el que pasó y los dos que cayeron  %s'
       % r['rondas'][1]['b'][1][0])
    ok(_bandas('triple (4 bandas, pasan 2)') == (4, 2) and _bandas('') == (0, 0),
       'lee las bandas de la nota')
    ok(r['nombre'] == 'PRUEBA VOL.2', 'el nombre sin el subrayado de Discord')
    ok(r['tabla'][0][:2] == ['Ana', 'Campeón'], 'la tabla, de más puntos a menos')
    ok(r['dia'] == '2026-09-24', 'la fecha con año  (%s)' % r['dia'])
    # 🔑 la batalla que espera en ✅ Decidir se dibuja con su gente (DOS GENERACIONES VOL 2: Korey, Eyou y Tayo)
    pend = [('__ PRUEBA VOL.2 __', 'FFA', '24/09', 'octavos', ['Korey🇨🇱', 'Eyou', 'Tayo🇵🇪']),
            ('OTRO EVENTO', 'FFA', '24/09', 'octavos', ['Zeta', 'Yago']),
            ('__ PRUEBA VOL.2 __', 'URBF', '24/09', 'octavos', ['Wanda', 'Ximena'])]
    rp = armar(ev, [], pendientes=pend)
    octs = [x for x in rp['rondas'] if x['r'] == 'Octavos'][0]['b']
    ok([b for b in octs if b[0] == ['Korey🇨🇱', 'Eyou', 'Tayo🇵🇪'] and b[1] == '' and b[2] == NOTA_DECIDIR],
       'la batalla que espera en ✅ Decidir va en su ronda, con sus tres y sin ganador')
    ok(not [b for b in octs if b[0][0] in ('Zeta', 'Wanda')],
       'la de otro evento, o del mismo nombre en otro servidor, no')
    ok(len(armar(ev, [], pendientes=pend + pend[:1])['rondas'][1]['b']) == len(octs),
       'y la misma pregunta dos veces se dibuja una')

    tmp = tempfile.mkdtemp()
    arch = os.path.join(tmp, 'llaves.json')
    lks = os.path.join(tmp, 'links.json')
    with io.open(arch, 'w', encoding='utf-8') as f:
        json.dump({'100': {'n': 100, 'nombre': 'VIEJA', 'links': ['x']}}, f)
    with io.open(lks, 'w', encoding='utf-8') as f:
        json.dump({'__ PRUEBA VOL.2 __|FFA|24/09': ['https://discord.com/channels/1/2/9']}, f)
    ok(guardar([ev], arch, lks) == 1, 'guarda el evento nuevo')
    g = leer(arch)
    ok('100' in g, 'y no se lleva puesta la vieja: se fusiona por número')
    ok(g['360']['links'] == ['https://discord.com/channels/1/2/9'],
       'el link sale del archivo del lector, por nombre|servidor|fecha')
    t0 = os.path.getmtime(arch)
    os.remove(lks)
    ok(guardar([ev], arch, lks) == 0 and os.path.getmtime(arch) == t0,
       'sin cambios no reescribe, y sin archivo de links conserva el que había')
    ok(leer(arch)['360']['links'] == ['https://discord.com/channels/1/2/9'],
       'el link sigue ahí')

    regs = {
        '351': {'n': 351, 'nombre': 'DESGRACIAS EN TOKYO VOL 11', 'sv': 'FFA', 'dia': '2026-09-23'},
        '355': {'n': 355, 'nombre': 'DESGRACIAS EN TOKYO VOL.12', 'sv': 'FFA', 'dia': '2026-09-23'},
        '354': {'n': 354, 'nombre': 'CARABOBO NO SE RINDE VOL.1', 'sv': 'FFA', 'dia': '2026-09-24'},
        '353': {'n': 353, 'nombre': 'ELRAP FECHA 6', 'sv': 'FFA', 'dia': '2026-09-24'},
        '352': {'n': 352, 'nombre': 'DESGRACIAS CON TöKĪØ V.1', 'sv': 'FFA', 'dia': '2026-09-23'},
    }
    pas = [
        {'nombre': 'ELRAP FECHA 6', 'sv': 'FFA', 'cuando': '2026-09-24T04:11:39'},
        {'nombre': 'CARABOBO NUNCA SE RINDE VOL.1', 'sv': 'FFA', 'cuando': '2026-09-24T02:20:21'},
        {'nombre': 'DESGRACIAS CON TöKĪØ V.1', 'sv': 'FFA', 'cuando': '2026-09-23T22:44:12'},
        {'nombre': 'DESGRACIAS EN TOKYO VOL 12', 'sv': 'FFA', 'cuando': '2026-09-23T21:28:50'},
        {'nombre': 'DESGRACIAS EN TOKYO VOL 11', 'sv': 'FFA', 'cuando': '2026-09-23T19:29:54'},
        {'nombre': 'el que diga 7 parrafos', 'sv': 'FFA', 'cuando': '2026-09-23T03:13:45'},
        {'nombre': 'ELRAP FECHA 6', 'sv': 'SR', 'cuando': '2026-09-24T04:11:39'},
        {'nombre': 'DESGRACIAS EN TOKYO VOL 12', 'sv': 'FFA', 'cuando': '2026-09-28T21:28:50'},
    ]
    col = cruzar(pas, regs)
    ok([p.get('llave') for p in pas] == [353, 354, 352, 355, 351, None, None, None],
       'los anuncios del 23 y 24/09, cada uno con su llave  %s'
       % [p.get('llave') for p in pas])
    ok(sorted(col) == ['351', '352', '353', '354', '355'], 'y devuelve esas cinco')
    ok(pas[1]['llave'] == 354, 'CARABOBO NUNCA ↔ CARABOBO NO: parecido y mismos números')
    ok(pas[4]['llave'] == 351, 'TOKYO VOL 11 no se lleva la VOL 12 (se parecen un 95 %)')
    ok(pas[6].get('llave') is None, 'otro servidor no engancha')
    ok(pas[7].get('llave') is None, 'cinco días después no engancha')
    dos = {'1': {'nombre': 'FLEIVA FREE', 'sv': 'SR', 'dia': '2026-09-24'},
           '2': {'nombre': 'FLEIVA FREE', 'sv': 'SR', 'dia': '2026-09-24'}}
    q = [{'nombre': 'FLEIVA FREE', 'sv': 'SR', 'cuando': '2026-09-24T20:00:00'}]
    cruzar(q, dos)
    ok(q[0].get('llave') is None, 'con un empate no elige')
    sr = {'360': {'nombre': 'SNAKE INSIGNIA 3/8', 'sv': 'SR', 'dia': '2026-09-26'}}
    q = [{'nombre': 'SNAKE INSIGNIA', 'sv': 'SR', 'cuando': '2026-09-26T13:05:46'}]
    cruzar(q, sr)
    ok(q[0].get('llave') == 360,
       'el anuncio sin número engancha con la llave que dice la edición (3/8)')
    # 🔑 la temporada del organizador (Dlx, 28/09/2026, con captura del calendario)
    ub = {'368': {'nombre': 'COMPE DEL VACILE 1', 'sv': 'URBF', 'dia': '2026-09-28'},
          '380': {'nombre': 'COMPE DEL VACILE 2', 'sv': 'URBF', 'dia': '2026-09-28'}}
    # ⚠️ cada anuncio por su lado: juntos compiten por la misma llave (una llave es de UN anuncio, ver `cruzar()`)
    q = [{'nombre': 'COMPE DEL VACILE T2 #1', 'sv': 'URBF', 'cuando': '2026-09-28T18:21:45'}]
    q3 = [{'nombre': 'COMPE DEL VACILE T3 #1', 'sv': 'URBF', 'cuando': '2026-09-28T18:21:45'}]
    cruzar(q, ub)
    cruzar(q3, ub)
    ok(q[0].get('llave') == 368, '«T2 #1» engancha con la llave «1»: el 2 es la temporada, no la edición')
    ok(q3[0].get('llave') == 368 and not cruzar([{'nombre': 'COMPE T2 #1', 'sv': 'URBF',
                                                 'cuando': '2026-09-28T18:21:45'}],
                                               {'9': {'nombre': 'COMPE T3 1', 'sv': 'URBF', 'dia': '2026-09-28'}}),
       'y la temporada sólo choca si la dicen los dos (T2 contra T3, no)')
    ok([_numeros(x) for x in ('COMPE DEL VACILE T2 #1', 'DESGRACIAS EN TOKYO VOL 11', 'SNAKE INSIGNIA 3/8',
                              'TEMPORADA 3 FECHA 7', 'TOKYO', '⁷⁷⁷ SEVEN STREET ⁷⁷⁷',
                              'DESGRACIAS EN TOKYO VOL 14 1vs1', 'VOL 13 2VS2', 'MULTI 8v1')]
       == [('2', '1'), ('', '11'), ('', '38'), ('3', '7'), ('', ''), ('', '777777'), ('', '14'), ('', '13'),
           ('', '')],
       'temporada y edición: la T de TOKYO no es una temporada, «⁷⁷⁷» es 777 y la modalidad (1vs1) no cuenta')

    # 🔑 la llave huérfana (Dlx, 29/09/2026, con captura): el 1VS1 se anunció
    # «VOL 17» y su llave dice «VOL 16», la misma noche que el 2VS2 VOL 16
    def lk(iso):
        t = _instante_iso(iso)
        return 'https://discord.com/channels/1/2/%d' % ((int(t.timestamp() * 1000) - 1420070400000) << 22)

    eq = lambda *xs: {'r': 'Cuartos', 'b': [[list(x), x[0], ''] for x in xs]}  # noqa: E731

    # 🔴 UNA LLAVE ES DE UN SOLO ANUNCIO, y no la de un día antes (05/10/2026): «COPA SOOLAR 3» (el domingo 9:11 PM ET)
    # se llevaba la #394 de «COPA SOOLAR» (el sábado) —un número contra ninguno no choca— y el Inicio la daba por jugada
    cs = {'394': {'nombre': 'COPA SOOLAR', 'sv': 'FFA', 'dia': '2026-10-04', 'links': [lk('2026-10-04T19:45:00')]}}
    c1 = {'nombre': 'COPA SOOLAR', 'sv': 'FFA', 'cuando': '2026-10-04T19:39:40', 'link': lk('2026-10-04T19:09:40')}
    c3 = {'nombre': 'COPA SOOLAR 3', 'sv': 'FFA', 'cuando': '2026-10-06T01:11:14', 'link': lk('2026-10-06T00:41:14')}
    q = [dict(c1), dict(c3)]
    cruzar(q, cs)
    ok([x.get('llave') for x in q] == [394, None],
       'la llave es del que se llama igual; la 3 no se lleva la de la 1  %s' % [x.get('llave') for x in q])
    q = [dict(c3)]
    cruzar(q, cs, todos=[dict(c1)])
    ok(q[0].get('llave') is None, 'tampoco cuando la 1 no está a la vista (en «Lo que pasó»)')
    q = [dict(c3)]
    cruzar(q, cs)
    ok(q[0].get('llave') is None, 'y aunque la 1 no exista: una llave de 29 h antes del arranque es de otro evento')
    fb = {'392': {'nombre': 'FAT BATTLES FECHA 4 (DOMINGO - HOY)', 'sv': 'ACAD', 'dia': '2026-09-27',
                  'links': [lk('2026-09-27T22:10:00')]}}
    q = [{'nombre': 'FAT BATTLES FECHA 4 (DOMINGO - MAÑANA)', 'sv': 'ACAD', 'cuando': '2026-09-27T22:00:00'},
         {'nombre': 'FAT BATTLES FECHA 4 (DOMINGO - HOY)', 'sv': 'ACAD', 'cuando': '2026-09-27T22:00:00'}]
    cruzar(q, fb)
    ok([x.get('llave') for x in q] == [392, 392], 'el mismo evento anunciado dos veces: los dos anuncios la llevan')
    dia = {'7': {'nombre': 'FLEIVA FREE', 'sv': 'SR', 'dia': '2026-09-25', 'links': [lk('2026-09-26T00:05:00')]}}
    q = [{'nombre': 'FLEIVA FREE', 'sv': 'SR', 'cuando': '2026-09-24T23:55:00'},
         {'nombre': 'FLEIVA FREE', 'sv': 'SR', 'cuando': '2026-09-25T23:55:00'}]
    cruzar(q, dia)
    ok([x.get('llave') for x in q] == [None, 7], 'el mismo nombre otro día: la llave es del más cercano, no de los dos')
    tk = {'370': {'nombre': 'DESGRACIAS EN TOKYO VOL 16 2VS2', 'sv': 'FFA', 'dia': '2026-09-28',
                  'links': [lk('2026-09-29T01:53:58')],
                  'rondas': [eq(('27, Piyi', 'Soulb, Char'), ('Paria, Oasis', 'Vandu, Makmah'))]},
          '371': {'nombre': 'DESGRACIAS EN TOKYO VOL 16', 'sv': 'FFA', 'dia': '2026-09-28',
                  'links': [lk('2026-09-29T03:41:12')],
                  'rondas': [eq(('NC', 'Makmah'), ('yinn', 'tormen'))]}}
    a16 = {'nombre': 'DESGRACIAS EN TOKYO VOL 16 2VS2', 'sv': 'FFA', 'cuando': '2026-09-29T01:29:43',
           'pub': '2026-09-29T00:59:43', 'mod': '2VS2', 'link': 'a16'}
    a17 = {'nombre': 'DESGRACIAS EN TOKYO VOL 17 1VS1', 'sv': 'FFA', 'cuando': '2026-09-29T04:00:44',
           'pub': '2026-09-29T03:30:44', 'mod': '1VS1', 'link': 'a17'}
    q = [dict(a17), dict(a16)]
    cruzar(q, tk)
    ok([x.get('llave') for x in q] == [371, 370],
       'TOKYO: el anuncio «VOL 17 1VS1» se lleva la llave «VOL 16» del 1vs1, y el 2VS2 la suya  %s'
       % [x.get('llave') for x in q])
    q = [dict(a17)]
    cruzar(q, tk, todos=[dict(a16), dict(a17)])
    ok(q[0].get('llave') == 371, 'y en «Lo que pasó» con sólo el VOL 17 a la vista, igual')
    q = [dict(a17, mod='2VS2', nombre='DESGRACIAS EN TOKYO VOL 17 2VS2')]
    cruzar(q, {'371': tk['371']})
    ok(q[0].get('llave') is None, 'un anuncio de equipos no se lleva la llave huérfana de un 1vs1')
    q = [dict(a17)]
    cruzar(q, {'371': dict(tk['371'], links=[lk('2026-09-29T03:00:00')])})
    ok(q[0].get('llave') is None, 'ni una llave publicada media hora antes del anuncio')
    dos = {'371': tk['371'], '372': dict(tk['371'], links=[lk('2026-09-29T05:00:00')])}
    q = [dict(a17)]
    cruzar(q, dos)
    ok(q[0].get('llave') is None, 'con dos huérfanas posibles no elige')
    # 🔑 la llave que su anuncio nombró (FFA, 05/10/2026): el anuncio dice «PRITTY FREE», la llave se llama «PRITTY FREE
    # CLASIFICATORIA 3» y `datos/nombres_llaves.json` guarda de qué anuncio es. La «PRITTY FREE» de la mañana, la suya
    pf = {'402': {'nombre': 'PRITTY FREE', 'sv': 'FFA', 'dia': '2026-10-05',
                  'links': ['https://discord.com/channels/1/2/1556536286074900573']},
          '412': {'nombre': 'PRITTY FREE CLASIFICATORIA 3', 'sv': 'FFA', 'dia': '2026-10-05',
                  'links': ['https://discord.com/channels/1/2/1556862363834253344']}}
    q = [{'nombre': 'PRITTY FREE', 'sv': 'FFA', 'cuando': '2026-10-05T05:17:40',
          'link': 'https://discord.com/channels/1/3/1556532055393697843'},
         {'nombre': 'PRITTY FREE', 'sv': 'FFA', 'cuando': '2026-10-06T02:56:51',
          'link': 'https://discord.com/channels/1/3/1556859003634589760'}]
    cruzar(q, pf, de_anuncio={'1556862363834253344': '1556859003634589760'})
    ok([x.get('llave') for x in q] == [402, 412],
       'la llave que su anuncio nombró es de ése, aunque el nombre ya no se parezca  %s' % [x.get('llave') for x in q])
    q = [dict(x) for x in q]
    cruzar(q, pf, de_anuncio={})
    ok(q[1].get('llave') is None, 'sin ese dato, por nombre no se cruzan (por eso hace falta)')
    # el anuncio siguiente de la serie cierra la ventana: la llave con el
    # número mal escrito es del que se anunció justo antes de publicarla
    a20 = {'nombre': 'TOKYO VOL 20', 'sv': 'FFA', 'cuando': '2026-10-01T00:00:00', 'mod': '1v1'}
    a21 = {'nombre': 'TOKYO VOL 21', 'sv': 'FFA', 'cuando': '2026-10-01T02:00:00', 'mod': '1v1'}
    l22 = {'9': {'nombre': 'TOKYO VOL 22', 'sv': 'FFA', 'dia': '2026-09-30',
                 'links': [lk('2026-10-01T02:10:00')], 'rondas': [eq(('A', 'B'))]}}
    q = [dict(a20), dict(a21)]
    cruzar(q, l22)
    ok([x.get('llave') for x in q] == [None, 9],
       'la del «VOL 22» mal escrito es del VOL 21, que se anunció antes de publicarla  %s'
       % [x.get('llave') for x in q])
    q = [dict(a20)]
    cruzar(q, {'9': dict(l22['9'], nombre='CARABOBO VOL 22')})
    ok(q[0].get('llave') is None, 'y de otra serie, nunca')
    ok([forma_anuncio(m) for m in ('1VS1', '1🆚️1', '1V1 ROYAL RUMBLE_', '2V2', '3v3', 'DUPLAS', 'Pandillas',
                                    'MULTIVERSE (1-4)', '1️⃣6️⃣ | OCTAVOS: 4x4 3E Libre', '')]
       == ['solos', 'solos', 'solos', 'equipos', 'equipos', 'equipos', '', '', '', ''],
       'la forma del anuncio: «4x4» no es de equipos, Pandillas y MULTIVERSE no se saben')
    # 🔴 el anuncio que se contradice (FFA, VOL 24, 05/10/2026): «2v2» en el nombre y «1v1» en la modalidad
    lleq = {'rondas': [{'r': 'Octavos', 'b': [[['A, B', 'C, D'], '', ''], [['E, F', 'G, H'], '', '']]}]}
    ok(not _formas_chocan({'nombre': 'DESGRACIAS EN TOKYO VOL 24 2v2', 'mod': '1v1'}, lleq)
       and _formas_chocan({'nombre': 'DESGRACIAS EN TOKYO VOL 16', 'mod': '1VS1'}, lleq)
       and _formas_chocan({'nombre': 'DESGRACIAS EN TOKYO VOL 16 1VS1', 'mod': '1VS1'}, lleq)
       and forma_del_anuncio({'nombre': 'COPA 2v2', 'mod': ''}) == '',
       'un anuncio que se contradice no tiene forma; el nombre sólo anula, nunca descarta solo')

    # 🌳 el árbol: por nombre aunque venga fuera de orden (#354), lo suelto
    # al hueco de al lado (el segundo que pasa de 3 bandas, #353), las filas
    # de una batalla juntas aunque una diga «Revivido» (#355), y el tercer
    # puesto afuera
    rs = [{'r': 'Cuartos', 'b': [
        [['A', 'B'], 'A', ''], [['C, K', 'D'], 'C, K', ''],
        [['E', 'F'], 'E', 'triple (4 bandas, pasan 2); Revivido: E'],
        [['E', 'G'], 'E', 'triple (4 bandas, pasan 2)'], [['H', 'I'], 'H', '']]},
        {'r': 'Semifinales', 'b': [[['K, C', 'A'], 'A', ''], [['X', 'H'], 'X', '']]},
        {'r': 'Tercer puesto', 'b': [[['K, C', 'H'], 'H', '']]},
        {'r': 'Final', 'b': [[['A', 'X'], 'A', '']]}]
    ar = enlazar(rs)
    ok([b[0] for b in ar[0]['b']][2] == ['E', 'F', 'G'] and len(ar[0]['b']) == 4,
       'la batalla de 4 bandas vuelve a ser una aunque una fila diga «Revivido»')
    ok([b[3] for b in ar[1]['b']] == [[0, 1], [2, 3]],
       'semis: por nombre fuera de orden, y el que pasó sin anotar al hueco de al lado  %s'
       % [b[3] for b in ar[1]['b']])
    ok(ar[3]['b'][0][3] == [0, 1] and ar[2]['b'][0][3] == [],
       'la final viene de las dos semis; el tercer puesto no es parte del árbol')
    ok(len(rs[0]['b']) == 5, 'y no toca las rondas que le pasan')
    # 🔴 fuera de orden (Dos Generaciones Vol 2, 01/10/2026): nada al hueco de al
    # lado, y del grupo donde pasan dos enganchan los dos por nombre
    fo = enlazar([{'r': 'Octavos', 'b': [
        [['A1', 'A2'], 'A1', ''], [['B1', 'B2', 'B3'], 'B2', 'triple (3 bandas, pasan 2)'],
        [['C1', 'C2'], 'C1', ''], [['D1', 'D2'], 'D1', ''], [['E1', 'E2'], '', ''], [['F1', 'F2'], 'F1', '']]},
        {'r': 'Cuartos', 'b': [[['A1', 'Z'], '', ''], [['B2', 'F1'], '', ''], [['C1', 'B3'], '', '']]}])
    ok([b[3] for b in fo[1]['b']] == [[0], [1, 5], [1, 2]],
       'fuera de orden: nada al hueco de al lado, y el grupo donde pasan dos alimenta a los dos  %s'
       % [b[3] for b in fo[1]['b']])

    # 🔑 `anunciado()`: el mismo criterio que `cruzar()`, desde la llave
    an = [{'nombre': 'COMPE DEL VACILE T2 #1', 'servidor': 'URBF', 'cuando': '2026-09-28T18:21:45'},
          {'nombre': 'SNAKE INSIGNIA', 'sv': 'SR', 'cuando': '2026-09-26T20:00:00'}]
    d28, d26 = datetime.date(2026, 9, 28), datetime.date(2026, 9, 26)
    ok(anunciado('COMPE DEL VACILE 1', 'URBF', d28, an) and anunciado('SNAKE INSIGNIA 3/8', 'SR', d26, an),
       'la llave con su anuncio: la temporada del organizador y la edición no la separan')
    ok(not anunciado('DENME MODERADOR LPM', 'URBF', d28, an)
       and not anunciado('COMPE DEL VACILE 1', 'FFA', d28, an)
       and not anunciado('COMPE DEL VACILE 1', 'URBF', datetime.date(2026, 10, 3), an)
       and not anunciado('COMPE DEL VACILE 2', 'URBF', d28, an),
       'y sin él: otro nombre, otro servidor, otra semana u otra edición')

    print('')
    print('   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return _self_check()
    d = leer()
    print('')
    print('   %d llave(s) guardada(s) en datos/llaves_t1.json' % len(d))
    for n in sorted(d, key=int):
        r = d[n]
        print('   #%-4s %-34s %-4s %-6s %2d ronda(s) · %d link(s)'
              % (n, r.get('nombre', '')[:34], r.get('sv', ''), r.get('fecha', ''),
                 len(r.get('rondas') or ()), len(r.get('links') or ())))
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
