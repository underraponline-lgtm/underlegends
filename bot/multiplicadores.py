# -*- coding: utf-8 -*-
"""LA SEMANA DE LA LIGA: multiplicadores, evento dorado, guerra de servidores y bonos.

    python bot/multiplicadores.py            la de esta semana, sin escribir nada
    python bot/multiplicadores.py --aplicar  sortea si hace falta y escribe
                                             datos/multiplicadores.json (paso 0b)
    python bot/multiplicadores.py --auto     el self-check, sin red ni archivos

Dlx, 27/09/2026: *«cada semana haya un multiplicador de puntos que tú vas a
decidir randomamente… FFA va a dar x1 de puntos pero los eventos de Snake
Rap darán 2x esta semana y los eventos de URBF darán x5… luego podríamos dar
debuffs también»*. Y a las tres preguntas: *«me gusta hasta x5»*, el debuff
*«sí, a cualquiera»*, y *«desde ya»*. Después, de las ideas para enganchar:
*«me gustan todas»* — el evento dorado, la guerra de servidores, «Volvé», el
Pasaporte y la Asistencia salen de acá.

LAS REGLAS (todas acá arriba: Dlx va a rebalancear al final)
------------------------------------------------------------
LOS MULTIPLICADORES. Cada lunes a las 11 AM ET se sortea uno por servidor de
la Liga —los que el bot lee, `datos/bot_en.json`—: uno **fuerte** (×2 o ×3,
y ×5 más o menos una semana de cada cuatro), quizás un **×0,5** a cualquiera,
y el resto ×1, ×1,5 o ×2.

EL EVENTO DORADO. Con el sorteo sale un servidor y un día de martes a
sábado: el primer evento de ese servidor desde ese día vale **×3** encima de
su multiplicador. Se sabe desde el lunes, así los organizadores lo pueden
aprovechar.

LA GUERRA DE SERVIDORES. Con el sorteo se arman los pares. Gana el que más
puntos hace **por persona** en sus eventos de la semana —puntos crudos, sin
multiplicar: si no, ganaría siempre el del ×5—, y la semana siguiente lleva
**×1,5** sobre su multiplicador.

EL ORGANIZADOR DE LA SEMANA Y LA COPA. Cada evento de 8 o más con su llave
le suma a su organizador —el «Organiza: X» del anuncio— tanta gente como
juntó. El primero de la semana es la sede de la siguiente: **su próximo
evento es la Copa de la Liga y vale ×2**. Uno solo en toda la Liga, y va a
la persona, no a su servidor (Dlx: *«a la persona»*). Quien no pone
«Organiza:» en el anuncio no suma: eso ya empuja a anunciar bien.

EL SEMILLERO. Gana el servidor que más gente nueva trae —gente que juega
**por primera vez en su vida** en la Liga (Dlx: *«A»*), no «nueva en la
temporada»: si no, con el reset de la T1 todos serían nuevos—, en
proporción a su gente y con 3 como mínimo. Lleva **×1,5** la semana
siguiente. «Trajo» a alguien el servidor de su primer evento. Quién ya
jugó lo guarda `datos/vistos.json`, que no se borra con la temporada.

LOS CLÁSICOS. Un duelo es Clásico si esos dos ya se cruzaron 2 veces
antes: es su tercer cruce, o más. El que lo gana suma **+10 %** en ese
evento. Los duelos se guardan en `datos/rivales.json`, que no se borra con
la temporada: las rivalidades se acumulan.

LA META DE COMUNIDAD. Cada lunes, cada servidor recibe una meta de gente
distinta en sus eventos: un 10 % más que su promedio de las últimas semanas
(con 8 como mínimo). Si la cumple, **todos los que jugaron ahí esa semana
suman +10 %** en esos eventos. En el Inicio, con su barra.

LOS PREMIOS DE LA SEMANA. Al cerrar cada semana: la figura (más puntos de
Temporada), la revelación (la figura de los que debutaron esa semana), el
cazador (el que más cobró en el Most Wanted) y el servidor (el que más gente
movió).

EL ×2 VOTADO. Durante la semana, en la página, cualquiera que entre con
Discord vota qué servidor se lleva el ×2 la siguiente, y nadie vota al suyo
(Dlx: *«1. A. 2. A»*). El más votado sale del sorteo con **×2 como
mínimo**: si le tocó menos, sube a ×2; si le tocó más, se queda con lo
suyo. La guerra y el Semillero van encima. Ver `bot/encuestas.py`.

LOS BONOS DE CADA UNO.
- **«Volvé»**: tu segundo evento de la temporada, si cae dentro de los 7
  días del primero, vale ×1,5. Es para el 42 % que juega una sola vez.
- **Pasaporte**: jugar en 3 servidores distintos en una semana, +1.500.
- **Asistencia**: jugar 3 días distintos en una semana, +1.000, ganes o no.

⚠️ EL TECHO: sumando todo, una fila no pasa de ×5 (Dlx: *«hasta x5»*).

🔴 NUNCA TOCA EL COMPETITIVO: todo se aplica al sumar los Puntos de la
Temporada (`rankings.agregar_temporada()`), y el Score lee `Resultados` sin
nada. Tampoco toca el Most Wanted: su recompensa es la suya.

⚠️ LO SORTEADO SE GUARDA Y NO SE VUELVE A SORTEAR. Cada evento usa lo de la
semana en que se jugó, para siempre: si mañana cambian las reglas, lo de
antes no se mueve. Y NADA SE APLICA PARA ATRÁS: cada regla corre desde
`DESDE`. El primer multiplicador arrancó en su sorteo (domingo 27/09).

⚠️ EL ARRANQUE DE LA TEMPORADA CORTA LA SEMANA, como en el Most Wanted: la
de la prueba termina a las 00:00 ET del arranque y la primera de la
temporada va de ahí al lunes de la semana siguiente (ver `periodo()`).
"""
import datetime as dt
import hashlib
import io
import json
import os
import random
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

SALIDA = os.path.join(BASE, 'datos', 'multiplicadores.json')
#: quién jugó alguna vez en la Liga, y cuándo y dónde por primera vez
VISTOS = os.path.join(BASE, 'datos', 'vistos.json')
#: todos los duelos de la Liga, de todas las temporadas: de ahí salen los Clásicos
RIVALES = os.path.join(BASE, 'datos', 'rivales.json')

# ── los números, todos acá ───────────────────────────────────────────────
#: la semana arranca el lunes a esta hora del este (como el Most Wanted)
ARRANCA_H = 11
#: el fuerte de la semana: (valor, peso). ×5 una semana de cada cuatro
FUERTE = ((2, 45), (3, 30), (5, 25))
#: la chance de que alguno salga ×0,5, y cuánto vale
DEBUFF, DEBUFF_X = 0.6, 0.5
#: los demás
RESTO = ((1, 50), (1.5, 35), (2, 15))
#: si el bot no dice en qué servidores está, estos
SERVIDORES = ('DRA', 'FFA', 'SR', 'URBF', 'FFS', 'DDF', 'ACAD')
#: una semana que empieza a menos de esto después del arranque se junta con la anterior
JUNTAR = dt.timedelta(days=3)
#: el evento dorado, encima del multiplicador de su servidor
DORADO_X = 3
#: lo que lleva el que gana la guerra, sobre su multiplicador de la semana siguiente
GUERRA_X = 1.5
#: «Volvé»: el segundo evento, si cae a menos de estos días del primero
VOLVE_DIAS, VOLVE_X = 7, 1.5
#: (cuántos hacen falta, cuántos puntos da): servidores distintos y días distintos
PASAPORTE = (3, 1500)
ASISTENCIA = (3, 1000)
#: la Copa de la Liga: el próximo evento del organizador de la semana
COPA_X = 2
#: un evento cuenta para el organizador si juntó al menos esta gente
MIN_ORG = 8
#: lo que el «Organiza:» de un anuncio a veces dice y no es nadie
NO_ES_ORG = {'yo', 'nosotros', 'staff', 'admin', 'admins', 'mods'}
#: el Semillero: cuántos nuevos como mínimo, y lo que lleva la semana siguiente
SEMILLERO_MIN, SEMILLERO_X = 3, 1.5
#: la meta de comunidad: cuánto más que su promedio, el mínimo, cuántas
#: semanas mira y lo que suma cada uno de los que jugaron si se cumple
META_X, META_MIN, META_SEMANAS, META_BONO = 1.1, 8, 4, 1.1
#: el destacado del calendario: anunciado con al menos estas horas de anticipación.
#: Dlx, 27/09/2026: *«de 12 h a 24 h a más»*. Medido: 2 de 48 anuncios llegan
DESTACADO_H = 12
#: el Clásico: en cuántos EVENTOS distintos se tienen que haber cruzado antes,
#: y lo que suma el que gana. ⚠️ EVENTOS, NO DUELOS: en un 5 vidas los mismos
#: dos pelean hasta cinco veces en una noche (la Snake Arena Vol. 2, 28/09).
CLASICO_PREVIOS, CLASICO_X = 2, 1.1
#: el techo de una fila, sumando todo
TECHO = 5
#: el ×2 votado: lo mínimo que lleva el servidor más votado (ver `bot/encuestas.py`)
VOTADO_X = 2
#: desde cuándo corre cada regla. «Volvé», desde que salió; lo semanal
#: (dorado, guerra, pasaporte, asistencia), desde la primera semana entera
DESDE = {'volve': '2026-09-27T17:00:00Z', 'semana': '2026-09-28T15:00:00Z'}

ET = None


