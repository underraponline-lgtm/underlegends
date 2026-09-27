# -*- coding: utf-8 -*-
"""MOST WANTED, SOLO: quién es buscado, quién lo cazó y quién sobrevivió.

    python bot/most_wanted.py            el período de ahora, sin escribir nada
    python bot/most_wanted.py --aplicar  escribe datos/mw.json (lo hace el ciclo, paso 2b)
    python bot/most_wanted.py --auto     el self-check, sin red ni archivos

Dlx, 27/09/2026, sobre la pre-temporada: *«seleccionar a varias personas…
para que sean cazadas y que cualquiera pueda cazarlas. Esto en cualquier
evento de cualquier servidor que es parte de la Liga Global… es muy
importante que las llaves lo detecten»*. Y para probarlo ya: *«podríamos
empezar ahora para ver, pero sería a diario porque no tenemos mucho tiempo
en esta fase de prueba»*. Y la prueba termina el 4 de octubre: *«the period
ends in october 4… like the periodo de prueba»*. Por eso el período es de
**un día** hasta el arranque de la temporada y de **una semana** desde ahí,
solo: ver `tipo_de()`, que lee la fecha de `comun/temporada.py`.

LO QUE DECIDIÓ DLX (ver la memoria `most-wanted-diseno`)
---------------------------------------------------------
- De 10 a 15 buscados por período, **cada uno con una categoría**, y
  gente distinta cada vez: nadie repite el período siguiente.
- **Nada de inactivos.**
- La recompensa **sube mientras juega sin que lo cacen**, y **vence**.
- **Sobrevivir pide jugar**; si no, «se escondió» y no gana nada.
- **Paga más al cazador que viene de abajo.**
- En triples y por equipos, **se reparte entre los cazadores**.
- **MW suma a la Temporada, nunca al Competitivo.**
- ❌ ni «el cazador queda buscado» ni pagar doble en DRA.
- **Los fuera de concurso no son buscados** (cazar, sí): ver `elegir()`.

⚠️ LOS NÚMEROS SON DE PRUEBA Y VIVEN TODOS ACÁ ARRIBA. Dlx va a recalcular y
balancear los puntos de todo al final: cambiar uno es cambiar una línea.

⚠️ SE RECALCULA ENTERO EN CADA CORRIDA, desde las llaves procesadas. Lo
único que se guarda es QUIÉNES son los buscados del período (se eligen una
vez, al arrancar) y la foto de los puestos para «El Sigiloso». Así una llave
que se procesa tarde, o se corrige, cambia la caza sin dejar nada viejo.
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

SALIDA = os.path.join(BASE, 'datos', 'mw.json')

# ── los números, todos acá ───────────────────────────────────────────────
#: el tipo de período no se escribe acá: 'dia' en la fase de prueba y
#: 'semana' desde el arranque de la temporada. Ver `tipo_de()`.
#: el período arranca a esta hora del este: la primera corrida después de
#: la madrugada (de 3 a 11 AM ET no corre el ciclo)
ARRANCA_H = 11
#: cuántos buscados por período. Dlx, 27/09/2026: *«de momento, como es
#: diario, que sean 3… y que cuando sea por semana que sean 9»*
CUANTOS = {'dia': 3, 'semana': 9}
#: cómo se reparten entre los niveles de categoría. ⚠️ Sin esto, con tres
#: lugares salían SIEMPRE El Rey, El Imparable y El Verdugo —las tres
#: primeras de la lista—: el Rey es casi imposible de cazar y los demás
#: nunca aparecían. Uno de cada nivel: un pez gordo, uno del medio y uno al
#: alcance de cualquiera. Dentro de cada nivel la categoría sale sorteada.
CUPOS = {'dia': (('A', 1), ('B', 1), ('CD', 1)),
         'semana': (('A', 2), ('B', 3), ('C', 3), ('D', 1))}
#: la recompensa base de cada nivel de categoría. La pre-temporada pagaba
#: de 5.000 a 20.000 (Dlx, 27/09/2026)
BASE_NIVEL = {'A': 8000, 'B': 6000, 'C': 5000, 'D': 4000}
#: por el puesto del buscado (por mérito, `o`): (hasta, multiplicador)
POR_NIVEL = ((10, 1.5), (30, 1.2))
#: cuánto sube por cada evento que juega sin que lo cacen, y el tope
SUBE, TOPE_SUBE = 0.20, 2.0
#: cuánto más cobra el cazador por cada puesto que está debajo, y el tope
POR_PUESTO, TOPE_PUESTO = 0.02, 2.0
#: la recompensa queda entre estos dos
RANGO = (5000, 20000)
#: redondeo de lo que se cobra
REDONDEO = 250
#: para sobrevivir: eventos jugados y hasta qué fase llegó en alguno
SOBREVIVIR = {'dia': 1, 'semana': 3}
FASE_MINIMA = 'Cuartos'
FASE_MINIMA_REY = 'Semifinal'
#: lo que se lleva el que sobrevive, sobre su recompensa final
PAGA_SOBREVIVIR = 0.5
#: para poder ser buscado: eventos en los últimos días
ACTIVO = {'dia': (2, 7), 'semana': (2, 14)}
#: un evento con menos gente no cuenta para cazar
MIN_PARTICIPANTES = 8
#: El Muro: al menos 8 duelos y esta parte ganada. Sin piso, el primer día
#: salió un Muro con 4 de 8 — la mitad no es una pared
MURO_MIN = 0.6
#: cuántos períodos viejos se guardan (el perfil y los títulos salen de acá)
HISTORIAL = 400

#: el orden de las fases, de mejor a peor, como las escribe `tabla`
FASES = ['Campeón', 'Subcampeón', 'Tercero', 'Cuarto', 'Semifinal', 'Cuartos',
         'Octavos', 'Dieciseisavos', 'R32', 'R64']
PODIO = ('Campeón', 'Subcampeón', 'Tercero')

#: las categorías: (id, nombre, nivel). El orden es la prioridad al elegir.
CATEGORIAS = [
    ('rey', 'El Rey', 'A'),
    ('imparable', 'El Imparable', 'A'),
    ('verdugo', 'El Verdugo', 'B'),
    ('coleccionista', 'El Coleccionista', 'B'),
    ('muro', 'El Muro', 'B'),
    ('dueno', 'El Dueño de Casa', 'B'),
    ('oscuro', 'El Oscuro', 'C'),
    ('sigiloso', 'El Sigiloso', 'C'),
    ('fantasma', 'El Fantasma', 'C'),
    ('viajero', 'El Viajero', 'C'),
    ('veterano', 'El Veterano', 'C'),
    ('novato', 'El Novato', 'D'),
    ('comodin', 'El Comodín', 'D'),
]
NOMBRE = {c: n for c, n, _t in CATEGORIAS}
NIVEL = {c: t for c, _n, t in CATEGORIAS}

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


def _arranque():
    """Cuándo arranca la temporada —las 00:00 ET de su primer día—, en UTC, o
    `None` si no tiene fecha. Sale de `comun/temporada.py`: un solo lugar.

    🔑 ES CUANDO TERMINA LA PRUEBA, y el Most Wanted diario con ella. Dlx,
    27/09/2026: *«the period ends in october 4… like the periodo de
    prueba»*.

    ⚠️ Y NO A LAS 11 AM DEL 5: a las 00:00 el paso 0 del ciclo archiva las
    llaves de la prueba. Un día de Most Wanted que siguiera abierto después
    se recalcularía sin ellas y cerraría con todos «escondidos».
    """
    from comun.temporada import arranque
    a = arranque()
    return dt.datetime.fromisoformat(a) if a else None


def _primera_semana():
    """Cuándo sale el primer Most Wanted de la temporada: el lunes a las 11 AM
    ET después de su primera semana entera. Para la T1, el lunes 12/10.

    🔑 Dlx, 27/09/2026, a «arranca el lunes 12/10, con la primera semana de
    la T1»: *«sí»*. Con todo en cero no hay a quién buscar —pide dos
    eventos—: la primera semana es la que dice quiénes son.
    """
    a = _arranque()
    if not a:
        return None
    d = a.astimezone(_et()).date() + dt.timedelta(days=7)
    d += dt.timedelta(days=(7 - d.weekday()) % 7)              # el lunes
    return dt.datetime(d.year, d.month, d.day, ARRANCA_H, tzinfo=_et()).astimezone(dt.timezone.utc)


def _espera(ahora=None):
    """Entre el arranque y el primer Most Wanted: cuándo sale. Si no, `None`."""
    a, p = _arranque(), _primera_semana()
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    return p if a and a <= ahora < p else None


def tipo_de(ahora=None):
    """`'dia'` en la fase de prueba, `'semana'` desde el arranque de la temporada."""
    a = _arranque()
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    return 'semana' if a and ahora >= a else 'dia'


def temporada_de(ahora=None):
    """De qué temporada es un período: `'prueba'` o la temporada (`'t1'`).

    🔴 LO DE LA PRUEBA NO CUENTA EN LA TEMPORADA. Dlx, 25/09/2026: lo jugado
    en la fase de prueba *«se borra»*. Los períodos quedan en el historial,
    pero la tabla de cazadores y el perfil cuentan sólo los de la temporada
    del período de ahora.
    """
    from comun.temporada import ACTUAL
    a = _arranque()
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    return ACTUAL if a and ahora >= a else 'prueba'


def periodo(ahora=None, tipo=None):
    """`(id, inicio, fin)` del período que contiene a `ahora`, en UTC.

    Un día va de las 11 AM ET a las 11 AM ET del día siguiente; una semana,
    de lunes a lunes a la misma hora. La hora del este de verdad, con el
    cambio de horario: 11 AM es 11 AM en octubre y en diciembre. Y el último
    día de prueba termina con la prueba: ver `_arranque()`.
    """
    tipo = tipo or tipo_de(ahora)
    ahora = (ahora or dt.datetime.now(dt.timezone.utc)).astimezone(_et())
    ini = ahora.replace(hour=ARRANCA_H, minute=0, second=0, microsecond=0)
    if ahora < ini:
        ini -= dt.timedelta(days=1)
    # ⚠️ la suma es de reloj de pared (así funciona `zoneinfo`): cruzando el
    # cambio de horario, el fin sigue siendo a las 11 AM ET
    if tipo == 'semana':
        ini -= dt.timedelta(days=ini.weekday())
        fin = ini + dt.timedelta(days=7)
    else:
        fin = ini + dt.timedelta(days=1)
    ini_u, fin_u = ini.astimezone(dt.timezone.utc), fin.astimezone(dt.timezone.utc)
    a = _arranque()
    if a and ini_u < a < fin_u:
        fin_u = a
    return ini.strftime('%Y-%m-%d'), ini_u, fin_u


def _redondear(x):
    return int(round(x / REDONDEO) * REDONDEO)


def _fase(p):
    return FASES.index(p) if p in FASES else len(FASES)


# ── quién es quién en una llave ──────────────────────────────────────────
class Resolver:
    """Un nombre de llave -> la fila del pool, con los alias y las banderas.

    ⚠️ LA MISMA REGLA QUE EL PERFIL (`subir_web._perfiles().de()`): la
    normalización del padrón, los alias de `datos/akas.json` y, si el nombre
    es de dos personas (Volk 🇲🇽 y volk 🇨🇴), decide la bandera.
    """

    def __init__(self, pool, alias=None):
        import construir_padron as _PAD
        self.norm = _PAD.norm
        self.alias = {self.norm(a): r for a, r in (alias or {}).items()}
        self.por = {}
        for p in pool:
            if p.get('raw'):
                self.por.setdefault(self.norm(p['raw']), []).append(p)

    @staticmethod
    def _banderas(s):
        out, par = [], ''
        for ch in str(s or ''):
            c = ord(ch)
            if 0x1F1E6 <= c <= 0x1F1FF:
                par += chr(c - 0x1F1E6 + 97)
                if len(par) == 2:
                    out.append(par)
                    par = ''
        return out

    def quien(self, nombre):
        n = self.norm(nombre or '')
        if not n:
            return None
        if n in self.alias:
            n = self.norm(self.alias[n])
        c = self.por.get(n) or []
        if len(c) == 1:
            return c[0]
        ccs = self._banderas(nombre)
        m = [p for p in c if (p.get('cc') or '').lower() in ccs]
        return m[0] if len(m) == 1 else None

    def lado(self, texto):
        """Las personas de un lado de una batalla (un equipo va con comas)."""
        out = []
        for m in str(texto or '').split(','):
            p = self.quien(m.strip())
            if p:
                out.append(p['raw'])
        return out


# ── los eventos, ya masticados ───────────────────────────────────────────
def eventos(regs, inst, R):
    """Los eventos procesados en orden, con quién jugó, cómo le fue y cada batalla.

    `[{n, t, nombre, sv, part, fase:{raw: puesto}, rondas:[[(lados, ganadores, nota)]]}]`
    """
    out = []
    for n, r in regs.items():
        if not str(n).isdigit():
            continue
        ms = inst.get(int(n))
        if not ms:
            continue
        fase = {}
        for t in r.get('tabla') or []:
            if t and t[0]:
                p = R.quien(t[0])
                if p:
                    fase[p['raw']] = t[1]
        rondas = []
        for Rr in r.get('rondas') or []:
            if Rr.get('r') == 'Tercer puesto':
                continue
            bs = []
            for b in Rr.get('b') or []:
                lados = [R.lado(s) for s in (b[0] if b else [])]
                gan = set(R.lado(b[1])) if len(b) > 1 and b[1] else set()
                bs.append((lados, gan, (b[2] if len(b) > 2 else '') or ''))
            rondas.append(bs)
        out.append({'n': int(n), 't': dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc),
                    'nombre': (r.get('nombre') or '').strip('_*~ '), 'sv': r.get('sv') or '',
                    'part': int(r.get('participantes') or 0), 'fase': fase, 'rondas': rondas})
    out.sort(key=lambda e: (e['t'], e['n']))
    return out


def _jugo(ev, raw):
    return raw in ev['fase'] or any(raw in sum(l, []) for bs in ev['rondas'] for l, _g, _n in bs)


def primera_derrota(ev, raw):
    """La primera batalla que `raw` perdió en el evento: `[cazadores]`, o `None`.

    `[]` quiere decir que quedó afuera sin que nadie le ganara (una triple
    donde no pasa nadie): perdió, pero no hay a quién pagarle.

    🔑 QUIÉN LO CAZÓ (Dlx, 27/09/2026: «el punto se reparte entre los
    cazadores, o sea el equipo»): en un uno contra uno, el que ganó; por
    equipos, los del equipo que ganó; en una triple, los que pasaron a la
    ronda siguiente —la llave anota un solo ganador aunque pasen dos, así
    que el segundo se reconoce porque aparece después—.
    """
    rs = ev['rondas']
    for i, bs in enumerate(rs):
        despues = set()
        if i + 1 < len(rs):
            for l2, _g2, _n2 in rs[i + 1]:
                for lado in l2:
                    despues.update(lado)
        for lados, gan, _nota in bs:
            mio = [lado for lado in lados if raw in lado]
            if not mio:
                continue
            if raw in gan or (raw in despues):
                break          # ganó esta: pasa a la ronda siguiente
            if 'pasan 0' in _nota:
                return []      # no pasó nadie: cayó, pero no hay a quién pagarle
            if not gan and not despues:
                break          # sin resultado anotado (una final a medias): no se sabe
            otros = [lado for lado in lados if raw not in lado]
            if len(lados) == 2:
                caz = [p for lado in otros for p in lado if (p in gan or not gan)]
            else:
                caz = [p for lado in otros for p in lado
                       if (p in despues if despues else p in gan)]
            return sorted(set(caz))
    return None


# ── el período: elegir, cazar y cerrar ───────────────────────────────────
def _nivel(o):
    for hasta, m in POR_NIVEL:
        if o and o <= hasta:
            return m
    return 1.0


def valor(b, sin_caer):
    """La recompensa de un buscado después de `sin_caer` eventos sin que lo cacen."""
    v = b['base'] * min(1 + SUBE * sin_caer, TOPE_SUBE)
    return _redondear(max(RANGO[0], min(RANGO[1], v)))


def cobro(valor_, n_cazadores, o_cazador, o_buscado):
    """Lo que cobra UN cazador: su parte, por lo de abajo que venía."""
    dif = (o_cazador or 0) - (o_buscado or 0) if o_cazador and o_buscado else 0
    m = min(1 + POR_PUESTO * max(dif, 0), TOPE_PUESTO)
    return _redondear(min(RANGO[1], valor_ / max(1, n_cazadores) * m))


def cazar(buscados, evs, inicio, fin, pool_o):
    """Recorre los eventos del período y deja a cada buscado con su estado."""
    for b in buscados:
        b.update({'estado': 'suelto', 'ev': 0, 'fase': '', 'valor': valor(b, 0)})
        b.pop('caza', None)
        b.pop('paga', None)
        sin_caer = 0
        for ev in evs:
            if not (inicio <= ev['t'] < fin) or ev['part'] < MIN_PARTICIPANTES:
                continue
            if not _jugo(ev, b['n']):
                continue
            b['ev'] += 1
            f = ev['fase'].get(b['n'], '')
            if f and (not b['fase'] or _fase(f) < _fase(b['fase'])):
                b['fase'] = f
            caz = primera_derrota(ev, b['n'])
            if caz:
                v = valor(b, sin_caer)
                b['valor'] = v
                b['estado'] = 'cazado'
                b['caza'] = {'n': ev['n'], 'evento': ev['nombre'], 'sv': ev['sv'], 't': _iso(ev['t']),
                             'por': [{'n': c, 'cobra': cobro(v, len(caz), pool_o.get(c), b.get('o'))}
                                     for c in caz]}
                break
            sin_caer += 1
            b['valor'] = valor(b, sin_caer)
    return buscados


def cerrar(buscados, tipo=None):
    """El domingo (o a las 11 del día siguiente): cazado, sobrevivió o se escondió."""
    tipo = tipo or tipo_de()
    pide = SOBREVIVIR.get(tipo, 1)
    for b in buscados:
        if b['estado'] == 'cazado':
            continue
        fase_min = FASE_MINIMA_REY if b['cat'] == 'rey' else FASE_MINIMA
        if b['ev'] >= pide and b['fase'] and _fase(b['fase']) <= _fase(fase_min):
            b['estado'] = 'sobrevivio'
            b['paga'] = _redondear(b['valor'] * PAGA_SOBREVIVIR)
        else:
            b['estado'] = 'escondio'
    return buscados


def cerrar_periodo(act, evs, pool_o, temp):
    """El período, cerrado y listo para el historial.

    Se vuelve a cazar entero, por si entró una llave tarde — salvo que el
    período sea de OTRA temporada. ⚠️ Al arrancar la T1 el paso 0 del ciclo
    archiva las llaves de la prueba, y recalcular sin ellas dejaría a todos
    «escondidos»: ahí vale lo último que se calculó.
    """
    bs = act.get('buscados') or []
    if act.get('temporada', 'prueba') == temp:
        bs = cazar(bs, evs, _de_iso(act.get('desde') or act['inicio']), _de_iso(act['fin']), pool_o)
    return dict(act, buscados=cerrar(bs, act.get('tipo')))


def _stats(pool, evs, R, hasta, ventana_dias):
    """Lo que las categorías necesitan de cada uno, con lo que pasó hasta `hasta`."""
    desde = hasta - dt.timedelta(days=ventana_dias)
    st = {p['raw']: {'p': p, 'ev_t': [], 'gano_v': 0, 'fases_v': [], 'racha': 0, 'duelos': [0, 0],
                     'campeon_v': False} for p in pool if p.get('raw')}
    for ev in evs:
        if ev['t'] >= hasta:
            continue
        en_v = ev['t'] >= desde
        for raw in ev['fase']:
            if raw in st:
                st[raw]['ev_t'].append(ev['t'])
                if en_v:
                    st[raw]['fases_v'].append(ev['fase'][raw])
                    if ev['fase'][raw] == 'Campeón':
                        st[raw]['campeon_v'] = True
        for bs in ev['rondas']:
            for lados, gan, nota in bs:
                # la racha de duelos: sólo el uno contra uno de una persona por lado
                duelo = len(lados) == 2 and all(len(l) == 1 for l in lados) and 'triple' not in nota
                for lado in lados:
                    for raw in lado:
                        if raw not in st:
                            continue
                        g = raw in gan
                        if en_v and g:
                            st[raw]['gano_v'] += 1
                        if duelo:
                            st[raw]['duelos'][1] += 1
                            if g:
                                st[raw]['duelos'][0] += 1
                                st[raw]['racha'] += 1
                            else:
                                st[raw]['racha'] = 0
    return st


def elegir(pool, evs, R, inicio, excluir=(), snap=None, tipo=None, semilla=''):
    """Los buscados del período, con su categoría, el motivo y la recompensa base."""
    tipo = tipo or tipo_de(inicio)
    dias_v = 7 if tipo == 'semana' else 1
    st = _stats(pool, evs, R, inicio, dias_v)
    n_act, dias_act = ACTIVO.get(tipo, (2, 7))
    corte = inicio - dt.timedelta(days=dias_act)
    # ⚠️ FUERA DE CONCURSO NO ES BUSCADO. Ser buscado es un destacado, y los
    # destacados son de los miembros (Dlx, 27/09/2026: el número, el podio y
    # los líderes). Cazar sí puede: sus puntos cuentan igual.
    activo = {raw for raw, s in st.items()
              if sum(1 for t in s['ev_t'] if t >= corte) >= n_act and raw not in set(excluir)
              and not s['p'].get('fc')}
    elegidos, usados = [], set()

    def poner(cat, raw, motivo):
        cat = cat.split(':')[0]          # `dueno:FFA` es El Dueño de Casa de FFA
        if raw in usados or raw not in activo or len(elegidos) >= total:
            return False
        p = st[raw]['p']
        base = BASE_NIVEL[NIVEL[cat]] * _nivel(p.get('o') or p.get('pos'))
        elegidos.append({'n': raw, 'cat': cat, 'cn': NOMBRE[cat], 'motivo': motivo,
                         'nivel': NIVEL[cat], 'base': _redondear(base), 'o': p.get('o') or p.get('pos')})
        usados.add(raw)
        return True

    total = CUANTOS.get(tipo, 3)
    cands = {}

    def primero(cat, lista):
        # ⚠️ ACÁ SÓLO SE ANOTAN: quién entra lo decide el reparto por nivel
        cands[cat] = lista

    por_o = sorted((s for s in st.values()), key=lambda s: s['p'].get('o') or s['p'].get('pos') or 9999)
    # El Rey: el #1 oficial (si ya fue buscado, el siguiente)
    primero('rey', [(s['p']['raw'], '#%s de la temporada' % s['p'].get('pos'))
                    for s in por_o if not s['p'].get('fc')])
    primero('imparable', [(s['p']['raw'], '%d duelos ganados seguidos' % s['racha'])
                          for s in sorted(st.values(), key=lambda s: -s['racha']) if s['racha'] >= 3])
    ayer = 'la semana pasada' if tipo == 'semana' else 'ayer'
    primero('verdugo', [(s['p']['raw'], 'ganó %d batallas %s' % (s['gano_v'], ayer))
                        for s in sorted(st.values(), key=lambda s: -s['gano_v']) if s['gano_v'] >= 3])
    primero('coleccionista', [(s['p']['raw'], '%d podios en la temporada' % (s['p'].get('pod') or 0))
                              for s in sorted(st.values(), key=lambda s: -(s['p'].get('pod') or 0))
                              if (s['p'].get('pod') or 0) >= 2])
    muro = [s for s in st.values() if s['duelos'][1] >= 8 and s['duelos'][0] / s['duelos'][1] >= MURO_MIN]
    primero('muro', [(s['p']['raw'], '%d de %d duelos ganados' % tuple(s['duelos']))
                     for s in sorted(muro, key=lambda s: -s['duelos'][0] / s['duelos'][1])])
    # El Dueño de Casa: el mejor de cada servidor que tenga al menos tres
    svs = {}
    for s in por_o:
        sv = s['p'].get('sv') or ''
        if sv:
            svs.setdefault(sv, []).append(s)
    for sv, gente in sorted(svs.items(), key=lambda kv: -len(kv[1])):
        if len(gente) >= 3:
            primero('dueno:' + sv, [(s['p']['raw'], 'el mejor de %s' % sv) for s in gente])
    # el `#` que se lee es el oficial (`pos`), no el orden por mérito
    primero('oscuro', [(s['p']['raw'], '#%s y podio %s' % (s['p'].get('pos'), ayer))
                       for s in sorted(st.values(), key=lambda s: min([_fase(f) for f in s['fases_v']] or [99]))
                       if (s['p'].get('pos') or 0) > 30 and any(f in PODIO for f in s['fases_v'])])
    if snap:
        subio = []
        for s in st.values():
            antes, ahora = snap.get(s['p']['raw']), s['p'].get('o')
            if antes and ahora and antes - ahora >= 3 and not s['campeon_v']:
                subio.append((antes - ahora, s))
        primero('sigiloso', [(s['p']['raw'], 'subió %d puestos sin ganar un evento' % d)
                             for d, s in sorted(subio, key=lambda x: -x[0])])
    fant = []
    for s in st.values():
        ts = sorted(s['ev_t'])
        vuelta = [t for t in ts if t >= inicio - dt.timedelta(days=dias_v)]
        if vuelta and any(_fase(f) <= _fase('Cuartos') for f in s['fases_v']):
            previos = [t for t in ts if t < vuelta[0]]
            if previos and (vuelta[0] - previos[-1]).days >= 21:
                fant.append(((vuelta[0] - previos[-1]).days, s))
    primero('fantasma', [(s['p']['raw'], 'volvió después de %d días' % d)
                         for d, s in sorted(fant, key=lambda x: -x[0])])
    primero('viajero', [(s['p']['raw'], 'jugó en %d servidores' % (s['p'].get('srv') or 0))
                        for s in sorted(st.values(), key=lambda s: -(s['p'].get('srv') or 0))
                        if (s['p'].get('srv') or 0) >= 3])
    primero('veterano', [(s['p']['raw'], '%d eventos en la temporada' % (s['p'].get('ev') or 0))
                         for s in sorted(st.values(), key=lambda s: -(s['p'].get('ev') or 0))])
    nov = []
    for s in st.values():
        ts = sorted(s['ev_t'])
        if ts and ts[0] >= inicio - dt.timedelta(days=14) and len(ts) <= 4:
            fs = [_fase(f) for f in s['fases_v']] or [99]
            nov.append((sum(fs) / len(fs), s))
    primero('novato', [(s['p']['raw'], 'debutó hace %d días' % max(1, (inicio - min(s['ev_t'])).days))
                       for _f, s in sorted(nov, key=lambda x: x[0])])
    rnd = random.Random(hashlib.sha256(('mw' + semilla).encode()).hexdigest())
    # El Comodín: un sorteo entre los activos; compite en su nivel como las demás
    resto = sorted(activo)
    rnd.shuffle(resto)
    primero('comodin', [(raw, 'salió en el sorteo') for raw in resto])
    # 🔑 EL REPARTO: cada nivel, sus lugares; dentro del nivel, la categoría
    # sorteada, y de cada una el primero de su lista que esté libre
    for niveles, n in CUPOS.get(tipo, CUPOS['dia']):
        cats = sorted(c for c in cands if NIVEL[c.split(':')[0]] in niveles)
        rnd.shuffle(cats)
        puestos = 0
        for c in cats:
            if puestos >= n:
                break
            if any(poner(c, raw, motivo) for raw, motivo in cands[c]):
                puestos += 1
    # lo que un nivel no llenó (nadie cumplía), lo completa el sorteo
    for raw, motivo in cands['comodin']:
        poner('comodin', raw, motivo)
    return elegidos


def cargar_todo():
    """El pool, las llaves con su instante y los alias. Sin red."""
    import llaves_web as LW

    def _j(*p):
        try:
            with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
                return json.load(f)
        except (OSError, ValueError):
            return None
    pool = _j('datos', 'temporada_pool.json') or []
    alias = (_j('datos', 'akas.json') or {}).get('alias') or {}
    regs = LW.leer()
    R = Resolver(pool, alias)
    return pool, eventos(regs, LW.instantes(regs), R), R


def correr(ahora=None, aplicar=False):
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    tipo, temp, espera = tipo_de(ahora), temporada_de(ahora), _espera(ahora)
    pid, ini, fin = periodo(ahora, tipo)
    try:
        with io.open(SALIDA, encoding='utf-8') as f:
            viejo = json.load(f)
    except (OSError, ValueError):
        viejo = {}
    pool, evs, R = cargar_todo()
    pool_o = {p['raw']: p.get('o') or p.get('pos') for p in pool if p.get('raw')}
    hist = viejo.get('historial') or []
    act = viejo.get('actual') or {}
    # 🔑 SE CAMBIÓ DE PERÍODO, o arrancó la temporada: el anterior se cierra
    # con lo que ya se jugó y va al historial. Ver `cerrar_periodo()`.
    if act.get('id') and (espera or act['id'] != pid):
        hist = [h for h in hist if h.get('id') != act['id']]
        hist.append(cerrar_periodo(act, evs, pool_o, temp))
        hist = hist[-HISTORIAL:]
        act = {}
    if not act.get('id'):
        act = {}
    # 🔑 SI BAJÓ EL CUPO Y TODAVÍA NO CAZARON A NADIE, se vuelve a elegir: el
    # 27/09/2026 el día arrancó con 10 y Dlx pidió 3 a media mañana
    if len(act.get('buscados') or []) > CUANTOS.get(act.get('tipo'), 99) \
            and not any(b.get('caza') for b in act['buscados']):
        act['buscados'] = []
    # 🔑 LA PRIMERA SEMANA DE LA TEMPORADA NO HAY BUSCADOS: queda escrito
    # cuándo salen, y la página lo dice. Ver `_primera_semana()`.
    if espera:
        act = {'temporada': temp, 'proximo': _iso(espera)}
    # 🔑 SIN BUSCADOS SE VUELVE A ELEGIR EN CADA CORRIDA: si un período arranca
    # sin nadie activo, no se queda vacío hasta el siguiente.
    elif not act.get('buscados'):
        prev = hist[-1] if hist else {}
        # el anterior es de otra temporada (la prueba): ni su gente se excluye
        # ni sus puestos sirven para «El Sigiloso» — la tabla arrancó de cero
        misma = prev.get('temporada', 'prueba') == temp
        excluir = [b['n'] for b in prev.get('buscados') or []] if misma else []
        snap = (prev.get('snap') if misma else None) or {}
        # ⚠️ ELEGIDOS A MITAD DE PERÍODO, LA CAZA CUENTA DESDE AHÍ: un evento de
        # antes no puede cazar a quien todavía no era buscado
        desde = ini if ahora - ini < dt.timedelta(hours=2) else ahora
        buscados = elegir(pool, evs, R, desde, excluir=excluir, snap=snap, tipo=tipo, semilla=pid)
        act = {'id': pid, 'tipo': tipo, 'temporada': temp, 'inicio': _iso(ini), 'fin': _iso(fin),
               'desde': _iso(desde), 'elegido': _iso(ahora), 'buscados': buscados,
               'snap': {p['raw']: p.get('o') or p.get('pos') for p in pool if p.get('raw')}}
    if act.get('id'):
        act['buscados'] = cazar(act['buscados'], evs, _de_iso(act.get('desde') or act['inicio']), fin, pool_o)
    out = {'_leeme': 'Most Wanted: lo arma bot/most_wanted.py en el ciclo (paso 2b). '
                     'Los números viven en ese archivo.',
           'config': {'periodo': tipo, 'cuantos': CUANTOS.get(tipo), 'rango': list(RANGO),
                      'sube': SUBE, 'tope_sube': TOPE_SUBE,
                      'por_puesto': POR_PUESTO, 'tope_puesto': TOPE_PUESTO,
                      'sobrevivir': SOBREVIVIR.get(tipo, 1), 'fase': FASE_MINIMA,
                      'paga': PAGA_SOBREVIVIR},
           'actual': act, 'historial': hist}
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
    return out


# ── lo que se lee de afuera: la web y las vitrinas del Sheet ─────────────
def leer(ruta=None):
    """`datos/mw.json`, o `{}`."""
    try:
        with io.open(ruta or SALIDA, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def periodos(d):
    """Los períodos que cuentan: los de la temporada del período de ahora.

    🔴 LO DE LA FASE DE PRUEBA SE BORRA (Dlx, 25/09/2026), y el Most Wanted
    también: con la temporada, los cazadores y los puntos arrancan de cero.
    Los períodos viejos quedan en `datos/mw.json`, sin contar.
    """
    act = d.get('actual') or {}
    temp = act.get('temporada', 'prueba')
    return [p for p in (d.get('historial') or []) + ([act] if act.get('id') else [])
            if p.get('temporada', 'prueba') == temp]


def suma(d=None):
    """Lo de cada uno en la temporada: `({nombre: {pts, caz, czd, sob}}, {evento: cazas})`.

    `pts` es lo que cobró: cazando, y la mitad de su recompensa cada vez que
    sobrevivió. `cazas` son `[buscado, categoría, [cazadores]]`.

    ⚠️ UNA SOLA CUENTA PARA TODOS: la tabla de cazadores de la página, las
    columnas Cazó · Cazado · Sobrevivió, y lo que el MW suma a la Temporada
    en las vitrinas (`rankings.sumar_mw()`). Si cada uno contara por su
    lado, un día dirían números distintos.
    """
    d = leer() if d is None else d
    caz, ce = {}, {}
    nuevo = lambda: {'pts': 0, 'caz': 0, 'czd': 0, 'sob': 0}
    for per in periodos(d):
        for b in per.get('buscados') or []:
            if b.get('caza'):
                c = b['caza']
                ce.setdefault(str(c.get('n')), []).append(
                    [b['n'], b.get('cn') or '', [y['n'] for y in c.get('por') or []]])
                for y in c.get('por') or []:
                    z = caz.setdefault(y['n'], nuevo())
                    z['pts'] += y.get('cobra') or 0
                    z['caz'] += 1
                caz.setdefault(b['n'], nuevo())['czd'] += 1
            elif b.get('estado') == 'sobrevivio':
                z = caz.setdefault(b['n'], nuevo())
                z['sob'] += 1
                z['pts'] += b.get('paga') or 0
    return caz, ce


# ── self-check ───────────────────────────────────────────────────────────
def _self_check():
    print('\n══ MOST WANTED ══\n')
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    et = _et()
    # los períodos, en la hora del este de verdad
    t = dt.datetime(2026, 9, 27, 10, 30, tzinfo=et)
    pid, ini, fin = periodo(t, 'dia')
    ok(pid == '2026-09-26' and ini.astimezone(et).hour == 11,
       'a las 10:30 AM el día todavía es el de ayer (arranca 11 AM)  %s' % pid)
    pid, ini, fin = periodo(t.replace(hour=11, minute=22), 'dia')
    ok(pid == '2026-09-27' and (fin - ini).total_seconds() == 86400, 'a las 11:22 ya es el de hoy, 24 h')
    pid, ini, fin = periodo(dt.datetime(2026, 10, 14, 15, 0, tzinfo=et), 'semana')
    ok(pid == '2026-10-12' and ini.astimezone(et).weekday() == 0, 'la semana va de lunes a lunes  %s' % pid)
    pid, ini, fin = periodo(dt.datetime(2026, 11, 3, 12, 0, tzinfo=et), 'semana')
    ok(fin.astimezone(et).hour == 11, 'y cruzando el cambio de horario sigue terminando a las 11 AM ET')
    # el borde de la temporada: la prueba termina a las 00:00 del arranque, la
    # primera semana no hay buscados y el lunes siguiente arranca el semanal
    from comun.temporada import ACTUAL, FECHAS
    arr = dt.date.fromisoformat(FECHAS[ACTUAL][0])
    en = lambda d, h, m=0: dt.datetime(arr.year, arr.month, arr.day, h, m, tzinfo=et) + dt.timedelta(days=d)
    pid, ini, fin = periodo(en(-1, 20))
    ok(tipo_de(en(-1, 20)) == 'dia' and temporada_de(en(-1, 20)) == 'prueba'
       and pid == (arr - dt.timedelta(days=1)).isoformat() and fin == en(0, 0),
       'el último día de prueba (%s) termina con la prueba, a las 00:00 del arranque' % pid)
    ps = _primera_semana()
    ok(temporada_de(en(0, 0, 22)) == ACTUAL and _espera(en(0, 0, 22)) == ps and _espera(en(3, 15)) == ps,
       'desde el arranque es la %s y la primera semana no hay buscados' % ACTUAL.upper())
    pe = ps.astimezone(et)
    ok(pe.weekday() == 0 and pe.hour == 11 and (pe.date() - arr).days >= 7,
       'el primer Most Wanted sale el lunes %s a las 11 AM, con una semana jugada' % pe.date())
    pid, ini, fin = periodo(ps + dt.timedelta(minutes=22))
    ok(_espera(ps + dt.timedelta(minutes=22)) is None and tipo_de(ps) == 'semana'
       and pid == pe.date().isoformat() and (fin - ini).days == 7, 'y es semanal: %s, 7 días' % pid)

    # quién lo cazó: 1 contra 1, equipos, triples y una triple sin nadie
    class _R:  # sin padrón: cada nombre es él mismo
        def lado(self, s):
            return [m.strip() for m in str(s).split(',') if m.strip()]

    def ev_de(rondas, fase=None, part=16, t=None):
        R = _R()
        return {'n': 1, 't': t or dt.datetime(2026, 9, 27, 20, tzinfo=dt.timezone.utc), 'nombre': 'X',
                'sv': 'FFA', 'part': part, 'fase': fase or {},
                'rondas': [[([R.lado(s) for s in b[0]], set(R.lado(b[1])), b[2] if len(b) > 2 else '')
                            for b in bs] for bs in rondas]}
    e = ev_de([[[['Ana', 'Bea'], 'Bea']]])
    ok(primera_derrota(e, 'Ana') == ['Bea'], 'uno contra uno: cobra el que ganó')
    e = ev_de([[[['Ana, Cid', 'Bea, Dan'], 'Bea, Dan']]])
    ok(primera_derrota(e, 'Cid') == ['Bea', 'Dan'], 'por equipos: se reparte entre el equipo que ganó')
    e = ev_de([[[['Ana', 'Bea', 'Cid'], 'Bea', 'triple (3 bandas, pasan 2)']],
               [[['Bea', 'Eli'], 'Eli'], [['Cid', 'Fer'], 'Cid']]])
    ok(primera_derrota(e, 'Ana') == ['Bea', 'Cid'],
       'en una triple donde pasan dos, cobran los dos (el segundo, porque aparece después)')
    e = ev_de([[[['Ana', 'Bea', 'Cid'], '', 'triple (3 bandas, pasan 0)']]])
    ok(primera_derrota(e, 'Ana') == [], 'si no pasa nadie, perdió pero no hay a quién pagarle')
    e = ev_de([[[['Ana', 'Bea'], 'Ana']], [[['Ana', 'Cid'], 'Cid']]])
    ok(primera_derrota(e, 'Ana') == ['Cid'], 'cuenta la primera batalla que pierde, no la primera que juega')

    # la plata: sube por evento sin caer, vence, tope y el de abajo cobra más
    b = {'base': 8000}
    ok(valor(b, 0) == 8000 and valor(b, 1) == 9500 and valor(b, 2) == 11250,
       'la recompensa sube un 20 %% por evento sin caer  %s' % [valor(b, i) for i in range(3)])
    ok(valor({'base': 12000}, 10) == 20000, 'y nunca pasa de 20.000')
    ok(cobro(10000, 1, 40, 5) == 17000 and cobro(10000, 1, 3, 5) == 10000,
       'el que viene 35 puestos abajo cobra un 70 % más; el de arriba, lo normal')
    ok(cobro(10000, 2, 5, 5) == 5000, 'entre dos, mitad y mitad')

    # un período entero: cazado, sobrevivió y se escondió
    t0 = dt.datetime(2026, 9, 27, 15, tzinfo=dt.timezone.utc)
    bs = [{'n': 'Ana', 'cat': 'rey', 'base': 8000, 'o': 1},
          {'n': 'Bea', 'cat': 'veterano', 'base': 5000, 'o': 9},
          {'n': 'Cid', 'cat': 'novato', 'base': 4000, 'o': 30}]
    evs = [ev_de([[[['Ana', 'Dan'], 'Ana']], [[['Ana', 'Bea'], 'Ana']]],
                 {'Ana': 'Campeón', 'Bea': 'Subcampeón', 'Dan': 'Cuartos'}, t=t0 + dt.timedelta(hours=2)),
           ev_de([[[['Ana', 'Eli'], 'Eli']]], {'Ana': 'Cuartos', 'Eli': 'Campeón'},
                 t=t0 + dt.timedelta(hours=5))]
    for i, x in enumerate(evs):
        x['n'] = i + 1
    cazar(bs, evs, t0, t0 + dt.timedelta(days=1), {'Eli': 50, 'Dan': 60})
    cerrar(bs, 'dia')
    a, bea, c = bs
    ok(a['estado'] == 'cazado' and a['caza']['por'][0]['n'] == 'Eli' and a['valor'] == 9500,
       'El Rey sobrevivió un evento y cayó en el segundo: vale 9.500 y lo cobra Eli')
    ok(a['caza']['por'][0]['cobra'] == 18750,
       'Eli venía 49 puestos abajo: 9.500 × 1,98, redondeado, cobra %s' % a['caza']['por'][0]['cobra'])
    ok(bea['estado'] == 'cazado' and bea['caza']['por'][0]['n'] == 'Ana',
       'Bea perdió la final con Ana: la cazó Ana')
    ok(c['estado'] == 'escondio' and not c.get('paga'), 'Cid no jugó: se escondió y no se lleva nada')
    bs2 = [{'n': 'Dan', 'cat': 'oscuro', 'base': 5000, 'o': 60}]
    evs2 = [ev_de([[[['Dan', 'Eli'], 'Dan']], [[['Dan', 'Fer'], 'Dan']]], {'Dan': 'Campeón'},
                  t=t0 + dt.timedelta(hours=1))]
    cerrar(cazar(bs2, evs2, t0, t0 + dt.timedelta(days=1), {}), 'dia')
    ok(bs2[0]['estado'] == 'sobrevivio' and bs2[0]['paga'] == 3000,
       'Dan jugó, ganó y nadie lo cazó: sobrevivió y se lleva la mitad (%s)' % bs2[0].get('paga'))
    ok(cazar([{'n': 'Dan', 'cat': 'x', 'base': 5000, 'o': 60}],
             [ev_de([[[['Dan', 'Eli'], 'Eli']]], part=4, t=t0 + dt.timedelta(hours=1))],
             t0, t0 + dt.timedelta(days=1), {})[0]['estado'] == 'suelto',
       'un evento de menos de 8 no cuenta para cazar')
    # al arrancar la temporada, el último día de prueba se cierra con lo que tenía
    per = {'id': 'X', 'tipo': 'dia', 'temporada': 'prueba', 'inicio': _iso(t0),
           'fin': _iso(t0 + dt.timedelta(days=1)), 'buscados': [a]}
    ok(cerrar_periodo(json.loads(json.dumps(per)), [], {}, ACTUAL)['buscados'][0]['estado'] == 'cazado',
       'al arrancar la temporada, el último día de prueba guarda sus cazas (sus llaves se archivaron)')
    ok(cerrar_periodo(json.loads(json.dumps(per)), [], {}, 'prueba')['buscados'][0]['estado'] == 'escondio',
       'y dentro de la misma temporada, al cerrar se vuelve a cazar entero')

    # quién puede ser buscado: activo y miembro
    pool = [{'raw': 'Ana', 'pos': 1, 'o': 1, 'sv': 'FFA'},
            {'raw': 'Bea', 'pos': 3, 'o': 2, 'sv': 'FFA', 'fc': True},
            {'raw': 'Cid', 'pos': 2, 'o': 3, 'sv': 'FFA'}]
    evs3 = [ev_de([[[['Ana', 'Bea'], 'Bea'], [['Cid', 'Dan'], 'Cid']]],
                  {'Ana': 'Cuartos', 'Bea': 'Campeón', 'Cid': 'Semifinal'}, t=t0 - dt.timedelta(days=d))
            for d in (1, 2)]
    el = {b['n']: b['cat'] for b in elegir(pool, evs3, None, t0, tipo='dia')}
    ok('Bea' not in el and el.get('Ana') == 'rey',
       'un fuera de concurso no es buscado aunque haya ganado; el Rey es el #1 oficial  %s' % el)
    # el cupo y el reparto: 3 por día, uno de cada nivel; 9 por semana
    pool9 = [{'raw': 'P%02d' % i, 'pos': i, 'o': i, 'sv': 'FFA', 'ev': 20 - i, 'pod': 10 - i}
             for i in range(1, 16)]
    # ⚠️ con su fase: la actividad de cada uno sale de ahí (ver `_stats()`)
    evs9 = [ev_de([[[['P%02d' % i, 'P%02d' % (i + 1)], 'P%02d' % i] for i in range(1, 15, 2)]],
                  {'P%02d' % i: 'Cuartos' if i % 2 else 'Octavos' for i in range(1, 15)},
                  t=t0 - dt.timedelta(hours=h)) for h in (5, 30, 60)]
    d3 = elegir(pool9, evs9, None, t0, tipo='dia', semilla='x')
    ok(len(d3) == CUANTOS['dia'] and len({NIVEL[b['cat']] in 'CD' and 'CD' or NIVEL[b['cat']] for b in d3}) == 3,
       'por día, %d buscados, uno de cada nivel  %s' % (len(d3), [(b['n'], b['cat']) for b in d3]))
    s9 = elegir(pool9, evs9, None, t0, tipo='semana', semilla='x')
    ok(len(s9) == CUANTOS['semana'], 'por semana, %d buscados' % len(s9))
    ok(elegir(pool9, evs9, None, t0, tipo='dia', semilla='x') == d3, 'y con la misma semilla, los mismos')
    # la cuenta que leen la web y las vitrinas: sólo la temporada de ahora
    per = lambda temp, bs: {'id': temp, 'temporada': temp, 'buscados': bs}
    caza = lambda quien, por, cobra: {'n': quien, 'cn': 'El Rey', 'estado': 'cazado',
                                      'caza': {'n': 7, 'por': [{'n': por, 'cobra': cobra}]}}
    dd = {'historial': [per('prueba', [caza('Ana', 'Eli', 9000)])],
          'actual': per('t1', [caza('Bea', 'Eli', 5000),
                               {'n': 'Cid', 'estado': 'sobrevivio', 'paga': 2500}])}
    sm, ce = suma(dd)
    ok(sm.get('Eli') == {'pts': 5000, 'caz': 1, 'czd': 0, 'sob': 0} and 'Ana' not in sm
       and sm['Cid']['pts'] == 2500 and list(ce) == ['7'],
       'la cuenta de la temporada: lo de la prueba no entra, y sobrevivir también paga')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    a = sys.argv[1:]
    if '--auto' in a:
        return 1 if _self_check() else 0
    out = correr(aplicar='--aplicar' in a)
    act = out['actual']
    print('\n══ MOST WANTED · %s %s ══\n' % ('día' if act['tipo'] == 'dia' else 'semana', act['id']))
    for b in act['buscados']:
        print('   %-17s %-22s %-8s %6s  %s' % (b['cn'], b['n'][:22], b['estado'], b['valor'],
                                               b.get('motivo', '')))
        if b.get('caza'):
            print('      🎯 %s · %s' % (b['caza']['evento'][:30],
                                      ', '.join('%s %s' % (x['n'], x['cobra']) for x in b['caza']['por'])))
    print('\n   %d buscados · %d períodos en el historial' % (len(act['buscados']), len(out['historial'])))
    if '--aplicar' not in a:
        print('   (simulacro: no escribí nada — `--aplicar`)')
    print('')
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