def _et():
    global ET
    if ET is None:
        try:
            import zoneinfo
            ET = zoneinfo.ZoneInfo('America/New_York')
        except Exception:                                # noqa: BLE001
            ET = dt.timezone(dt.timedelta(hours=-4))
    return ET


def _iso(t):
    return t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _de_iso(s):
    return dt.datetime.fromisoformat(str(s).replace('Z', '+00:00'))


def _desde(regla):
    return _de_iso(DESDE[regla])


def _arranque():
    """El arranque de la temporada (00:00 ET de su primer día), o `None`."""
    from comun.temporada import arranque
    a = arranque()
    return dt.datetime.fromisoformat(a) if a else None


def _lunes(t):
    """El lunes a las `ARRANCA_H` ET más reciente que no pasa de `t`."""
    e = t.astimezone(_et())
    ini = e.replace(hour=ARRANCA_H, minute=0, second=0, microsecond=0)
    if e < ini:
        ini -= dt.timedelta(days=1)
    return (ini - dt.timedelta(days=ini.weekday())).astimezone(dt.timezone.utc)


def periodo(ahora=None, a=None):
    """`(id, inicio, fin)` de la semana que contiene a `ahora`, en UTC.

    De lunes a lunes a las 11 AM ET. ⚠️ EL ARRANQUE DE LA TEMPORADA ES UN
    CORTE: la semana que lo cruza termina ahí, y la siguiente empieza ahí.
    Si esa siguiente quedara de horas (el arranque es un lunes a las 00:00 y
    la semana empieza a las 11), se junta con la otra: una «semana» de once
    horas en plena madrugada no sirve para nada.
    """
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    a = _arranque() if a is None else a
    ini = _lunes(ahora)
    fin = ini + dt.timedelta(days=7)
    if a and ini <= a < fin:
        if ahora < a:
            fin = a
        else:
            ini = a
    if a and a <= ini < a + JUNTAR:
        ini = a
    if a and a <= fin < a + JUNTAR and ini == a:
        fin += dt.timedelta(days=7)
    return ini.astimezone(_et()).strftime('%Y-%m-%d'), ini, fin


def servidores():
    """Los servidores que entran al sorteo: donde está el bot."""
    try:
        with io.open(os.path.join(BASE, 'datos', 'bot_en.json'), encoding='utf-8') as f:
            svs = [s for s in json.load(f) or [] if isinstance(s, str) and s]
        return sorted(set(svs)) or list(SERVIDORES)
    except (OSError, ValueError):
        return list(SERVIDORES)


def _rnd(que, semilla):
    return random.Random(hashlib.sha256((que + semilla).encode()).hexdigest())


def _pesado(rnd, opciones):
    tot = sum(p for _v, p in opciones)
    x = rnd.uniform(0, tot)
    for v, p in opciones:
        x -= p
        if x <= 0:
            return v
    return opciones[-1][0]


def sortear(svs, semilla):
    """`{servidor: multiplicador}`: uno fuerte, quizás un ×0,5, y el resto.

    Con la misma semilla sale lo mismo (el id de la semana): se puede volver
    a mirar. Pero lo que vale es lo GUARDADO, no lo que sale de acá.
    """
    rnd = _rnd('mult', semilla)
    svs = sorted(svs)
    rnd.shuffle(svs)
    out = {}
    if not svs:
        return out
    out[svs[0]] = _pesado(rnd, FUERTE)
    resto = svs[1:]
    if resto and rnd.random() < DEBUFF:
        out[resto[0]] = DEBUFF_X
        resto = resto[1:]
    for sv in resto:
        out[sv] = _pesado(rnd, RESTO)
    return out


def sortear_dorado(svs, ini, fin, semilla):
    """`{'sv', 'desde'}`: el servidor y desde qué día (00:00 ET), o `None`.

    El día va de martes a sábado y antes del último día de la semana: se sabe
    desde el lunes, así hay tiempo de anunciarlo y de organizar.
    """
    rnd = _rnd('dorado', semilla)
    dias = []
    d = (ini.astimezone(_et()) + dt.timedelta(days=1)).date()
    tope = (fin - dt.timedelta(days=1)).astimezone(_et())
    while True:
        ts = dt.datetime(d.year, d.month, d.day, tzinfo=_et())
        if ts >= tope:
            break
        if 1 <= ts.weekday() <= 5:
            dias.append(ts)
        d += dt.timedelta(days=1)
    if not svs or not dias:
        return None
    return {'sv': rnd.choice(sorted(svs)), 'desde': _iso(rnd.choice(dias))}


def emparejar(svs, semilla):
    """Los pares de la guerra: `[[a, b], …]`. Con un número impar, uno descansa."""
    s = sorted(svs)
    _rnd('guerra', semilla).shuffle(s)
    return [s[i:i + 2] for i in range(0, len(s) - 1, 2)]


def _num(x):
    try:
        return float(str(x).replace(',', '') or 0)
    except ValueError:
        return 0.0


def _gente(n):
    import unicodedata
    n = unicodedata.normalize('NFKD', str(n or ''))
    return ''.join(c for c in n if c.isalnum()).lower()


def resultado_guerra(semana, eventos):
    """`{'ppp': {servidor: puntos por persona}, 'gana': [servidor, …]}`.

    Puntos CRUDOS de la tabla de cada llave —sin multiplicar—, sobre la gente
    distinta que jugó los eventos de ese servidor esa semana. Un empate, o
    los dos en cero, no tiene ganador.
    """
    ini, fin = _de_iso(semana['inicio']), _de_iso(semana['fin'])
    pares = (semana.get('guerra') or {}).get('pares') or []
    pts, gente = {}, {}
    for e in eventos:
        n, sv, t, tabla = e[0], e[1], e[2], e[3]
        if not t or not (ini <= t < fin):
            continue
        for fila in tabla or []:
            if len(fila) < 3:
                continue
            pts[sv] = pts.get(sv, 0) + _num(fila[2])
            gente.setdefault(sv, set()).add(_gente(fila[0]))
    ppp = {sv: (round(pts.get(sv, 0) / len(gente[sv]), 1) if gente.get(sv) else 0)
           for par in pares for sv in par}
    gana = []
    for a, b in pares:
        if ppp[a] > ppp[b]:
            gana.append(a)
        elif ppp[b] > ppp[a]:
            gana.append(b)
    return {'ppp': ppp, 'gana': gana}


def dorado_n(semana, eventos):
    """El número del evento dorado de esa semana, si ya se jugó; o `None`."""
    d = semana.get('dorado')
    if not d:
        return None
    if d.get('n'):
        return d['n']
    desde, fin = _de_iso(d['desde']), _de_iso(semana['fin'])
    cands = sorted((e[2], e[0]) for e in eventos if e[1] == d['sv'] and e[2] and desde <= e[2] < fin)
    return cands[0][1] if cands else None


def volve_de(filas):
    """`{(rapero, evento)}`: el segundo evento de cada uno, si cae dentro de los
    `VOLVE_DIAS` del primero —y después de que salió la regla—."""
    desde = _desde('volve')
    por = {}
    for e in filas:
        n, t, quien = e[0], e[2], e[3]
        if t:
            ya = por.setdefault(quien, {})
            ya[n] = min(t, ya.get(n, t))
    out = set()
    for quien, evs in por.items():
        orden = sorted((t, n) for n, t in evs.items())
        if len(orden) >= 2:
            (t1, _n1), (t2, n2) = orden[0], orden[1]
            if t2 - t1 <= dt.timedelta(days=VOLVE_DIAS) and t2 >= desde:
                out.add((quien, n2))
    return out


def bonos(filas):
    """Los fijos de cada semana: `{rapero: {'pts', 'por': [[semana, regla, pts], …]}}`.

    El Pasaporte (servidores distintos) y la Asistencia (días distintos, en
    hora del este), por semana de la Liga.
    """
    desde = _desde('semana')
    sem = {}
    for e in filas:
        sv, t, quien = e[1], e[2], e[3]
        if not t or t < desde:
            continue
        x = sem.setdefault((quien, periodo(t)[0]), {'sv': set(), 'dias': set()})
        x['sv'].add(sv)
        x['dias'].add(t.astimezone(_et()).date())
    out = {}
    for (quien, pid), x in sorted(sem.items()):
        for regla, (falta, pts), hay in (('pasaporte', PASAPORTE, len(x['sv'])),
                                         ('asistencia', ASISTENCIA, len(x['dias']))):
            if hay >= falta:
                y = out.setdefault(quien, {'pts': 0, 'por': []})
                y['pts'] += pts
                y['por'].append([pid, regla, pts])
    return out


def _org(s):
    """`@!    MMC.` -> `MMC.`: el organizador, sin la arroba; `''` si no es nadie."""
    import re
    x = re.sub(r'^[@!\s]+', '', str(s or '')).strip()
    return '' if x.lower() in NO_ES_ORG else x


def _clave_org(s):
    return _gente(_org(s))


def organizados(regs=None, anuncios=None):
    """`{n: organizador}`: quién organizó cada llave, por el «Organiza: X» del anuncio.

    El anuncio y la llave se unen con `llaves_web.cruzar()`, lo mismo que
    cuelga el «Ver llave» de «Lo que pasó»: mismo servidor, fecha cercana y
    nombre igual o parecido con los mismos números.
    """
    import llaves_web as LW
    import cuando as CU
    regs = LW.leer() if regs is None else regs
    if anuncios is None:
        try:
            with io.open(os.path.join(BASE, 'datos', 'anuncios.json'), encoding='utf-8') as f:
                anuncios = (json.load(f) or {}).get('anuncios') or []
        except (OSError, ValueError):
            anuncios = []
    pas = [{'nombre': x.get('nombre'), 'sv': x.get('servidor') or '',
            'cuando': CU.momento(x) or x.get('cuando'), 'org': _org(x.get('organizador'))}
           for x in anuncios if x.get('nombre') and _org(x.get('organizador'))]
    LW.cruzar(pas, regs)
    return {int(p['llave']): p['org'] for p in pas if str(p.get('llave') or '').isdigit()}


def ranking_org(ini, fin, eventos, org_de):
    """`[[organizador, gente, eventos], …]` de esa semana, de más a menos.

    Cada evento de `MIN_ORG` o más, con su llave, le suma su gente distinta.
    """
    por = {}
    for e in eventos:
        n, t, tabla = e[0], e[2], e[3]
        org = org_de.get(n)
        if not org or not t or not (ini <= t < fin):
            continue
        gente = len({_gente(f[0]) for f in tabla or [] if f})
        if gente < MIN_ORG:
            continue
        x = por.setdefault(_clave_org(org), [org, 0, 0])
        x[1] += gente
        x[2] += 1
    return sorted(por.values(), key=lambda x: (-x[1], -x[2], x[0].lower()))


def copa_n(semana, eventos, org_de):
    """El número del evento de la Copa de esa semana, si ya se jugó; o `None`."""
    c = semana.get('copa')
    if not c:
        return None
    if c.get('n'):
        return c['n']
    ini, fin = _de_iso(semana['inicio']), _de_iso(semana['fin'])
    cands = sorted((e[2], e[0]) for e in eventos
                   if e[2] and ini <= e[2] < fin and _clave_org(org_de.get(e[0])) == c['clave'])
    return cands[0][1] if cands else None


def _clave_persona(nombre):
    """La identidad de alguien de una llave, la misma en todas las temporadas.

    Sin banderas ni `❓` y con su AKA (`rankings.canon()`): «MAU KC 🇨🇴» de una
    llave y «Mau Kc» de la pre-temporada son la misma persona.
    """
    import re
    import rankings as RK
    x = re.sub(r'[\U0001F1E6-\U0001F1FF]', '', str(nombre or '')).replace('❓', '').strip()
    return _gente(RK.canon(x)) if x else ''


def leer_vistos(ruta=None):
    """`datos/vistos.json`: `{persona: [primer evento, servidor]}`, o `{}`."""
    try:
        with io.open(ruta or VISTOS, encoding='utf-8') as f:
            return (json.load(f) or {}).get('vistos') or {}
    except (OSError, ValueError):
        return {}


def anotar_vistos(vistos, eventos):
    """Anota a quien juega por primera vez: su instante y su servidor. Devuelve cuántos.

    ⚠️ SI UNA LLAVE VIEJA ENTRA TARDE, SU PRIMERA VEZ SE CORRE PARA ATRÁS: vale
    el evento más temprano, no el primero que se procesó.
    """
    nuevos = 0
    for e in eventos:
        sv, t, tabla = e[1], e[2], e[3]
        if not t:
            continue
        for f in tabla or []:
            k = _clave_persona(f[0] if f else '')
            if not k:
                continue
            ya = vistos.get(k)
            if ya is None:
                vistos[k] = [_iso(t), sv]
                nuevos += 1
            elif ya[0] > _iso(t):
                vistos[k] = [_iso(t), sv]
    return nuevos


def resultado_semillero(semana, eventos, vistos):
    """`{'nuevos': {sv: n}, 'gente': {sv: n}, 'gana': sv o None}` de esa semana.

    Nuevos: quien jugó por primera vez en su vida esa semana, contado para el
    servidor de ese primer evento. Gana el que más nuevos tiene en proporción
    a su gente distinta de la semana, con `SEMILLERO_MIN` como mínimo.
    """
    ini, fin = _de_iso(semana['inicio']), _de_iso(semana['fin'])
    gente = {}
    for e in eventos:
        sv, t, tabla = e[1], e[2], e[3]
        if t and ini <= t < fin:
            for f in tabla or []:
                gente.setdefault(sv, set()).add(_clave_persona(f[0] if f else ''))
    nuevos = {}
    for iso, sv in vistos.values():
        if sv and ini <= _de_iso(iso) < fin:
            nuevos[sv] = nuevos.get(sv, 0) + 1
    cands = [(nuevos[sv] / len(gente[sv]), nuevos[sv], sv) for sv in nuevos
             if nuevos[sv] >= SEMILLERO_MIN and gente.get(sv)]
    return {'nuevos': nuevos, 'gente': {sv: len(g) for sv, g in gente.items()},
            'gana': max(cands)[2] if cands else None}


def temporada_actual(ahora=None):
    """`'prueba'` o la temporada (`'t1'`): la misma regla que el Most Wanted."""
    from comun.temporada import ACTUAL
    a = _arranque()
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    return ACTUAL if a and ahora >= a else 'prueba'


def leer_rivales(ruta=None, estricto=False):
    """`datos/rivales.json`: `[[evento, instante, a, b, ganador, temporada], …]`.

    Con `estricto`, un archivo que está y no se lee revienta (ver `factor_de()`).
    """
    ruta = ruta or RIVALES
    if estricto and os.path.exists(ruta):
        with io.open(ruta, encoding='utf-8') as f:
            return (json.load(f) or {}).get('duelos') or []
    try:
        with io.open(ruta, encoding='utf-8') as f:
            return (json.load(f) or {}).get('duelos') or []
    except (OSError, ValueError):
        return []


def anotar_duelos(registro, regs=None, temporada=None):
    """Pone al día los duelos de la temporada de ahora, desde las llaves.

    ⚠️ LOS DE ESTA TEMPORADA SE REEMPLAZAN ENTEROS, evento por evento: si una
    llave se corrige, no quedan los duelos viejos al lado de los nuevos. Los
    de otras temporadas no se tocan: el reset vacía las llaves, no esto.
    """
    import llaves_web as LW
    regs = LW.leer() if regs is None else regs
    temporada = temporada or temporada_actual()
    ins = LW.instantes(regs)
    nums = {int(n) for n in regs if str(n).isdigit()}
    queda = [d for d in registro if not (d[5] == temporada and d[0] in nums)]
    nuevos = []
    for n, a, b, g in LW.duelos(regs):
        ms = ins.get(n) or LW.ms_de_fecha(regs[str(n)].get('fecha') or '')
        iso = _iso(dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc)) if ms else ''
        nuevos.append([n, iso, a, b, g, temporada])
    registro[:] = queda + nuevos
    return registro


def clasicos(registro=None):
    """Los Clásicos, en orden: `[{'n', 'temporada', 'a', 'b', 'g', 'pa', 'pb'}]`.

    Un duelo es Clásico si esos dos ya se habían cruzado en `CLASICO_PREVIOS`
    EVENTOS distintos: `pa` y `pb` son los duelos que había ganado cada uno
    en esos eventos, ANTES de éste. La identidad es la de la vitrina, así
    «MAU KC 🇨🇴» y «Mau Kc» son uno.

    🔴 EVENTOS Y NO DUELOS. Contaba duelos, y en un formato de vidas los
    mismos dos pelean varias veces la misma noche: en la Snake Arena Vol. 2
    (SR, 27/09/2026) DELUXE y FAZER se cruzaron CINCO veces, así que el
    tercero ya era «Clásico» y los dos cobraban el +10 % de una rivalidad que
    nació esa noche. Lo que pasa dentro del evento no cuenta para ese evento.
    """
    registro = leer_rivales() if registro is None else registro
    orden = sorted(enumerate(registro), key=lambda x: (x[1][1] or '', x[1][0], x[0]))
    # {pareja: {evento: {clave: ganados}}}
    hist, out = {}, []
    for _i, d in orden:
        n, _iso_, a, b, g, temp = d[:6]
        ka, kb = _clave_persona(a), _clave_persona(b)
        if not ka or not kb or ka == kb:
            continue
        h = hist.setdefault(tuple(sorted((ka, kb))), {})
        antes = [x for e, x in h.items() if e != n]
        if len(antes) >= CLASICO_PREVIOS:
            out.append({'n': n, 'temporada': temp, 'a': a, 'b': b, 'g': g,
                        'pa': sum(x.get(ka, 0) for x in antes),
                        'pb': sum(x.get(kb, 0) for x in antes)})
        kg = _clave_persona(g)
        e = h.setdefault(n, {})
        e[kg] = e.get(kg, 0) + 1
    return out


def rivalidades(registro=None, minimo=CLASICO_PREVIOS):
    """`{(clave_a, clave_b): {'nombres', 'g'}}`: las parejas que ya se cruzaron en `minimo` eventos.

    Para la llave EN VIVO: el próximo cruce de una de estas parejas es un
    Clásico. `g` son los duelos que ganó cada uno. ⚠️ EVENTOS distintos, como
    en `clasicos()`: una noche de 5 vidas no hace una rivalidad.
    """
    registro = leer_rivales() if registro is None else registro
    out = {}
    for d in registro:
        n, a, b, g = d[0], d[2], d[3], d[4]
        ka, kb = _clave_persona(a), _clave_persona(b)
        if not ka or not kb or ka == kb:
            continue
        x = out.setdefault(tuple(sorted((ka, kb))), {'nombres': {}, 'g': {}, 'ev': set()})
        x['nombres'][ka], x['nombres'][kb] = a, b
        x['ev'].add(n)
        kg = _clave_persona(g)
        x['g'][kg] = x['g'].get(kg, 0) + 1
    return {k: {'nombres': v['nombres'], 'g': v['g']}
            for k, v in out.items() if len(v['ev']) >= minimo}


def gente_de(ini, fin, eventos):
    """`{servidor: {personas}}`: la gente distinta de cada servidor en esa ventana."""
    out = {}
    for e in eventos:
        sv, t, tabla = e[1], e[2], e[3]
        if t and ini <= t < fin:
            for f in tabla or []:
                k = _clave_persona(f[0] if f else '')
                if k:
                    out.setdefault(sv, set()).add(k)
    return out


def sortear_metas(svs, ini, eventos):
    """`{servidor: meta}`: un `META_X` más que su promedio de las últimas semanas, con piso.

    El promedio es de las semanas en que ese servidor TUVO gente: una semana
    sin eventos no le baja la meta al que recién arranca.
    """
    ventanas = [gente_de(ini - dt.timedelta(days=7 * k), ini - dt.timedelta(days=7 * (k - 1)), eventos)
                for k in range(1, META_SEMANAS + 1)]
    out = {}
    for sv in svs:
        cuentas = [len(v.get(sv, ())) for v in ventanas if v.get(sv)]
        prom = sum(cuentas) / len(cuentas) if cuentas else 0
        out[sv] = max(META_MIN, int(-(-prom * META_X // 1)))
    return out


def premios_semana(semana, eventos, vistos=None, mw=None, d=None):
    """Los premios de una semana cerrada: `{'figura', 'revelacion', 'cazador', 'servidor'}`.

    La figura, por puntos de Temporada (con lo de esa semana: multiplicador,
    dorado, Copa, «Volvé», Clásicos); la revelación, la figura de los que
    jugaron por primera vez en su vida esa semana; el cazador, el que más
    cobró en el Most Wanted; el servidor, el que más gente movió.
    """
    ini, fin = _de_iso(semana['inicio']), _de_iso(semana['fin'])
    filas = [(e[0], e[1], e[2], f[0], _num(f[2])) for e in eventos if e[2] and ini <= e[2] < fin
             for f in (e[3] or []) if f and len(f) >= 3]
    fx = factor_de(d if d is not None else {'semanas': [semana]}, filas, rivales=[])
    pts, nombre = {}, {}
    for n, sv, t, quien, p in filas:
        k = _clave_persona(quien)
        pts[k] = pts.get(k, 0) + p * fx(sv, t, n, quien)
        nombre.setdefault(k, quien)
    out = {}
    if pts:
        k = max(pts, key=lambda x: (pts[x], x))
        out['figura'] = [nombre[k], int(round(pts[k]))]
    debut = {k for k, v in (vistos or {}).items() if ini <= _de_iso(v[0]) < fin}
    nuevos = {k: v for k, v in pts.items() if k in debut}
    if nuevos:
        k = max(nuevos, key=lambda x: (nuevos[x], x))
        out['revelacion'] = [nombre[k], int(round(nuevos[k]))]
    cobro = {}
    for per in (mw or {}).get('historial') or []:
        if per.get('inicio') and ini <= _de_iso(per['inicio']) < fin:
            for b in per.get('buscados') or []:
                for y in ((b.get('caza') or {}).get('por') or []):
                    cobro[y['n']] = cobro.get(y['n'], 0) + (y.get('cobra') or 0)
    if cobro:
        q = max(cobro, key=lambda x: (cobro[x], x))
        out['cazador'] = [q, cobro[q]]
    g = gente_de(ini, fin, eventos)
    if g:
        sv = max(g, key=lambda x: (len(g[x]), x))
        out['servidor'] = [sv, len(g[sv])]
    return out


def leer(ruta=None):
    """`datos/multiplicadores.json`, o `{}`."""
    try:
        with io.open(ruta or SALIDA, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def actual(d=None, ahora=None):
    """La semana guardada que contiene a `ahora`, o `None`."""
    d = leer() if d is None else d
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    for s in d.get('semanas') or []:
        if _de_iso(s['inicio']) <= ahora < _de_iso(s['fin']):
            return s
    return None


def factor_de(d=None, filas=None, rivales=None):
    """Una función `(servidor, instante, evento, rapero) -> multiplicador`.

    El multiplicador de la semana de ese servidor, ×3 si es el evento dorado
    y ×1,5 si es el «Volvé» de esa persona; con el techo de ×5. `instante`
    es un `datetime` con zona; fuera de toda semana sorteada vale 1. `filas`
    son las de `rankings.agregar.filas`: de ahí salen el dorado que todavía
    no se anotó y los «Volvé».

    ⚠️ SI EL ARCHIVO ESTÁ PERO NO SE PUEDE LEER, REVIENTA: sumar sin
    multiplicar una corrida bajaría los puntos de todos y los volvería a
    subir en la siguiente, con las tarjetas redibujándose dos veces. Mejor
    que la vitrina no se escriba esa vez.
    """
    if d is None:
        if os.path.exists(SALIDA):
            with io.open(SALIDA, encoding='utf-8') as f:
                d = json.load(f) or {}
        else:
            d = {}
    filas = filas or []
    # ⚙️ CON LOS TRAMOS A MANO (el Dashboard): la semana arranca con su sorteo y cada tramo vale desde su `desde`.
    # Ver `a_mano()`
    semanas = [(_de_iso(s['inicio']), _de_iso(s['fin']), s.get('sv_sorteo') or s.get('sv') or {},
                [(_de_iso(t['desde']), t.get('sv') or {}) for t in s.get('tramos') or []])
               for s in d.get('semanas') or []]
    # 🔑 LA META DE COMUNIDAD: la de cada servidor, contra su gente distinta de
    # esa semana en las filas (la misma identidad que el Semillero)
    metas_ok = set()
    for i, s in enumerate(d.get('semanas') or []):
        if s.get('metas'):
            ini, fin = semanas[i][0], semanas[i][1]
            gente = {}
            for e in filas:
                if e[2] and ini <= e[2] < fin:
                    gente.setdefault(e[1], set()).add(_clave_persona(e[3]))
            metas_ok |= {(i, sv) for sv, meta in s['metas'].items() if len(gente.get(sv, ())) >= meta}
    dorados = {x for x in (dorado_n(s, filas) for s in d.get('semanas') or []) if x}
    # la Copa se anota en el paso 0b (hace falta el anuncio): acá, lo anotado
    copas = {(s.get('copa') or {}).get('n') for s in d.get('semanas') or []} - {None}
    volve = volve_de(filas)
    # 🔑 los Clásicos de esta temporada: el que ganó, en ese evento
    temp = temporada_actual()
    rivales = leer_rivales(estricto=True) if rivales is None else rivales
    ganados = {(_clave_persona(c['g']), c['n']) for c in clasicos(rivales) if c['temporada'] == temp}
    claves = {}

    def factor(sv, instante, n=None, quien=None):
        x = 1
        if instante and sv:
            for i, (ini, fin, m, tramos) in enumerate(semanas):
                if ini <= instante < fin:
                    for desde, mt in tramos:
                        if desde <= instante:
                            m = mt
                    x = m.get(sv, 1)
                    if (i, sv) in metas_ok:
                        x *= META_BONO
                    break
        if n is not None and n in dorados:
            x *= DORADO_X
        if n is not None and n in copas:
            x *= COPA_X
        if quien is not None and (quien, n) in volve:
            x *= VOLVE_X
        if quien is not None and ganados:
            if quien not in claves:
                claves[quien] = _clave_persona(quien)
            if (claves[quien], n) in ganados:
                x *= CLASICO_X
        return min(TECHO, x)
    return factor


def eventos_de(regs=None):
    """`[(n, servidor, instante, tabla, nombre)]` de las llaves procesadas."""
    import llaves_web as LW
    regs = LW.leer() if regs is None else regs
    ins = LW.instantes(regs)
    out = []
    for n, r in regs.items():
        if not str(n).isdigit():
            continue
        ms = ins.get(int(n)) or LW.ms_de_fecha(r.get('fecha') or '')
        t = dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc) if ms else None
        out.append((int(n), (r.get('sv') or '').upper(), t, r.get('tabla') or [], r.get('nombre') or ''))
    return out


def votado(pid, svs, votos=None):
    """`{'sv', 'votos', 'de'}` del ×2 votado para la semana `pid`, o `None`.

    `votos` es todo lo de `/avisos/encuestas` (para el self-check); sin eso
    se lee. ⚠️ SI NO SE PUEDE LEER, SE SORTEA SIN ÉL y se dice: el sorteo
    del lunes no se traba por una encuesta.
    """
    try:
        import encuestas as ENC
        v = ENC.leer_votos() if votos is None else votos
        if v is None:
            print('   ⚠️ no pude leer los votos del ×2: se sortea sin ellos')
            return None
        g = ENC.ganador(v.get('x2:' + pid) or {}, validas=set(svs), semilla='x2:' + pid)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ el ×2 votado: %s' % str(e)[:80])
        return None
    return {'sv': g[0], 'votos': g[1], 'de': g[2]} if g else None


def ajustes_dueno():
    """Los ajustes del Dashboard de Dlx (`/avisos/ajustes`, con la clave del ciclo), o `None` si no se pudieron leer.

    ⚠️ SIN ELLOS NO SE TOCA NADA: ni se pone ni se saca el multiplicador a mano. Un Worker que no contesta no es
    «Dlx lo sacó».
    """
    import requests
    import fotos as F
    from alertar import WORKER
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        print('   ⚠️ sin DISCORD_TOKEN: no leo los ajustes del Dashboard')
        return None
    try:
        k = hashlib.sha256(('lg-ciclo:' + tok).encode('utf-8')).hexdigest()
        r = requests.get(WORKER + '/avisos/ajustes', headers={'x-lg-ciclo': k}, timeout=20)
        if r.status_code == 200:
            return r.json() or {}
        print('   ⚠️ los ajustes del Dashboard: el Worker contestó %s' % r.status_code)
    except (OSError, ValueError) as e:
        print('   ⚠️ los ajustes del Dashboard: %s' % str(e)[:80])
    return None


def a_mano(cur, aj, ahora):
    """El multiplicador a mano del Dashboard, sobre la semana `cur`. Devuelve si cambió algo.

    ⚙️ Dlx, 04/10/2026 (*«todo y muchas más cosas»*, a «elegir a mano el multiplicador de la semana»).

    🔑 VALE DESDE QUE SE ELIGE, NO PARA LA SEMANA ENTERA. Cada cambio es un tramo (`tramos`, con su `desde`) y
    `factor_de()` busca el de cada evento: lo que ya se jugó queda con el factor con que se jugó. Si no, pasar FFA
    de ×1,5 a ×3 un jueves le movería los puntos a todos desde el lunes y redibujaría sus tarjetas.
    El sorteo queda en `sv_sorteo`, y sacar el manual vuelve a él desde ese momento.
    ⚠️ Sólo la semana que dice el ajuste: el de la semana pasada no se arrastra a la nueva.
    """
    if aj is None or cur is None:
        return False
    man = aj.get('multiplicadores') or {}
    base = cur.get('sv_sorteo') or cur.get('sv') or {}
    tramos = cur.get('tramos') or []
    piso = max([_de_iso(cur['inicio'])] + [_de_iso(t['desde']) for t in tramos])
    if man.get('semana') == cur.get('id'):
        nuevo = dict(base)
        nuevo.update({k: v for k, v in (man.get('sv') or {}).items() if k in base})
        if cur.get('manual') and nuevo == cur.get('sv'):
            return False
        try:
            desde = max(piso, min(ahora, _de_iso(man.get('t') or _iso(ahora))))
        except ValueError:
            desde = max(piso, ahora)
        cur.setdefault('sv_sorteo', dict(base))
        cur['tramos'] = tramos + [{'desde': _iso(desde), 'sv': nuevo}]
        cur['sv'] = nuevo
        cur['manual'] = True
        return True
    if cur.get('manual'):
        cur['tramos'] = tramos + [{'desde': _iso(max(piso, ahora)), 'sv': dict(base)}]
        cur['sv'] = dict(base)
        cur.pop('manual', None)
        return True
    return False


def correr(ahora=None, aplicar=False, d=None, eventos=None, org_de=None, vistos=None, rivales=None,
           votos=None, ajustes=None):
    """Sortea la semana si hace falta, anota el dorado y la Copa, y cierra la guerra
    y el organizador de la semana. Devuelve el archivo."""
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    d = leer() if d is None else d
    semanas = d.get('semanas') or []
    evs = eventos_de() if eventos is None else eventos
    if org_de is None:
        try:
            org_de = organizados()
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ sin organizadores (%s)' % str(e)[:80])
            org_de = {}
    # 🔑 QUIÉN JUGÓ ALGUNA VEZ: se anota antes de todo, así el Semillero lo ve.
    # ⚠️ SIN EL REGISTRO NO HAY SEMILLERO: vacío, todos serían «nuevos».
    vistos = leer_vistos() if vistos is None else vistos
    semillero_ok = bool(vistos)
    if semillero_ok:
        anotar_vistos(vistos, evs)
    # 🔑 LOS DUELOS DE LA TEMPORADA, al día: de ahí salen los Clásicos
    rivales_ok = rivales is not None or eventos is None
    if rivales is None and eventos is None:
        rivales = leer_rivales()
        anotar_duelos(rivales)
    # la Copa que ya se jugó queda anotada, con su nombre
    for s in semanas:
        if s.get('copa') and not s['copa'].get('n'):
            x = copa_n(s, evs, org_de)
            if x:
                s['copa']['n'] = x
                s['copa']['nombre'] = next((e[4] for e in evs if e[0] == x and len(e) > 4), '')
    pid, ini, fin = periodo(ahora)
    # 📅 SI EL ARRANQUE SE MOVIÓ, LA SEMANA EN CURSO SE ACOMODA. Su `fin` se guardó al sortearla, con el corte del
    # arranque de ese momento: el 02/10/2026 el arranque pasó del 5 al 12 (Dlx: «El 12») y la semana guardada seguía
    # terminando a las 00:00 del 5 —once horas sin multiplicador, hasta el sorteo de las 11—. Sólo la que está
    # corriendo, y sólo su final: lo que ya se jugó no cambia.
    for s in semanas:
        if s.get('id') == pid and s.get('fin') and s['fin'] != _iso(fin) and ahora < max(_de_iso(s['fin']), fin):
            s['fin'] = _iso(fin)
    # el evento dorado que ya se jugó queda anotado: la página lo muestra
    for s in semanas:
        if s.get('dorado') and not s['dorado'].get('n'):
            x = dorado_n(s, evs)
            if x:
                s['dorado']['n'] = x
                s['dorado']['nombre'] = next((e[4] for e in evs if e[0] == x and len(e) > 4), '')
    if not any(s.get('id') == pid for s in semanas):
        try:
            from comun.temporada import ACTUAL
            a = _arranque()
            temp = ACTUAL if a and ahora >= a else 'prueba'
        except Exception:                                # noqa: BLE001
            temp = 'prueba'
        svs = servidores()
        rec = {'id': pid,
               # 🔑 el primero de todos arranca en el sorteo, no el lunes: ver arriba
               'inicio': _iso(ini if semanas else max(ini, ahora)),
               'fin': _iso(fin), 'temporada': temp, 'sorteado': _iso(ahora),
               'sv': sortear(svs, pid)}
        if ini >= _desde('semana'):
            # el dorado, en un servidor que juega: uno sin eventos lo desperdiciaría
            activos = sorted({e[1] for e in evs if e[2] and e[2] >= ahora - dt.timedelta(days=14)}
                             & set(svs)) or svs
            dor = sortear_dorado(activos, ini, fin, pid)
            if dor:
                rec['dorado'] = dor
            if len(svs) >= 2:
                rec['guerra'] = {'pares': emparejar(svs, pid)}
            rec['metas'] = sortear_metas(svs, ini, evs)
            # 🔑 EL ×2 VOTADO, antes de los premios: la guerra y el Semillero van encima
            vt = votado(pid, svs, votos)
            if vt and vt['sv'] in rec['sv']:
                rec['sv'][vt['sv']] = max(rec['sv'][vt['sv']], VOTADO_X)
                rec['votado'] = vt
                rec.setdefault('premios', {}).setdefault(vt['sv'], []).append('votado')
        # 🔑 LA GUERRA DE LA SEMANA QUE TERMINÓ: el que ganó lleva ×1,5 en ésta
        prev = semanas[-1] if semanas else None
        # 🔑 Y SU ORGANIZADOR: el primero es la sede de ésta, con la Copa
        if prev and _de_iso(prev['inicio']) >= _desde('semana') and 'organizadores_final' not in prev:
            rk = ranking_org(_de_iso(prev['inicio']), _de_iso(prev['fin']), evs, org_de)
            prev['organizadores'] = rk[:10]
            prev['organizadores_final'] = True
            if rk:
                rec['copa'] = {'org': rk[0][0], 'clave': _clave_org(rk[0][0])}
        if prev and prev.get('guerra') and 'gana' not in prev['guerra']:
            prev['guerra'].update(resultado_guerra(prev, evs))
            for sv in prev['guerra']['gana']:
                if sv in rec['sv']:
                    rec['sv'][sv] = min(TECHO, rec['sv'][sv] * GUERRA_X)
                    rec.setdefault('premios', {}).setdefault(sv, []).append('guerra')
        # 🔑 Y SUS PREMIOS: la figura, la revelación, el cazador y el servidor
        if prev and _de_iso(prev['inicio']) >= _desde('semana') and 'premios_semana' not in prev:
            try:
                import most_wanted as _MW
                _mwd = _MW.leer()
            except Exception:                            # noqa: BLE001
                _mwd = {}
            prev['premios_semana'] = premios_semana(prev, evs, vistos if semillero_ok else {}, _mwd,
                                                    {'semanas': semanas})
        # 🔑 Y SU SEMILLERO: el que más gente nueva trajo lleva ×1,5 en ésta
        if (prev and semillero_ok and _de_iso(prev['inicio']) >= _desde('semana')
                and not (prev.get('semillero') or {}).get('final')):
            prev['semillero'] = dict(resultado_semillero(prev, evs, vistos), final=True)
            sv = prev['semillero']['gana']
            if sv and sv in rec['sv']:
                rec['sv'][sv] = min(TECHO, rec['sv'][sv] * SEMILLERO_X)
                rec.setdefault('premios', {}).setdefault(sv, []).append('semillero')
        semanas.append(rec)
    # el organizador de la semana en curso, en vivo: la página muestra cómo va
    cur = next((s for s in semanas if s.get('id') == pid), None)
    # ⚙️ EL MULTIPLICADOR A MANO (el Dashboard): sólo en una corrida de verdad, como los duelos
    if ajustes is None and eventos is None:
        ajustes = ajustes_dueno()
    if a_mano(cur, ajustes, ahora):
        print('   ⚙️ el multiplicador a mano: %s' % ', '.join('%s ×%g' % kv for kv in sorted(cur['sv'].items())))
    if cur and _de_iso(cur['inicio']) >= _desde('semana'):
        cur['organizadores'] = ranking_org(_de_iso(cur['inicio']), _de_iso(cur['fin']), evs, org_de)[:10]
        if semillero_ok:
            cur['semillero'] = resultado_semillero(cur, evs, vistos)
        if cur.get('metas'):
            g = gente_de(_de_iso(cur['inicio']), _de_iso(cur['fin']), evs)
            cur['meta_va'] = {sv: len(g.get(sv, ())) for sv in cur['metas']}
    out = {'_leeme': 'La semana de la Liga: multiplicadores, evento dorado y guerra de servidores. '
                     'Lo sortea bot/multiplicadores.py (paso 0b del ciclo) y NO se vuelve a sortear. '
                     'Las reglas viven en ese archivo.',
           'semanas': semanas}
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
        if rivales_ok and rivales is not None and eventos is None:
            with io.open(RIVALES, 'w', encoding='utf-8') as f:
                json.dump({'_leeme': 'Todos los duelos de la Liga: [evento, instante, a, b, ganador, temporada]. '
                                     'De acá salen los Clásicos de bot/multiplicadores.py; NO se borra con la '
                                     'temporada (los de la temporada de ahora se rehacen desde las llaves).',
                           'duelos': rivales}, f, ensure_ascii=False, indent=0)
        if semillero_ok:
            with io.open(VISTOS, 'w', encoding='utf-8') as f:
                json.dump({'_leeme': 'Quién jugó alguna vez en la Liga: [primer evento, servidor]. Es del '
                                     'Semillero de bot/multiplicadores.py y NO se borra con la temporada.',
                           'vistos': dict(sorted(vistos.items()))}, f, ensure_ascii=False, indent=0)
    return out


# ── self-check ───────────────────────────────────────────────────────────
def _self_check():
    print('\n══ LA SEMANA DE LA LIGA ══\n')
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    et = _et()
    a = dt.datetime(2026, 10, 5, 0, 0, tzinfo=et).astimezone(dt.timezone.utc)
    en = lambda m, d, h, mi=0: dt.datetime(2026, m, d, h, mi, tzinfo=et)
    pid, ini, fin = periodo(en(9, 30, 15), a)
    ok(pid == '2026-09-28' and ini == en(9, 28, 11) and fin == en(10, 5, 0),
       'la semana de la prueba va del lunes 28 a las 11 al arranque (00:00 del 5)  %s' % pid)
    p1 = periodo(en(10, 5, 0, 22), a)
    p2 = periodo(en(10, 5, 11, 22), a)
    ok(p1 == p2 and p1[1] == en(10, 5, 0) and p1[2] == en(10, 12, 11),
       'la primera de la temporada va del arranque al lunes 12 a las 11, a cualquier hora del 5')
    pid, ini, fin = periodo(en(10, 14, 15), a)
    ok(pid == '2026-10-12' and (fin - ini).days == 7, 'y después, de lunes a lunes  %s' % pid)
    pid, ini, fin = periodo(en(11, 3, 12), a)
    ok(fin.astimezone(et).hour == 11, 'cruzando el cambio de horario sigue a las 11 AM ET')

    svs = ['DRA', 'FFA', 'SR', 'URBF']
    m = sortear(svs, '2026-10-12')
    vals = sorted(m.values())
    ok(set(m) == set(svs) and max(vals) >= 2 and sum(1 for v in vals if v < 1) <= 1,
       'uno por servidor, uno fuerte y como mucho un ×0,5  %s' % m)
    ok(sortear(svs, '2026-10-12') == m, 'con la misma semilla, lo mismo')
    n5 = sum(1 for i in range(400) if 5 in sortear(svs, 's%d' % i).values())
    nd = sum(1 for i in range(400) if DEBUFF_X in sortear(svs, 's%d' % i).values())
    ok(60 <= n5 <= 140 and 180 <= nd <= 300,
       'en 400 semanas: ×5 en %d (una de cada cuatro) y un ×0,5 en %d' % (n5, nd))

    # el dorado: un día de martes a sábado de esa semana; sin margen, no hay
    dor = sortear_dorado(svs, en(10, 12, 11), en(10, 19, 11), 'x')
    dd = _de_iso(dor['desde']).astimezone(et)
    ok(dor['sv'] in svs and 1 <= dd.weekday() <= 5 and en(10, 13, 0) <= dd <= en(10, 17, 0) and dd.hour == 0,
       'el dorado cae de martes a sábado, a las 00:00 ET  %s %s' % (dor['sv'], dd.strftime('%a %d')))
    ok(sortear_dorado(svs, en(9, 27, 12), en(9, 28, 11), 'x') is None,
       'y en una semana de un día no hay dorado (no hay tiempo de anunciarlo)')
    # la guerra: pares, y gana el de más puntos por persona
    pares = emparejar(svs, 'x')
    ok(len(pares) == 2 and sorted(sum(pares, [])) == svs and len(emparejar(svs + ['EFA'], 'x')) == 2,
       'la guerra arma pares con todos; con cinco, uno descansa  %s' % pares)
    sem = {'inicio': _iso(en(10, 12, 11)), 'fin': _iso(en(10, 19, 11)),
           'guerra': {'pares': [['FFA', 'SR'], ['DRA', 'URBF']]}}
    evsg = [(1, 'FFA', en(10, 13, 20), [['Ana', 'Campeón', 6000], ['Bea', 'Octavos', 1000]], 'X'),
            (2, 'SR', en(10, 14, 20), [['Cid', 'Campeón', 5000], ['Dan', 'Cuartos', 3000]], 'Y'),
            (3, 'SR', en(10, 20, 20), [['Cid', 'Campeón', 9000]], 'fuera de la semana')]
    rg = resultado_guerra(sem, evsg)
    ok(rg['ppp'] == {'FFA': 3500, 'SR': 4000, 'DRA': 0, 'URBF': 0} and rg['gana'] == ['SR'],
       'gana el de más puntos por persona (SR 4.000 contra FFA 3.500); cero contra cero, nadie')

    # el factor: el de la semana, el dorado y «Volvé», con techo
    d = {'semanas': [{'id': 'x', 'inicio': _iso(en(9, 28, 11)), 'fin': _iso(en(10, 5, 0)),
                      'sv': {'SR': 2, 'URBF': 0.5, 'DRA': 5},
                      'dorado': {'sv': 'SR', 'desde': _iso(en(9, 30, 0))}}]}
    filas = [(10, 'SR', en(9, 29, 20), 'Ana', 1000),   # SR, antes del día dorado
             (11, 'SR', en(9, 30, 21), 'Ana', 1000),   # el primero de SR desde el miércoles: dorado
             (12, 'SR', en(10, 1, 21), 'Bea', 1000),
             (13, 'DRA', en(10, 2, 21), 'Bea', 1000)]  # el segundo de Bea, a un día: «Volvé»
    f = factor_de(d, filas)
    ok(f('SR', en(9, 29, 20), 10, 'Ana') == 2 and f('SR', en(9, 30, 21), 11, 'Ana') == 5,
       'el evento dorado: ×2 × 3 con techo ×5 (y el de antes, sólo ×2)')
    ok(f('URBF', en(9, 30, 20), 99, 'Zoe') == 0.5 and f('FFA', en(9, 30, 20), 98, 'Zoe') == 1,
       'el que salió ×0,5 vale la mitad; el que no salió, ×1')
    ok(f('DRA', en(10, 2, 21), 13, 'Bea') == 5 and (('Bea', 13) in volve_de(filas)),
       '«Volvé»: el segundo de Bea a un día del primero ×1,5 (sobre ×5, techo)')
    ok(f('SR', en(9, 27, 11)) == 1 and f('SR', None) == 1,
       'antes de toda semana sorteada, o sin fecha, ×1 (no se aplica para atrás)')
    lejos = [(1, 'SR', en(9, 28, 20), 'Cid', 1), (2, 'SR', en(10, 8, 20), 'Cid', 1)]
    viejo = [(1, 'SR', en(9, 20, 20), 'Dan', 1), (2, 'SR', en(9, 22, 20), 'Dan', 1)]
    ok(not volve_de(lejos) and not volve_de(viejo),
       'y no si pasaron más de 7 días, ni si el segundo fue antes de que saliera la regla')

    # los bonos fijos: pasaporte y asistencia, por semana
    fb = [(1, 'FFA', en(9, 29, 20), 'Ana', 1), (2, 'SR', en(9, 30, 20), 'Ana', 1),
          (3, 'DRA', en(10, 1, 20), 'Ana', 1), (4, 'FFA', en(9, 29, 22), 'Bea', 1),
          (5, 'FFA', en(9, 29, 23), 'Bea', 1), (6, 'FFA', en(9, 27, 20), 'Cid', 1),
          (7, 'SR', en(9, 26, 20), 'Cid', 1), (8, 'DRA', en(9, 25, 20), 'Cid', 1)]
    b = bonos(fb)
    ok(b.get('Ana', {}).get('pts') == PASAPORTE[1] + ASISTENCIA[1] and 'Bea' not in b and 'Cid' not in b,
       'Ana jugó en 3 servidores y 3 días: +%d; Bea, un día y un servidor; lo de Cid fue antes de la regla'
       % (PASAPORTE[1] + ASISTENCIA[1]))

    # correr: la guerra que terminó le da el premio a la semana nueva
    dg = {'semanas': [{'id': '2026-10-12', 'inicio': _iso(en(10, 12, 11)), 'fin': _iso(en(10, 19, 11)),
                       'temporada': 't1', 'sv': {'FFA': 1, 'SR': 1, 'DRA': 1, 'URBF': 1},
                       'guerra': {'pares': [['FFA', 'SR'], ['DRA', 'URBF']]}}]}
    out = correr(en(10, 19, 11, 22), d=dg, eventos=evsg, org_de={}, vistos={}, votos={})
    nueva = out['semanas'][-1]
    ok(out['semanas'][0]['guerra']['gana'] == ['SR'] and nueva.get('premios') == {'SR': ['guerra']}
       and nueva['sv']['SR'] == min(TECHO, sortear(servidores(), '2026-10-19')['SR'] * GUERRA_X)
       and nueva.get('guerra') and nueva.get('dorado'),
       'al cerrar la semana, SR ganó la guerra y lleva ×1,5 en la nueva, que trae su dorado y sus pares')
    # 🔑 el ×2 votado: el más votado sale con ×2 como mínimo, y la guerra va encima
    dv = lambda: {'semanas': [{'id': '2026-10-12', 'inicio': _iso(en(10, 12, 11)),
                               'fin': _iso(en(10, 19, 11)), 'temporada': 't1',
                               'sv': {'FFA': 1, 'SR': 1, 'DRA': 1, 'URBF': 1},
                               'guerra': {'pares': [['FFA', 'SR'], ['DRA', 'URBF']]}}]}
    out = correr(en(10, 19, 11, 22), d=dv(), eventos=evsg, org_de={}, vistos={},
                 votos={'x2:2026-10-19': {'SR': 4, 'FFA': 1}})
    nv, base = out['semanas'][-1], sortear(servidores(), '2026-10-19')['SR']
    ok(nv.get('votado') == {'sv': 'SR', 'votos': 4, 'de': 5} and nv['premios']['SR'] == ['votado', 'guerra']
       and nv['sv']['SR'] == min(TECHO, max(base, VOTADO_X) * GUERRA_X),
       'SR ganó la votación: ×2 como mínimo (el sorteo le daba ×%s) y la guerra encima: ×%s'
       % (str(base).replace('.', ','), str(nv['sv']['SR']).replace('.', ',')))
    out = correr(en(10, 19, 11, 22), d=dv(), eventos=evsg, org_de={}, vistos={},
                 votos={'x2:2026-10-19': {'FFA': 2}})
    ok('votado' not in out['semanas'][-1] and 'votado' not in str(out['semanas'][-1].get('premios')),
       'con menos de 3 votos, el sorteo queda como salió')
    ok(votado('2026-10-19', ['FFA', 'SR'], {'x2:2026-10-19': {'EFA': 9, 'SR': 1}}) is None,
       'un voto a un servidor que no está en el sorteo no cuenta')
    # el organizador de la semana y la Copa
    ok(_org('@!    MMC.') == 'MMC.' and _org('yo') == '' and _clave_org('@nachonc_') == 'nachonc',
       'el organizador sale del anuncio, sin arroba; «yo» no es nadie')
    evo = [(21, 'FFA', en(10, 13, 20), [['p%d' % i, 'x', 1] for i in range(12)], 'A'),
           (22, 'SR', en(10, 14, 20), [['q%d' % i, 'x', 1] for i in range(9)], 'B'),
           (23, 'SR', en(10, 15, 20), [['r%d' % i, 'x', 1] for i in range(5)], 'chico'),
           (24, 'FFA', en(10, 16, 20), [['s%d' % i, 'x', 1] for i in range(10)], 'C')]
    orgs = {21: '@nachonc_', 22: 'Carlos', 23: 'Carlos', 24: 'nachonc_'}
    rk = ranking_org(en(10, 12, 11), en(10, 19, 11), evo, orgs)
    ok([r[:3] for r in rk] == [['@nachonc_', 22, 2], ['Carlos', 9, 1]],
       'suma la gente de sus eventos de 8 o más (el de 5 no cuenta)  %s' % rk)
    dc = {'semanas': [{'id': '2026-10-12', 'inicio': _iso(en(10, 12, 11)), 'fin': _iso(en(10, 19, 11)),
                       'temporada': 't1', 'sv': {'FFA': 1, 'SR': 1}}]}
    evc = evo + [(31, 'SR', en(10, 20, 20), [['t%d' % i, 'x', 1] for i in range(8)], 'otro'),
                 (32, 'FFA', en(10, 21, 20), [['u%d' % i, 'x', 1] for i in range(8)], 'LA COPA')]
    orgc = {**orgs, 31: 'Carlos', 32: '@nachonc_'}
    out = correr(en(10, 19, 11, 22), d=dc, eventos=evc, org_de=orgc, vistos={}, votos={})
    nueva = out['semanas'][-1]
    ok(nueva.get('copa', {}).get('org') == '@nachonc_' and out['semanas'][0].get('organizadores_final'),
       'al cerrar la semana, el primero es la sede de la siguiente')
    out = correr(en(10, 22, 12), d=out, eventos=evc, org_de=orgc, vistos={}, votos={})
    c = out['semanas'][-1]['copa']
    f2 = factor_de(out, [])
    ok(c.get('n') == 32 and c.get('nombre') == 'LA COPA' and f2('FFA', en(10, 21, 20), 32) == min(
        TECHO, out['semanas'][-1]['sv'].get('FFA', 1) * COPA_X),
       'su próximo evento de esa semana es la Copa y vale ×2 (el de otro organizador, no)')

    # el Semillero: gente que juega por primera vez en su vida, en proporción
    vis = {'viejo1': ['2026-01-01T00:00:00Z', ''], 'viejo2': ['2026-01-01T00:00:00Z', '']}
    evn = [(41, 'SR', en(10, 13, 20), [['Viejo1', 'x', 1], ['n1', 'x', 1], ['n2', 'x', 1], ['n3', 'x', 1]], 'a'),
           (42, 'FFA', en(10, 14, 20), [['viejo2', 'x', 1]] + [['f%d' % i, 'x', 1] for i in range(4)]
            + [['v%d' % i, 'x', 1] for i in range(15)], 'b'),
           (43, 'FFA', en(10, 15, 20), [['n1', 'x', 1]], 'c')]
    for i in range(15):
        vis['v%d' % i] = ['2026-09-23T00:00:00Z', 'FFA']
    ok(anotar_vistos(vis, evn) == 7 and vis['n1'][1] == 'SR' and vis['viejo1'][1] == '',
       'se anota quien juega por primera vez (7), con el servidor de ese primer evento; el viejo sigue viejo')
    rs = resultado_semillero({'inicio': _iso(en(10, 12, 11)), 'fin': _iso(en(10, 19, 11))}, evn, vis)
    ok(rs['nuevos'] == {'SR': 3, 'FFA': 4} and rs['gana'] == 'SR',
       'gana SR con 3 nuevos de 4 (FFA trajo 4, pero de 20): en proporción, no en cantidad  %s' % rs)
    vis2 = {k: v for k, v in vis.items() if k not in ('n2', 'n3')}
    rs2 = resultado_semillero({'inicio': _iso(en(10, 12, 11)), 'fin': _iso(en(10, 19, 11))}, evn, vis2)
    ok(rs2['gana'] == 'FFA', 'con menos de 3 nuevos no se gana: SR queda afuera y gana FFA')
    ds = {'semanas': [{'id': '2026-10-12', 'inicio': _iso(en(10, 12, 11)), 'fin': _iso(en(10, 19, 11)),
                       'temporada': 't1', 'sv': {'FFA': 1, 'SR': 1}}]}
    out = correr(en(10, 19, 11, 22), d=ds, eventos=evn, org_de={}, vistos=dict(vis), votos={})
    ok(out['semanas'][0]['semillero']['gana'] == 'SR' and 'semillero' in out['semanas'][-1]['premios'].get('SR', []),
       'al cerrar la semana, SR es el Semillero y lleva ×1,5 en la nueva')
    ok(correr(en(10, 19, 11, 22), d={'semanas': []}, eventos=evn, org_de={}, vistos={}, votos={})['semanas'][-1]
       .get('semillero') is None, 'sin el registro de quién ya jugó, no hay Semillero (todos serían nuevos)')
    # 📅 el arranque se movió (Dlx, 02/10/2026: «El 12»): la semana en curso se acomoda, la anterior no se toca
    pidc, inic, finc = periodo(en(10, 2, 12))
    dmov = {'semanas': [{'id': 'vieja', 'inicio': _iso(inic - dt.timedelta(days=7)), 'fin': _iso(inic),
                         'temporada': 'prueba', 'sv': {}},
                        {'id': pidc, 'inicio': _iso(inic), 'fin': _iso(finc - dt.timedelta(hours=11)),
                         'temporada': 'prueba', 'sv': {'FFA': 1}}]}
    out = correr(finc - dt.timedelta(hours=2), d=dmov, eventos=[], org_de={}, vistos={}, votos={})
    ok(out['semanas'][1]['fin'] == _iso(finc) and out['semanas'][0]['fin'] == _iso(inic),
       'si el arranque se mueve, la semana en curso termina cuando le toca (sin hueco), y la anterior no cambia')
    # la meta de comunidad: un 10 % más que su promedio, con piso
    evm = [(51, 'FFA', en(10, 7, 20), [['p%d' % i, 'x', 100] for i in range(20)], 'a'),
           (52, 'FFA', en(9, 30, 20), [['q%d' % i, 'x', 100] for i in range(10)], 'b'),
           (53, 'SR', en(10, 8, 20), [['r%d' % i, 'x', 100] for i in range(3)], 'c')]
    mt = sortear_metas(['FFA', 'SR', 'URBF'], en(10, 12, 11), evm)
    ok(mt == {'FFA': 17, 'SR': 8, 'URBF': 8},
       'FFA: promedio de sus semanas con gente (20 y 10) + 10 %% = 17; SR y URBF, el piso de 8  %s' % mt)
    dm = {'semanas': [{'id': 'm', 'inicio': _iso(en(10, 12, 11)), 'fin': _iso(en(10, 19, 11)),
                       'sv': {'FFA': 1, 'SR': 1}, 'metas': {'FFA': 3, 'SR': 8}}]}
    fm = [(61, 'FFA', en(10, 13, 20), 'Ana', 100), (61, 'FFA', en(10, 13, 20), 'Bea', 100),
          (62, 'FFA', en(10, 14, 20), 'Cid', 100), (63, 'SR', en(10, 14, 20), 'Dan', 100)]
    f4 = factor_de(dm, fm, rivales=[])
    ok(abs(f4('FFA', en(10, 13, 20), 61, 'Ana') - META_BONO) < 1e-9 and f4('SR', en(10, 14, 20), 63, 'Dan') == 1,
       'FFA juntó 3 de 3: todos los que jugaron ahí suman +10 %; SR, 1 de 8, nada')
    # los premios de la semana
    evp = [(71, 'FFA', en(10, 13, 20), [['Ana', 'Campeón', 5000], ['Bea', 'Octavos', 1000]], 'x'),
           (72, 'SR', en(10, 14, 20), [['Cid', 'Campeón', 3000], ['Ana', 'Cuartos', 2000], ['Eli', 'x', 500]], 'y')]
    mwp = {'historial': [{'inicio': _iso(en(10, 13, 11)), 'buscados': [
        {'caza': {'por': [{'n': 'Bea', 'cobra': 9000}]}}]}]}
    pr = premios_semana({'inicio': _iso(en(10, 12, 11)), 'fin': _iso(en(10, 19, 11)), 'sv': {}},
                        evp, {'cid': ['2026-10-14T00:00:00Z', 'SR']}, mwp)
    ok(pr.get('figura') == ['Ana', 8000] and pr.get('revelacion') == ['Cid', 3000]
       and pr.get('cazador') == ['Bea', 9000] and pr.get('servidor') == ['SR', 3],
       'la figura (Ana: 5.000 + 2.000 con «Volvé» ×1,5), la revelación (Cid, debutó), el cazador (Bea) '
       'y el servidor (SR, 3 personas)  %s' % pr)

    # los Clásicos: el tercer cruce, o más, con los ganados de antes
    rv = [[1, '2026-10-13T00:00:00Z', 'Ana', 'Bea', 'Ana', 't1'],
          [2, '2026-10-14T00:00:00Z', 'Bea 🇨🇴', 'Ana', 'Bea 🇨🇴', 't1'],
          [3, '2026-10-15T00:00:00Z', 'Ana', 'Bea', 'Ana', 't1'],
          [4, '2026-10-16T00:00:00Z', 'Bea', 'Ana', 'Ana', 't1'],
          [5, '2026-10-16T00:00:00Z', 'Cid', 'Dan', 'Cid', 't1']]
    cs = clasicos(rv)
    ok([(c['n'], c['g'], c['pa'], c['pb']) for c in cs] == [(3, 'Ana', 1, 1), (4, 'Ana', 1, 2)],
       'el tercer cruce de Ana y Bea es Clásico (1–1 antes), y el cuarto también (2–1); Cid y Dan, no')
    rz = rivalidades(rv)
    ok(list(rz) == [('ana', 'bea')] and rz[('ana', 'bea')]['g'] == {'ana': 3, 'bea': 1},
       'para la llave en vivo: Ana y Bea ya se cruzaron (3–1)')
    # 🔴 un 5 vidas: los mismos dos, cuatro veces en la misma noche. No es un
    # Clásico —ni el tercero ni el cuarto— y todavía no son rivales; al
    # tercer EVENTO sí, con los duelos de las dos noches anteriores
    rv3 = [[10, '2026-10-20T00:00:00Z', 'Eli', 'Fede', 'Eli', 't1'],
           [10, '2026-10-20T00:00:00Z', 'Fede', 'Eli', 'Fede', 't1'],
           [10, '2026-10-20T00:00:00Z', 'Eli', 'Fede', 'Eli', 't1'],
           [10, '2026-10-20T00:00:00Z', 'Eli', 'Fede', 'Eli', 't1']]
    ok(clasicos(rv3) == [] and rivalidades(rv3) == {},
       'cuatro cruces en un mismo evento (un 5 vidas) no hacen un Clásico ni una rivalidad')
    rv3 += [[11, '2026-10-21T00:00:00Z', 'Eli', 'Fede', 'Fede', 't1'],
            [12, '2026-10-22T00:00:00Z', 'Fede', 'Eli', 'Eli', 't1']]
    c3 = [(c['n'], c['g'], c['pa'], c['pb']) for c in clasicos(rv3)]
    ok(c3 == [(12, 'Eli', 2, 3)] and list(rivalidades(rv3)) == [('eli', 'fede')],
       'al tercer evento sí, con los duelos de antes (Fede 2, Eli 3)  %s' % c3)
    rv2 = list(rv)
    anotar_duelos(rv2, regs={}, temporada='t1')
    ok(len(rv2) == 5, 'sin llaves de esa temporada, los duelos guardados quedan como estaban')
    import unittest.mock as _mock
    with _mock.patch(__name__ + '.temporada_actual', return_value='t1'):
        f3 = factor_de({'semanas': []}, [], rivales=rv)
    ok(f3('FFA', en(10, 15, 20), 3, 'Ana') == CLASICO_X and f3('FFA', en(10, 15, 20), 3, 'Bea') == 1,
       'el que gana el Clásico suma +10 % en ese evento; el que pierde, nada')
    # ⚙️ el multiplicador a mano: desde que se elige, sólo esa semana, y sacarlo vuelve al sorteo
    sem = {'id': '2026-10-12', 'inicio': _iso(en(10, 12, 11)), 'fin': _iso(en(10, 19, 11)),
           'sv': {'FFA': 1.5, 'SR': 1}}
    aj = {'multiplicadores': {'semana': '2026-10-12', 'sv': {'FFA': 3, 'XX': 5}, 't': _iso(en(10, 15, 20))}}
    ok(a_mano(sem, aj, en(10, 15, 20, 22)) and sem['sv'] == {'FFA': 3, 'SR': 1} and sem['manual']
       and sem['sv_sorteo'] == {'FFA': 1.5, 'SR': 1} and sem['tramos'][0]['desde'] == _iso(en(10, 15, 20)),
       'a mano: FFA ×3 desde el jueves a las 8 PM, sin servidores que no juegan esa semana')
    ok(not a_mano(sem, aj, en(10, 15, 20, 52)), 'la corrida siguiente no lo vuelve a anotar')
    f4 = factor_de({'semanas': [sem]}, [], rivales=[])
    ok(f4('FFA', en(10, 13, 20)) == 1.5 and f4('FFA', en(10, 16, 20)) == 3 and f4('SR', en(10, 16, 20)) == 1,
       'lo que se jugó antes queda con su ×1,5; lo de después, ×3')
    ok(not a_mano(dict(sem), None, en(10, 16, 9)), 'sin poder leer los ajustes no se toca nada')
    ok(a_mano(sem, {}, en(10, 17, 9)) and sem['sv'] == {'FFA': 1.5, 'SR': 1} and 'manual' not in sem
       and factor_de({'semanas': [sem]}, [], rivales=[])('FFA', en(10, 18, 20)) == 1.5
       and factor_de({'semanas': [sem]}, [], rivales=[])('FFA', en(10, 16, 20)) == 3,
       'sacarlo vuelve al sorteo desde ese momento, y lo del medio queda con ×3')
    otra = {'id': '2026-10-19', 'inicio': _iso(en(10, 19, 11)), 'fin': _iso(en(10, 26, 11)), 'sv': {'FFA': 1}}
    ok(not a_mano(otra, aj, en(10, 20, 9)) and otra['sv'] == {'FFA': 1},
       'el ajuste de la semana pasada no se arrastra a la nueva')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    a = sys.argv[1:]
    if '--auto' in a:
        return 1 if _self_check() else 0
    out = correr(aplicar='--aplicar' in a)
    s = actual(out)
    print('\n══ LA SEMANA DE LA LIGA ══\n')
    if not s:
        print('   (ninguna semana sorteada cubre este momento)\n')
        return 0
    print('   semana %s · %s → %s ET' % (s['id'], _de_iso(s['inicio']).astimezone(_et()).strftime('%d/%m %H:%M'),
                                         _de_iso(s['fin']).astimezone(_et()).strftime('%d/%m %H:%M')))
    for sv, x in sorted(s['sv'].items(), key=lambda kv: -kv[1]):
        print('      %-5s ×%s%s' % (sv, ('%g' % x).replace('.', ','),
                                     '  (ganó la guerra)' if (s.get('premio') or {}).get(sv) else ''))
    if s.get('dorado'):
        print('   dorado: %s desde el %s%s' % (s['dorado']['sv'], _de_iso(s['dorado']['desde']).astimezone(_et())
                                              .strftime('%a %d/%m'),
                                              ' → fue el #%s' % s['dorado']['n'] if s['dorado'].get('n') else ''))
    if s.get('guerra'):
        print('   guerra: %s' % ' · '.join('%s vs %s' % tuple(p) for p in s['guerra']['pares']))
    if s.get('copa'):
        print('   copa: el próximo evento de %s%s' % (s['copa']['org'], ' → fue el #%s' % s['copa']['n']
                                                    if s['copa'].get('n') else ''))
    if s.get('organizadores'):
        print('   organizadores: %s' % ' · '.join('%s %d' % (o[0], o[1]) for o in s['organizadores'][:5]))
    if '--aplicar' not in a:
        print('\n   (simulacro: no escribí nada — `--aplicar`)')
    print()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
