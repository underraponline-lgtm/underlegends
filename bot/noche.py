# -*- coding: utf-8 -*-
"""🌙 «LA NOCHE DE…»: LA IMAGEN AL PIE DEL AVISO DE GANADORES (`bot/aviso_ganadores.py`), desde el 18/11/2026.

    python bot/noche.py 649 381     dibuja esos eventos en .cache/noche/ y mide que nada se corte ni se pise
    python bot/noche.py --auto      el self-check (sin navegador ni red)

Como el puntaje de los jugadores al final de un partido. Todo se conversó con Dlx el 18/11/2026 sobre maquetas con los
280 eventos de la T1 («Sí, la simétrica»):

- 🪞 EL PODIO EN ESPEJO: el campeón en el medio; a su izquierda el subcampeón y a su derecha el MVP (si es otro) o el
  mejor tercero, del mismo tamaño; y afuera, un par de terceros, sólo en un 1v1 y si hay dos para que se espejen. Con
  equipos, cada lugar es el EQUIPO (los de la llave, `sheet/equipos.py`) con sus tarjetas en abanico.
- 🏅 DOS PREMIOS («Dos premios»): el MVP es la NOTA MÁS ALTA, siempre (la de `bot/notas.py`); y el que ganó con 35 % de
  chance o menos se lleva su propio sello, 🔥 BATACAZO. Un MVP «por calidad» dejaba a Marcos MVP con 6,6 y a Mats con 8,9.
- 📏 LAS TARJETAS CRECEN con el lugar que la tira de abajo no usa; la tira lleva una parte de las notas (la mitad hasta
  16, un cuarto con más, entre 4 y 10, dos filas como mucho) y nunca «y 1 más»: si queda uno, entra.
- 🪪 LA PERSONA, NO CÓMO LA ESCRIBIÓ LA LLAVE: el nombre de hoy (`competencias.de_hoy()`) para mostrar y buscar la
  tarjeta; su identidad (`competencias.norm()`) para el ELO. En la T1, 45 nombres de 43 eventos («g8» es Gocho).
- ARRIBA, a los costados del título: quién organiza, el host y el jurado (`datos/gente_eventos.json`), el NIVEL del
  evento en cinco estrellas (el ELO promedio al empezar, el mismo con el que la nota multiplica) y cuántos se anotaron.
- Cada caja: su nota, su ELO con cuánto ganó o perdió esa noche, los puntos, el récord y una línea de su noche (a quién
  le ganó la final, quién lo eliminó); el campeón, su título número tanto de la temporada («primer título»); y «Debut»
  a quien jugaba su primer evento.

⚠️ SIN DATO NO HAY PIEZA: sin staff, sin anotados o sin tarjeta, esa parte no se dibuja (la silueta del VS para quien
no tiene tarjeta). Y el generador no frena el aviso: si algo falla, el aviso sale sin imagen.
"""
import base64
import datetime as dt
import io
import json
import math
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path[:0] = [SCR, os.path.join(BASE, 'sheet'), BASE]

MAG = '#E41373'
ORO = '#E7B622'
#: 👑 la corona de cada tarjeta campeona (19/11/2026): tres puntas con sus perlas, en el dorado de la imagen y con un
#: borde oscuro para que se lea sobre el fondo y sobre la tarjeta
CORONA = ('<svg class="corona" viewBox="0 0 48 34" aria-hidden="true">'
          '<path d="M4 12 L14 21 L24 5 L34 21 L44 12 L40 30 L8 30 Z" fill="%s" stroke="#030304" stroke-width="2.4" '
          'stroke-linejoin="round"/>'
          '<rect x="8" y="26" width="32" height="5" fill="#C8960F" stroke="#030304" stroke-width="2"/>'
          '<circle cx="4" cy="11" r="3.4" fill="%s" stroke="#030304" stroke-width="2"/>'
          '<circle cx="24" cy="4" r="3.6" fill="%s" stroke="#030304" stroke-width="2"/>'
          '<circle cx="44" cy="11" r="3.4" fill="%s" stroke="#030304" stroke-width="2"/></svg>') % (ORO, ORO, ORO, ORO)
ORDEN_PUESTO = {'Campeón': 0, 'Subcampeón': 1, 'Tercero': 2, 'Cuarto': 3, 'Semifinal': 4, 'Cuartos': 5, 'Octavos': 6,
                'Dieciseisavos': 7}
ETQ = {'Campeón': ('🏆 Campeón', '🏆 Campeones'), 'Subcampeón': ('🥈 Subcampeón', '🥈 Subcampeones'),
       'Tercero': ('🥉 Tercero', '🥉 Terceros'), 'Cuarto': ('🎖️ Cuarto', '🎖️ Cuartos'),
       'Semifinal': ('🥉 Semifinal', '🥉 Semifinal'), 'mvp': ('⭐ MVP de la noche', '⭐ MVP de la noche')}
ESTRELLAS = ['', 'Inicial', 'Medio', 'Bueno', 'Alto', 'Élite']
#: cuánto sube el abanico de tarjetas de un equipo, para que su esquina girada no caiga debajo del sello
FAN_ARRIBA = 18

limpio = lambda n: re.sub('[\U0001F1E6-\U0001F1FF]', '', str(n or '')).strip()  # noqa: E731
_D = {}


# ── los datos ────────────────────────────────────────────────────────────────────────────────────────────────────────
def _j(nombre, defecto):
    try:
        with io.open(os.path.join(BASE, 'datos', nombre), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def cargar(eventos=None, resultados=None, llaves=None, gente=None, cartas=None):
    """Lo que hace falta, una vez por proceso. Las hojas salen de `espejo_t1` (como el resto del ciclo), por el nombre de
    su cabecera; el self-check las pasa armadas."""
    import notas as NOT
    if eventos is None or resultados is None:
        import espejo_t1 as ES

        def hoja(h):
            doc = ES.leer(h) or {}
            return [list(doc.get('cabecera') or [])] + [list(f) for f in ES.fuente(h, lector='la noche de')]
        eventos = hoja('Eventos Procesados') if eventos is None else eventos
        resultados = hoja('Resultados') if resultados is None else resultados
    ce = [str(c) for c in eventos[0]] if eventos else []
    cr = [str(c) for c in resultados[0]] if resultados else []
    ix = lambda cab, k: cab.index(k) if k in cab else None    # noqa: E731
    e0 = {k: ix(ce, k) for k in ('#', 'Evento', 'Servidor', 'Fecha')}
    r0 = {k: ix(cr, k) for k in ('Evento #', 'Rapero', 'País', 'Posición', 'Puntos')}
    val = lambda f, i: str((f[i] or '') if i is not None and i < len(f) else '').strip()  # noqa: E731
    EV = {}
    for f in eventos[1:]:
        n = val(f, e0['#'])
        if n:
            EV[n] = {'nombre': val(f, e0['Evento']), 'sv': val(f, e0['Servidor']).upper(), 'fecha': val(f, e0['Fecha'])}
    RES = {}
    for f in resultados[1:]:
        n = val(f, r0['Evento #'])
        if n and val(f, r0['Rapero']):
            RES.setdefault(n, []).append({'n': val(f, r0['Rapero']), 'cc': val(f, r0['País']).lower(),
                                          'pos': val(f, r0['Posición']), 'pts': val(f, r0['Puntos'])})
    LL = _j('llaves_t1.json', {}) if llaves is None else llaves
    _D.clear()
    _D.update({'EV': EV, 'RES': RES, 'LL': LL, 'GENTE': _j('gente_eventos.json', {}) if gente is None else gente,
               'INV': _j('cartas_r2.json', {}) if cartas is None else cartas,
               'FZ': NOT.fuerzas(LL), 'VOT': NOT.indice_votos(), 'cartas': {}, 'cruces': None})
    return _D


def _d():
    return _D if _D else cargar()


# ── lo chico ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def b64(data, tipo):
    return 'data:%s;base64,%s' % (tipo, base64.b64encode(data).decode())


def fl(cc):
    from comun import banderas as BAN
    cc = str(cc or '').lower()
    if len(cc) != 2 or not cc.isalpha():
        return ''
    try:
        u = BAN.src(cc)
    except Exception:                                    # noqa: BLE001
        u = ''
    return '<img class="fl" src="%s" alt="">' % u if u else ''


def color(v):
    return '#29B298' if v >= 8.5 else '#5CC46B' if v >= 7 else ORO if v >= 6 else '#F07A2B' if v >= 5 else '#E5484D'


def nota_txt(v):
    return ('%.1f' % v).replace('.', ',')


def miles(n):
    return '{:,}'.format(int(round(n))).replace(',', '.')


def cuantos(n):
    """Cuántas notas van en la tira: la mitad hasta 16, un cuarto con más; entre 4 y 10."""
    return max(4, min(10, math.ceil(n / 2) if n <= 16 else math.ceil(n / 4)))


def titulo_n(k):
    """🏆 «primer título», «2.º título», «3.er título»…"""
    return 'primer título' if k == 1 else '%d.%s título' % (k, 'er' if k == 3 else 'º')


def sin_nivel(r):
    """La razón de la nota sin el «· evento ×1.11» (el nivel ya va en las estrellas)."""
    return re.sub(r'\s*·\s*evento ×[\d.]+', '', str(r or ''))


def clave(nombre):
    """La clave de esa persona en R2, en KV y en la web (`comun/claves.py`), con su nombre de HOY."""
    import competencias as CO
    from comun.claves import clave as _c
    return _c(CO.de_hoy(limpio(nombre)))


def carta(nombre, sv):
    """La tarjeta de esa persona (la de ese servidor, la de Servidor o la de Temporada), embebida; '' si no tiene. Sale
    del inventario de R2 (`datos/cartas_r2.json`), no de probar URLs."""
    D = _d()
    k = clave(nombre)
    if (k, sv) in D['cartas']:
        return D['cartas'][(k, sv)]
    urls = D['INV'].get(k) or {}
    out = ''
    for c in ('sv-%s' % sv.lower(), 'servidor', 'temporada'):
        if urls.get(c):
            try:
                import requests
                r = requests.get(urls[c], timeout=20)
                if r.status_code == 200:
                    out = b64(r.content, 'image/webp')
                    break
            except Exception:                            # noqa: BLE001
                continue
    D['cartas'][(k, sv)] = out
    return out


def tiene_carta(nombre):
    urls = _d()['INV'].get(clave(nombre)) or {}
    return any(k == 'servidor' or k == 'temporada' or k.startswith('sv-') for k in urls)


# ── lo que pasó esa noche ────────────────────────────────────────────────────────────────────────────────────────────
def elo_noche(ev):
    """`{identidad: (antes, después)}` de los que jugaron 1v1 en ese evento (`bot/elo.py`, recorrido en orden).

    🪨 DESDE LA T2, EL ELO DE TEMPORADA (Dlx, 20/11/2026: «Sí, el de temporada»): lo que tenía cada uno al empezar esa
    noche y al cerrarla, con lo de la noche adentro —es lo que mueve su piedra—, de todos los que pelearon. Se calcula
    una vez por corrida para todas las noches (`elo_temporada.calcular(…, por_evento=True)`)."""
    import competencias as CO
    import elo as E
    import elo_temporada as ET
    D = _d()
    if ET.prendido():
        if D.get('temporada') is None:
            todas = dict(ET.todas_las_llaves())
            todas.update(D['LL'] or {})
            D['temporada'] = ET.calcular(todas, desde=ET.inicio(), arranque=ET.arranque(), fz=D.get('FZ'),
                                         votos=D.get('VOT'), por_evento=True)['por_evento']
        return dict(D['temporada'].get(str(ev)) or {})
    if D['cruces'] is None:
        D['cruces'] = CO.cruces(D['LL'], dt.datetime(2000, 1, 1, tzinfo=dt.timezone.utc),
                                dt.datetime(2100, 1, 1, tzinfo=dt.timezone.utc))
    elo, antes, despues = {}, {}, {}
    for c in D['cruces']:
        g, p, e = c[0], c[1], str(c[2])
        eg, ep = elo.get(g, E.INI), elo.get(p, E.INI)
        if e == ev:
            antes.setdefault(g, eg)
            antes.setdefault(p, ep)
        d = E.K * (1 - E.esperado(eg, ep))
        elo[g], elo[p] = eg + d, ep - d
        if e == ev:
            despues[g], despues[p] = elo[g], elo[p]
    return {k: (antes[k], despues[k]) for k in despues}


def notas_de(ev):
    """`({clave: nota}, {clave: [(razón, delta)]}, clave del MVP, batacazo, {clave: nombre})`: las de `bot/notas.py`,
    calculadas acá con el mismo código. El batacazo: `(clave, razón, delta)` del 🔥 más grande, o None. Los nombres son
    los de TODOS los que tienen nota, figuren o no en Resultados (IRLANDA #533: Dynoco, el MVP, no figura)."""
    import notas as NOT
    from construir_padron import norm
    D = _d()
    out, mvp = NOT.nota_evento(D['LL'].get(ev) or {}, D['FZ'].get(str(ev)), D['VOT'])
    k = lambda n: norm(limpio(n))                         # noqa: E731
    notas = {k(n): v['nota'] for n, v in out.items()}
    por = {k(n): v['por'] for n, v in out.items()}
    # 🔥 el batacazo, con el umbral de `bot/notas.py` (PISO_BATACAZO): el mismo que marca la llave de la página
    b = NOT.batacazo(out)
    bat = (k(b[0]), b[1], b[2]) if b else None
    return notas, por, k(mvp) if mvp else '', bat, {k(n): limpio(n) for n in out}


def unidades(ev, notas, nombres=None):
    """Los que jugaron, en UNIDADES: una persona en un 1v1, un equipo en un evento por equipos.
    `([{gente: [(nombre de hoy, cc)], claves, ids, pos, nota}], por_equipos)`."""
    import competencias as CO
    import equipos as EQ
    from construir_padron import norm
    D = _d()
    gente = {norm(limpio(f['n'])): (limpio(f['n']), f['cc'], f['pos']) for f in D['RES'].get(ev, [])}
    # ⚠️ quien tiene nota y NO está en Resultados (IRLANDA #533: Dynoco ganó tres batallas y no figura) entra igual
    for n0, nom in (nombres or {}).items():
        if n0 and n0 not in gente:
            gente[n0] = (nom, '', '')
    equipo_de = {}
    for R in (D['LL'].get(ev) or {}).get('rondas', []):
        for b in R.get('b', []):
            for lado in b[0] or []:
                ns = [norm(limpio(x)) for x in EQ.integrantes(lado)[0]]
                if len(ns) > 1:
                    for x in ns:
                        equipo_de[x] = tuple(ns)
    camps = [k for k, (_n, _c, p) in gente.items() if p == 'Campeón']
    por_equipos = len(camps) > 1 or any(len(t) > 1 for t in equipo_de.values())
    us, vistos = [], set()
    for k, (n, cc, pos) in sorted(gente.items(), key=lambda x: ORDEN_PUESTO.get(x[1][2], 9)):
        if k in vistos:
            continue
        grupo = [k]
        if por_equipos and k in equipo_de:
            grupo = [x for x in equipo_de[k] if x in gente and gente[x][2] == pos] or [k]
        if por_equipos and len(grupo) == 1 and pos == 'Campeón' and len(camps) > 1:
            grupo = camps
        vistos.update(grupo)
        us.append({'gente': [(limpio(CO.de_hoy(gente[x][0])), gente[x][1]) for x in grupo], 'claves': grupo, 'pos': pos,
                   'crudos': [gente[x][0] for x in grupo], 'ids': [CO.norm(gente[x][0]) for x in grupo],
                   'nota': max(notas.get(x, 0) for x in grupo)})
    return us, por_equipos


def podio(us, k_mvp):
    """🪞 `[(tipo, unidad, rol)]` en el orden en que se ven: rol 'c' (centro), 'i' (al lado) u 'o' (afuera)."""
    camp = next((u for u in us if u['pos'] == 'Campeón'), None)
    sub = next((u for u in us if u['pos'] == 'Subcampeón'), None)
    mvp = next((u for u in us if k_mvp and k_mvp in u['claves']), None)
    terceros = sorted([u for u in us if u['pos'] in ('Tercero', 'Cuarto', 'Semifinal') and u is not mvp],
                      key=lambda u: (ORDEN_PUESTO[u['pos']], -u['nota']))
    if mvp is not None and mvp is not camp and mvp is not sub:
        der = ('mvp', mvp)
    elif terceros:
        der = (terceros[0]['pos'], terceros[0])
        terceros = terceros[1:]
    else:
        der = None
    tam = max([len(u['gente']) for u in (camp, sub) if u] or [1])
    fila = []
    afuera = tam == 1 and len(terceros) >= 2
    if afuera:
        fila.append((terceros[0]['pos'], terceros[0], 'o'))
    if sub:
        fila.append(('Subcampeón', sub, 'i'))
    if camp:
        fila.append(('Campeón', camp, 'c'))
    if der:
        fila.append((der[0], der[1], 'i'))
    if afuera:
        fila.append((terceros[1]['pos'], terceros[1], 'o'))
    return fila, mvp if mvp is not None else camp


def cabecera(ev):
    """Los costados del título: quién organiza, host, DJ y jurado (cada persona con todos sus papeles en una línea),
    cuántos se anotaron y el NIVEL del evento en cinco estrellas."""
    import notas as NOT
    D = _d()
    g = D['GENTE'].get(str(ev)) or {}
    st = g.get('staff') or {}
    nombres = lambda xs: [re.sub(r'^[\s:·\-]+', '', str(x.get('n') or '')).strip() for x in xs or [] if x.get('n')]  # noqa: E731
    org, jur, host, dj = nombres(st.get('org')), nombres(st.get('jurado')), nombres(st.get('host')), nombres(st.get('dj'))
    if not jur:
        for j in g.get('jur') or []:
            for n in j.get('l') or []:
                if n not in jur:
                    jur.append(n)
    roles = {}
    for papel, xs in (('org', org), ('host', host), ('dj', dj), ('jur', jur)):
        for x in xs:
            roles.setdefault(x, [])
            if papel not in roles[x]:
                roles[x].append(papel)
    VERBO = {'org': 'Organiza', 'host': 'Host', 'dj': 'DJ', 'jur': 'Jurado'}
    grupos = {}
    for x, ps in roles.items():
        grupos.setdefault(tuple(ps), []).append(x)
    papeles = [(' · '.join(VERBO[q] for q in ps), xs[:3])
               for ps, xs in sorted(grupos.items(), key=lambda g: (['org', 'host', 'dj', 'jur'].index(g[0][0]), -len(g[0])))]
    nivel = (D['FZ'].get(str(ev)) or {}).get('nivel')
    estrellas = 0
    if nivel:
        m = NOT._mult_nivel(nivel)
        estrellas = 1 if m < 0.85 else 2 if m < 0.95 else 3 if m < 1.05 else 4 if m < 1.15 else 5
    return {'papeles': papeles[:3], 'ins': len(g.get('ins') or []), 'nivel': nivel, 'estrellas': estrellas}


def noche_de(ev):
    """`{clave: {'g': ganó, 'p': perdió, 'final': rival de la final, 'cae': (quién lo eliminó, ronda)}}` de la llave."""
    import equipos as EQ
    from construir_padron import norm
    out = {}
    for R in (_d()['LL'].get(ev) or {}).get('rondas') or []:
        for b in R.get('b') or []:
            try:
                lados, gana = b[0] or [], str(b[1] or '')
            except (IndexError, TypeError):
                continue
            lados = [x for x in lados if x]
            if len(lados) < 2 or not gana:
                continue
            ganadores = {norm(limpio(x)) for x in re.split(r'\s*[,+&]\s*', gana) if x.strip()}
            for lado in lados:
                ks = [norm(limpio(x)) for x in EQ.integrantes(lado)[0]]
                gano = any(k in ganadores for k in ks)
                rivales = [x for x in lados if x is not lado]
                for k in ks:
                    e = out.setdefault(k, {'g': 0, 'p': 0, 'final': '', 'cae': None})
                    if gano:
                        e['g'] += 1
                        if re.match(r'(?i)final$', str(R.get('r') or '')):
                            e['final'] = rivales[0] if len(rivales) == 1 else ''
                    else:
                        e['p'] += 1
                        gan_l = [x for x in lados if any(norm(limpio(y)) in ganadores for y in EQ.integrantes(x)[0])]
                        e['cae'] = (gan_l[0] if gan_l else gana, str(R.get('r') or ''))
    return out


def titulos(ev, ident):
    """🏆 Cuántos títulos de la temporada lleva `ident` (`competencias.norm`) contando el de `ev`, por fecha y número."""
    import competencias as CO
    D = _d()
    if 'tit' not in D:
        D['tit'] = {}
        for e, filas in D['RES'].items():
            dia = str((D['LL'].get(e) or {}).get('dia') or '')
            for f in filas:
                if f['pos'] == 'Campeón':
                    D['tit'].setdefault(CO.norm(f['n']), []).append((dia, int(e) if str(e).isdigit() else 0))
    yo = (str((D['LL'].get(ev) or {}).get('dia') or ''), int(ev) if str(ev).isdigit() else 0)
    return sum(1 for x in D['tit'].get(ident, []) if x <= yo)


def debuta(ev):
    """Las claves de quienes jugaron su PRIMER evento de la temporada en `ev`."""
    from construir_padron import norm
    D = _d()
    if 'prim' not in D:
        D['prim'] = {}
        for e, filas in D['RES'].items():
            for f in filas:
                k = norm(limpio(f['n']))
                if k and str(e).isdigit() and (k not in D['prim'] or int(e) < int(D['prim'][k])):
                    D['prim'][k] = e
    return {k for k, e in D['prim'].items() if e == str(ev)}


# ── la imagen ────────────────────────────────────────────────────────────────────────────────────────────────────────
def html(ev):
    import competencias as CO
    import equipos as EQ
    import kit as K
    from construir_padron import norm
    D = _d()
    ev = str(ev)
    r = D['EV'][ev]
    sv = r['sv']
    d = K._sv_datos(sv)
    ca = K.camiseta(d)
    notas, por_razon, k_mvp, bat, nombres = notas_de(ev)
    us, por_eq = unidades(ev, notas, nombres)
    su_noche = noche_de(ev)
    PTS = {norm(limpio(f['n'])): float(f['pts']) for f in D['RES'].get(ev, []) if re.match(r'^\d+(\.\d+)?$', f['pts'])}
    nuevos = debuta(ev)
    fila, mvp_u = podio(us, k_mvp)
    orden = [(t, u) for t, u, _r in fila]
    roles = [x for _t, _u, x in fila]
    usados = [u for _t, u in orden]
    elos = elo_noche(ev)
    camp_u = next((u for u in us if u['pos'] == 'Campeón'), None)
    eq_final = bool(camp_u and len(camp_u['gente']) > 1)
    jugaron = sum(len(u['gente']) for u in us)
    es_bat = lambda u: bool(bat and bat[0] in u['claves'])  # noqa: E731
    es_nuevo = lambda u: all(k in nuevos for k in u['claves'])  # noqa: E731

    def eloh(u):
        if len(u['claves']) != 1 or u['ids'][0] not in elos:
            return '<span class="et cada">cada uno</span>' if len(u['gente']) > 1 else ''
        a, b = elos[u['ids'][0]]
        dl = round(b - a)
        sig = ('▲ +%d' % dl) if dl > 0 else ('▼ %d' % dl) if dl < 0 else '='
        return '<span class="elo">ELO <b>%s</b> <i class="%s">%s</i></span>' % (
            miles(b), 'sube' if dl > 0 else 'baja' if dl < 0 else '', sig)

    def cartas(u, alto, sube=False, corona=False):
        gs = u['gente'][:3]
        m = len(gs)
        giro = {1: [0], 2: [-4, 4], 3: [-6, 0, 6]}[m]
        # encimadas lo justo para que se lea el nombre de cada una
        paso = int(alto * 0.72 * (0.30 if m == 2 else 0.36 if m == 3 else 0))
        out = []
        for i, (n, cc) in enumerate(gs):
            st = 'height:%dpx;%stransform:rotate(%ddeg);z-index:%d' % (
                alto, 'margin-left:-%dpx;' % paso if i else '', giro[i], 5 - abs(i - (m - 1) / 2) * 2)
            c = carta(n, sv)
            # 👑 LOS CAMPEONES, CON SU CORONA (Dlx, 19/11/2026: «me gusta ese, quizás pon como unas coronitas a los
            # campeones»). Una por tarjeta, sobre su borde de arriba y girada con ella: la tarjeta va adentro de una caja
            # que lleva el giro (`.ctw`), y la corona es un dibujo y no un emoji, así sale igual en cualquier máquina
            if corona:
                ancho = 'width:%dpx' % int(alto * 300 / 440) if not c else ''
                if c:
                    adentro = '<img class="ct" src="%s" alt="">' % c
                else:
                    band = ''.join(chr(0x1F1E6 + ord(ch) - 97) for ch in str(cc or '').lower()) if len(str(cc or '')) == 2 else ''
                    adentro = '<div class="ct sinc">%s</div>' % K._carta_sin({'n': n, 'fl': band}, d, 'sin', alto / 440)
                out.append('<span class="ctw" style="%s%s">%s%s</span>' % (st, ';' + ancho if ancho else '', adentro, CORONA))
            elif c:
                out.append('<img class="ct" src="%s" alt="" style="%s">' % (c, st))
            else:
                # la silueta del VS: la caja de 300×440 escalada al alto
                band = ''.join(chr(0x1F1E6 + ord(ch) - 97) for ch in str(cc or '').lower()) if len(str(cc or '')) == 2 else ''
                out.append('<div class="ct sinc" style="%s;width:%dpx">%s</div>'
                           % (st, int(alto * 300 / 440), K._carta_sin({'n': n, 'fl': band}, d, 'sin', alto / 440)))
        mas = len(u['gente']) - m
        return '<div class="cartas%s">%s%s</div>' % (' sube' if sube else '', ''.join(out),
                                                    '<span class="mas-n">+%d</span>' % mas if mas > 0 else '')

    titulo = re.sub(r'^[\s_*~|`\-]+|[\s_*~|`\-]+$', '', r['nombre'])
    if not titulo or titulo.startswith('('):
        titulo = 'El evento de ' + d['nombre']
    # 🔤 EL TÍTULO: una línea si entra a 26 px o más; si no, dos líneas a lo que entre en el doble de ancho
    px1 = K._px_nombre(titulo.upper(), 600, 38, 12)
    tam_tit = '%dpx' % px1 if px1 >= 26 else '%dpx;white-space:normal;text-wrap:balance;line-height:1.02;max-height:2.1em' % (
        max(18, min(26, K._px_nombre(titulo.upper(), 1150, 26, 12))))
    dos_lineas = 'white-space:normal' in tam_tit
    cinco = len(orden) == 5

    # 🔥 el del batacazo se ve siempre; «y 1 más» no se escribe
    resto = sorted([u for u in us if all(u is not x for x in usados)], key=lambda u: (-u['nota'], u['gente'][0][0].lower()))
    n = cuantos(len(us))
    n = len(resto) if len(resto) - n == 1 else n
    _b = next((u for u in resto if es_bat(u)), None)
    if _b is not None and all(_b is not x for x in resto[:n]) and n:
        resto.remove(_b)
        resto.insert(n - 1, _b)
    largo = lambda xs: max([len(' + '.join(x for x, _c in u['gente'])) for u in xs] or [0])  # noqa: E731
    _lt = largo(resto[:n])
    # 🧱 DOS FILAS COMO MUCHO (con equipos de nombres largos son dos columnas)
    n = min(n, (2 if por_eq and _lt > 24 else 3 if por_eq else 5) * 2)
    k_t = len(resto[:n])
    largo_t = largo(resto[:n])
    cols = (min(k_t, 4) if k_t <= 4 else math.ceil(k_t / 2)) if por_eq else (k_t if k_t <= 5 else math.ceil(k_t / 2))
    if por_eq and any(len(u['gente']) > 1 for u in resto[:n]):
        cols = min(cols, 2 if largo_t > 24 else 3)
    colw = 470 if por_eq and largo_t > 24 else 300 if por_eq else 200
    # 📐 LO QUE LA TIRA NO USA, PARA LAS TARJETAS: cada fila que falta son 46 px más de podio
    filas_tira = 0 if k_t == 0 else 1 if k_t <= max(1, cols) else 2
    libre = min(60, (2 - filas_tira) * 46)
    ANCHO = {'c': 262 if cinco else 390, 'i': 216 if cinco else 330, 'o': 186}
    tope_c = (272 if not dos_lineas else 252) + libre
    ALTO = {'c': tope_c, 'i': int(tope_c * 0.87), 'o': int(tope_c * 0.70)}

    def nombre_lado(lado):
        # 📏 la frase va en un renglón: un equipo de más de dos es «Corvo y 4 más» y un nombre larguísimo se corta (en la
        # T1: «perdieron la final con Corvo + Panchok + Masino + Lord Viruzz + Liberia», y un nombre de 46 letras)
        corto = lambda n: n if len(n) <= 24 else n[:23].rstrip() + '…'  # noqa: E731
        xs = [corto(limpio(CO.de_hoy(limpio(x)))) for x in EQ.integrantes(lado)[0]]
        return ' + '.join(xs) if len(xs) <= 2 else '%s y %d más' % (xs[0], len(xs) - 1)

    def lugar(t, u, rol):
        m = min(3, len(u['gente']))
        factor = 0.72 * (1 + (m - 1) * (1 - (0.30 if m == 2 else 0.36 if m == 3 else 0)))
        # 🪭 un abanico va 18 px más arriba (`.cartas.sube`): girada, la tarjeta de la punta bajaba una esquina justo donde
        # va el sello (medido: 21 de 280 eventos, todos de equipos de tres). Y en un podio de cinco, la caja que lleva un
        # sello: es angosta y la tarjeta casi la llena (el Batacazo de .SosaATR en la #581)
        sube = m > 1 or (cinco and (u is mvp_u or es_bat(u)))
        alto = int(min(ALTO[rol] - (FAN_ARRIBA if sube else 0), (ANCHO[rol] - 10) / factor))
        estilo = ' style="width:%dpx;flex:none"' % ANCHO[rol]
        varios = len(u['gente']) > 1
        etq = ETQ.get(t, (t, t))[1 if varios else 0]
        if u['pos'] == 'Campeón':
            nt = {titulos(ev, i) for i in u['ids']}
            if len(nt) == 1 and min(nt) > 0:
                etq += ' · ' + titulo_n(min(nt))
        if t == 'mvp' and u['pos'] and u['pos'] not in ('Campeón', 'Subcampeón'):
            etq = '⭐ MVP · ' + u['pos']
        nombres = ' + '.join('%s%s' % (K._e(x), fl(cc)) for x, cc in u['gente'])
        crudo = ' + '.join(x for x, _c in u['gente'])
        clase = {'Campeón': 'camp', 'mvp': 'mvp'}.get(t, 'otro')
        sello = '<span class="sello">⭐ MVP</span>' if u is mvp_u and t != 'mvp' else ''
        # 🔥 el sello del batacazo, a la derecha de SU caja como el de MVP (a la izquierda chocaba con el MVP de la caja de
        # al lado). Si la misma caja ya lleva el de MVP, no entra un segundo sello sin tocar la tarjeta (a la izquierda
        # tapaba «Campeón · …»; al lado del MVP, la punta de la tarjeta): lo dice su línea, «🔥 Batacazo · le ganó…»
        bat_en_linea = es_bat(u) and bool(sello)
        if es_bat(u) and not bat_en_linea:
            sello += '<span class="sello bat-s">🔥 Batacazo</span>'
        ancho_caja = ANCHO[rol] - 22
        if varios:
            tam_nom = max(12, min(20, K._px_nombre(crudo.upper(), ancho_caja * 1.9, 20, 12)))
            est_nom = 'font-size:%dpx;white-space:normal;line-height:1.12;max-height:2.3em;overflow:hidden' % tam_nom
        else:
            base = 25 if t in ('Campeón', 'mvp') else 21 if rol != 'o' else 17
            est_nom = 'font-size:%dpx;white-space:nowrap' % max(12, K._px_nombre(crudo.upper(), ancho_caja - 26, base, 12))
        # 📖 SU NOCHE: a quién le ganó la final o quién lo eliminó (el del batacazo, su batacazo)
        nn = su_noche.get(u['claves'][0]) or {}
        if u['pos'] == 'Campeón':
            linea = ' · '.join((['invictos toda la noche' if varios else 'invicto toda la noche'] if nn and not nn.get('p') else [])
                               + (['le %s la final a %s' % ('ganaron' if varios else 'ganó', nombre_lado(nn['final']))]
                                  if nn.get('final') else []))
        elif u['pos'] == 'Subcampeón' and nn.get('cae'):
            linea = '%s la final con %s' % ('perdieron' if varios else 'perdió', nombre_lado(nn['cae'][0]))
        elif nn.get('cae'):
            linea = '%s %s' % ('los eliminó' if varios else 'lo eliminó', nombre_lado(nn['cae'][0])) + (
                '' if rol == 'o' else ' en %s' % nn['cae'][1].lower())
        else:
            linea = ''
        if es_bat(u):
            extra = '<span class="porque bat">🔥 %s%s</span>' % ('<b>Batacazo</b> · ' if bat_en_linea else '',
                                                               K._e(re.sub(r'^🔥\s*', '', sin_nivel(bat[1]))))
        elif linea:
            extra = '<span class="noche">%s</span>' % K._e(linea)
        else:
            extra = ''
        # 🧾 los puntos de esa noche y su récord
        pts_u = max([PTS.get(k, 0) for k in u['claves']] or [0])
        mini = ' · '.join(x for x in (('+%s pts%s' % (miles(pts_u), ' c/u' if varios else '')) if pts_u else '',
                                       ('%d–%d' % (nn.get('g', 0), nn.get('p', 0))) if nn else '') if x)
        mini = '<span class="mini">%s</span>' % mini if mini and rol != 'o' else ''
        debut_c = '<span class="debut-c">Debut</span>' if es_nuevo(u) else ''
        chip = '<span class="chip" style="background:%s">%s</span>' % (color(u['nota']), nota_txt(u['nota'])) if u['nota'] else ''
        return ''.join([
            '<div class="col %s rol-%s"%s>' % (clase, rol, estilo),
            cartas(u, alto, sube, corona=u['pos'] == 'Campeón').replace('">', '">' + debut_c, 1),
            '<div class="plato"><span class="et pos">%s</span>' % etq,
            '<b class="nom%s" style="%s">%s</b>' % (' largo' if len(nombres) > 60 or len(u['gente']) > 2 else '', est_nom, nombres),
            '<div class="dat">%s%s%s</div>%s%s</div></div>' % (chip, eloh(u), mini, extra, sello)])

    def ficha(txt):
        px = K._px_nombre(txt.upper(), colw - 90, 15, 10) + 1
        # `_px_nombre` no baja de su piso: con un nombre muy largo devuelve el piso aunque no entre. Se mira el largo
        entra = len(txt) * 0.62 * 11 <= colw - 70
        return 'font-size:%dpx' % min(15, px) if px >= 11 and entra else \
            'font-size:11.5px;white-space:normal;line-height:1.05;max-height:2.2em;overflow:hidden'

    def marcas(u):
        # 🏷️ «Debut» y 🔥 van ADENTRO del cuadro, chiquitos y arriba del nombre
        m = ('<i class="mk bat">🔥 Batacazo</i>' if es_bat(u) else '') + ('<i class="mk">Debut</i>' if es_nuevo(u) else '')
        return '<span class="mks">%s</span>' % m if m else ''
    tira = ''.join('<span class="t"><span class="nm">%s<b style="%s">%s</b></span><span class="chip" style="background:%s">%s</span></span>'
                   % (marcas(u), ficha(' + '.join(x for x, _c in u['gente'])),
                      ' + '.join('%s%s' % (K._e(x), fl(c)) for x, c in u['gente']), color(u['nota']), nota_txt(u['nota']))
                   for u in resto[:n])
    mas = sum(len(u['gente']) for u in resto[n:])
    fondo_jpg = os.path.join(SCR, 'vs_fondos', sv.lower() + '.jpg')
    fondo = ('<div class="fondo" style="background-image:url(%s)"></div>' % b64(open(fondo_jpg, 'rb').read(), 'image/jpeg')
             if os.path.exists(fondo_jpg) else '<div class="cami"></div><div class="cami-capa"></div>')
    sub = '%s · %s%s · notas del 1 al 10' % (d['nombre'], r['fecha'],
                                             (' · %d raperos en %d equipos' % (jugaron, len(us))) if eq_final else '')
    ul = b64(open(os.path.join(SCR, 'paginas', 'ul-blanco.png'), 'rb').read(), 'image/png')
    cab = cabecera(ev)
    izq = ['<div class="dato"><span class="et">%s</span><b>%s</b></div>' % (K._e(t), K._e(' · '.join(xs))) for t, xs in cab['papeles']]
    der = []
    if cab['estrellas']:
        der.append('<div class="dato der"><span class="et">Nivel del evento</span><b class="est"><u>%s</u> %s<i>%s</i></b>'
                   '<small>ELO promedio %s</small></div>' % (ESTRELLAS[cab['estrellas']], '★' * cab['estrellas'],
                                                             '★' * (5 - cab['estrellas']), miles(cab['nivel'])))
    if cab['ins']:
        der.append('<div class="dato der"><span class="et">Se anotaron</span><b>%d</b><small>jugaron %d</small></div>' % (cab['ins'], jugaron))
    # ⚖️ si un costado queda vacío, se reparte
    if not izq and len(der) == 2:
        izq, der = [der[0].replace('dato der', 'dato')], der[1:]
    lados = '<div class="lado-i">%s</div><div class="lado-d">%s</div>' % (''.join(izq), ''.join(der))
    css = (K._fuentes() + K._css_suelo(ca) + CSS.replace('MAG', MAG).replace('ORO', ORO).replace('COLS', str(max(1, cols)))
           .replace('COLW', str(colw)).replace('FAN', str(FAN_ARRIBA)) + '#c .podio{height:%dpx}' % (418 + libre))
    return ''.join([
        '<!doctype html><meta charset="utf-8"><style>%s</style><div id="c" class="f">%s<div class="velo"></div>' % (css, fondo),
        '<div class="tit"><span class="et">La noche de</span><h1 style="font-size:%s">%s</h1><p>%s</p></div>' % (tam_tit, K._e(titulo), K._e(sub)),
        lados, '<div class="podio">%s</div>' % ''.join(lugar(t, u, x) for (t, u), x in zip(orden, roles)),
        '<div class="tira">%s</div>' % tira,
        '<div class="mas et">y %d más · todas las notas, en «La llave»</div>' % mas if mas > 0 else '',
        '<span class="t1">T1</span><img class="ul" src="%s" alt=""></div>' % ul])


CSS = """
body{margin:0;width:1200px;height:675px;overflow:hidden;background:#030304}
#c{font-family:Archivo,LigaEmoji,sans-serif}
#c .fondo{position:absolute;inset:0;background-size:cover;background-position:center}
#c .velo{position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,3,4,.6),rgba(3,3,4,.25) 35%,rgba(3,3,4,.55) 70%,rgba(3,3,4,.9))}
#c .et{font-family:'Barlow Condensed',Archivo,sans-serif;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
#c img.fl{display:inline-block;height:.72em;width:auto;vertical-align:baseline;margin-left:.3em;border-radius:1px;box-shadow:0 0 0 1px rgba(0,0,0,.4)}
#c .chip{display:inline-grid;place-items:center;min-width:44px;height:28px;padding:0 7px;font:900 17px/1 Archivo,sans-serif;color:#030304;border-radius:3px;flex:none}
#c .tit{position:absolute;left:300px;right:300px;top:16px;text-align:center;z-index:40}
#c .tit .et{display:inline-block;background:MAG;color:#fff;font-size:16px;padding:5px 10px}
#c .tit h1{margin:6px 0 0;font:900 38px/1 Archivo,sans-serif;font-stretch:115%;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#c .tit p{margin:5px 0 0;font:600 13px/1 Archivo,sans-serif;color:#D5D5D8}
#c .lado-i,#c .lado-d{position:absolute;top:18px;width:250px;display:flex;flex-direction:column;gap:8px;z-index:40}
#c .lado-i{left:28px;align-items:flex-start}
#c .lado-d{right:28px;align-items:flex-end;text-align:right}
#c .dato{display:flex;flex-direction:column;gap:2px;padding:6px 10px;background:rgba(3,3,4,.72);border-left:3px solid MAG;max-width:250px}
#c .dato.der{border-left:0;border-right:3px solid ORO;align-items:flex-end}
#c .dato .et{font-size:12.5px;color:#C9C9CC}
#c .dato b{font:800 16px/1.15 Archivo,sans-serif;color:#F6F6F6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:230px}
#c .dato small{font:600 12.5px/1 Archivo,sans-serif;color:#A5A5A0}
#c .dato .est{color:ORO;letter-spacing:.04em;font-size:25px;line-height:1}
#c .dato .est u{text-decoration:none;color:#F6F6F6;letter-spacing:0;font-size:17px;margin-right:6px;vertical-align:3px}
#c .dato .est i{font-style:normal;color:#4a4a4e}
#c .podio{position:absolute;top:108px;left:24px;right:24px;height:418px;display:flex;justify-content:center;align-items:flex-end;gap:16px;z-index:20}
#c .col{position:relative;display:flex;flex-direction:column;align-items:stretch;min-width:0;max-width:420px}
#c .cartas{display:flex;justify-content:center;align-items:flex-end;position:relative;align-self:center;width:fit-content}
#c .ct{position:relative;transform-origin:50% 100%;filter:drop-shadow(0 10px 16px rgba(0,0,0,.65));flex:none}
#c .ct.sinc{display:block}
#c .ctw{position:relative;display:block;flex:none;transform-origin:50% 100%}
#c .ctw > img.ct{height:100%;width:auto;display:block}
#c .ctw > .ct.sinc{height:100%;width:100%}
#c .corona{position:absolute;left:50%;top:-25px;width:44px;height:auto;transform:translateX(-50%) rotate(-4deg);z-index:6;
  filter:drop-shadow(0 3px 3px rgba(0,0,0,.75))}
#c .ct.sinc > .sin{position:absolute;left:0;bottom:0;transform-origin:0 100%}
#c .mas-n{position:absolute;right:-6px;bottom:6px;z-index:9;background:#030304;border:2px solid #F6F6F6;font:900 16px/1 Archivo,sans-serif;padding:4px 7px}
#c .plato{margin-top:8px;padding:8px 10px;background:rgba(3,3,4,.9);border:1px solid #2a2a2e;display:flex;flex-direction:column;align-items:flex-start;gap:6px;position:relative;height:112px;min-height:0;overflow:visible}
#c .plato .pos{font-size:13px;color:#C9C9CC}
#c .plato .nom{font:900 20px/1.1 Archivo,sans-serif;text-transform:uppercase}
#c .plato .nom.largo{font-size:15px}
#c .rol-o .plato .nom{font-size:16px}
#c .rol-o .elo{font-size:12px}
#c .plato .dat{display:flex;align-items:center;gap:7px;flex-wrap:nowrap}
#c .plato .cada{font-size:12px;color:#C9C9CC}
#c .plato .porque{font:700 12.5px/1.25 Archivo,sans-serif;color:#F2D58A}
#c .plato .porque,#c .plato .noche{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#c .plato .porque.bat{color:#FF8A5B}
#c .plato .noche{font:600 12.5px/1.25 Archivo,sans-serif;color:#C9C9CC}
#c .plato .mini{margin-left:auto;font:800 13px/1 'Barlow Condensed',Archivo,sans-serif;letter-spacing:.05em;color:#F6F6F6;background:rgba(255,255,255,.07);padding:5px 7px;border-radius:2px;white-space:nowrap}
#c .debut-c{position:absolute;left:-14px;top:16%;z-index:12;background:#29B298;color:#030304;font:900 11px/1 Archivo,sans-serif;letter-spacing:.08em;
  text-transform:uppercase;padding:5px 8px;transform:rotate(-6deg);box-shadow:3px 3px 0 #030304}
#c .camp .plato{border:2px solid MAG;box-shadow:5px 5px 0 MAG}
#c .camp .plato .nom,#c .mvp .plato .nom{font-size:23px}
#c .camp .plato .nom.largo,#c .mvp .plato .nom.largo{font-size:17px}
#c .mvp .plato{border:2px solid ORO;box-shadow:5px 5px 0 ORO}
#c .mvp .plato .pos{color:ORO}
#c .sello{position:absolute;right:-10px;top:-15px;background:ORO;color:#030304;font:900 14px/1 Archivo,sans-serif;padding:5px 8px;transform:rotate(4deg);box-shadow:3px 3px 0 #030304}
#c .sello.bat-s{background:#FF8A5B;transform:rotate(-3deg)}
#c .cartas.sube{margin-bottom:FANpx}
#c .elo{font:700 13px/1 'Barlow Condensed',Archivo,sans-serif;letter-spacing:.04em;color:#C9C9CC;white-space:nowrap}
#c .elo b{color:#F6F6F6;font-weight:800}
#c .elo i{font-style:normal;margin-left:2px}
#c .elo i.sube{color:#5CC46B}
#c .elo i.baja{color:#F07A2B}
#c .tira{position:absolute;left:80px;right:80px;bottom:50px;display:grid;grid-template-columns:repeat(COLS,COLWpx);justify-content:center;gap:8px;z-index:20}
#c .t{position:relative;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 4px 4px 10px;background:rgba(3,3,4,.9);border:1px solid #2a2a2e}
#c .t b{font:800 15px/1 Archivo,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;max-width:100%}
#c .t .nm{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;min-width:0}
#c .t .mks{display:flex;align-items:center;gap:3px;line-height:1}
#c .t .mk{display:inline-block;background:#29B298;color:#030304;font:900 6.5px/1 Archivo,sans-serif;font-style:normal;letter-spacing:.1em;text-transform:uppercase;padding:1px 3px;border-radius:1px}
#c .t .mk.bat{background:#FF8A5B}
#c .mas{position:absolute;left:0;right:0;bottom:24px;text-align:center;font-size:13px;color:#C9C9CC;z-index:20}
#c .t1{position:absolute;left:30px;bottom:18px;font:italic 900 30px/1 Archivo,sans-serif;z-index:30}
#c .ul{position:absolute;right:28px;bottom:14px;width:46px;height:46px;object-fit:contain;z-index:30}
"""

#: 🔤 LOS NOMBRES LOS AJUSTA EL NAVEGADOR, MIDIENDO: el tamaño que calcula `kit._px_nombre()` es una estimación por
#: letras que no ve las banderas, y en 6 de 280 eventos un nombre se cortaba («MAXIMILIANO CAL…») o el tercer integrante
#: de un equipo caía a un renglón escondido («HASSAN + ABYSSUS +», sin Geoka). Se achica de a medio punto hasta que entra
AJUSTAR = """() => {
  const sobra = (e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1;
  for (const e of document.querySelectorAll('.plato .nom, .t b, .tit h1, .dato b, .plato .noche, .plato .porque')) {
    let fs = parseFloat(getComputedStyle(e).fontSize), n = 0;
    const piso = e.matches('.t b') ? 9 : e.matches('.noche, .porque') ? 10 : 11;
    while (sobra(e) && fs > piso && n++ < 40) { fs -= 0.5; e.style.fontSize = fs + 'px'; }
  }
  // 🧾 la fila «nota · ELO · puntos» de una caja angosta (los podios de cinco): si no entra, los puntos se acortan al
  // récord («3–1») y, si tampoco, se van. La nota y el ELO quedan siempre
  for (const d of document.querySelectorAll('.plato .dat')) {
    const mi = d.querySelector('.mini');
    if (mi && sobra(d)) mi.textContent = mi.textContent.split(' · ').pop();
    if (mi && sobra(d)) mi.remove();
  }
  // 👑 la corona baja sobre la tarjeta lo que haga falta para no tocar el título ni los datos de los costados: con una
  // tarjeta sola (un 1v1) la tarjeta es alta y la corona quedaba encima de «Cypherhood · 19/11 · …»
  const R = (e) => e.getBoundingClientRect();
  const arriba = [...document.querySelectorAll('.tit h1, .tit p, .tit .et, .lado-i .dato, .lado-d .dato')].map(R);
  for (const k of document.querySelectorAll('.corona')) {
    let n = 0;
    while (n++ < 30) {
      const b = R(k);
      const choca = arriba.some((a) => a.right > b.left + 1 && b.right > a.left + 1 && a.bottom + 3 > b.top && b.bottom > a.top);
      if (!choca) break;
      k.style.top = (parseFloat(getComputedStyle(k).top) + 1) + 'px';
    }
  }
  return true;
}"""

#: 📏 lo que se mide en cada imagen antes de mandarla: nada se sale, nada se corta, las cajas no se pisan, la tira no
#: toca el podio y ningún sello (MVP, Batacazo, Debut) toca a otro ni un texto. Las tarjetas se miran aparte, por píxel
MEDIR = """() => {
  const q = (s) => document.querySelector(s), R = (e) => e.getBoundingClientRect(), c = R(q('#c'));
  const pisan = (a, b, m) => a.right > b.left + m && b.right > a.left + m && a.bottom > b.top + m && b.bottom > a.top + m;
  const pl = [...document.querySelectorAll('.plato')].map(R), t = R(q('.tira'));
  const sale = [...document.querySelectorAll('.plato, .t, .ct')].filter((x) => { const b = R(x); return b.left < c.left - 1 || b.right > c.right + 1; }).length;
  const cortados = [...document.querySelectorAll('.nom, .t b, h1, .plato .noche, .plato .porque, .plato .dat')].filter((e) => e.scrollWidth > e.clientWidth + 1
    || e.scrollHeight > e.clientHeight + 1).map((e) => e.textContent);
  const pisa = pl.some((a, i) => pl.some((b, j) => i < j && pisan(a, b, 1)));
  const desborda = [...document.querySelectorAll('.plato')].filter((e) => e.scrollHeight > e.clientHeight + 1).length;
  const sel = [...document.querySelectorAll('.sello, .debut-c, .corona')];
  const otros = [...document.querySelectorAll('.sello, .debut-c, .corona, .plato .pos, .plato .nom, .plato .chip, .plato .mini, .plato .noche, .plato .porque, .tira .t, .tit h1, .tit p, .lado-i .dato, .lado-d .dato')];
  const sellos = [], contra_tarjeta = [];
  sel.forEach((s, i) => {
    const rs = R(s);
    for (const x of otros) {
      if (x === s || s.contains(x) || x.contains(s) || (sel.indexOf(x) >= 0 && sel.indexOf(x) < i)) continue;
      if (pisan(rs, R(x), 2)) sellos.push((s.textContent || '').trim() + ' × ' + ((x.textContent || '').trim().slice(0, 14) || x.className));
    }
    if (rs.left < c.left || rs.right > c.right || rs.top < c.top || rs.bottom > c.bottom) sellos.push((s.textContent || '').trim() + ' sale');
    if (s.matches('.sello')) contra_tarjeta.push([rs.left - c.left, rs.top - c.top, rs.right - c.left, rs.bottom - c.top, (s.textContent || '').trim()]);
  });
  return { tira_n: document.querySelectorAll('.tira .t').length,
           platos_hasta: Math.round(Math.max(0, ...pl.map((x) => x.bottom)) - c.top), tira_desde: Math.round(t.top - c.top),
           tira_hasta: Math.round(t.bottom - c.top), sale, cortados, pisa, desborda, sellos, contra_tarjeta };
}"""


def _sellos_vs_tarjetas(pg, cajas):
    """🛡️ ¿Un sello cae sobre la TINTA de una tarjeta, o sólo sobre su caja (el escudo tiene las esquinas vacías)? Se
    dibujan las tarjetas solas, sin sombra, sobre fondo transparente y se mira el alfa debajo de cada sello."""
    if not cajas:
        return []
    from PIL import Image
    caja_c = pg.evaluate("() => { const r = document.querySelector('#c').getBoundingClientRect(); return {x: r.left, y: r.top, width: r.width, height: r.height}; }")
    pg.add_style_tag(content='html,body{background:transparent!important}#c,#c *{visibility:hidden!important}'
                             '#c .ct,#c .ct *{visibility:visible!important;filter:none!important;box-shadow:none!important}')
    a = Image.open(io.BytesIO(pg.screenshot(omit_background=True, clip=caja_c))).convert('RGBA').split()[3]
    out = []
    for x0, y0, x1, y1, txt in cajas:
        tinta = sum(1 for v in a.crop((max(0, int(x0)), max(0, int(y0)), int(x1), int(y1))).getdata() if v > 60)
        if tinta > 6:
            out.append('%s × tarjeta' % txt[:14])
    return out


def problemas(m):
    """Lo que está mal en una imagen medida (lista vacía: está bien)."""
    out = []
    if m.get('sale'):
        out.append('%d cosa(s) se salen' % m['sale'])
    if m.get('cortados'):
        out.append('cortados: ' + ', '.join(m['cortados'])[:120])
    if m.get('pisa'):
        out.append('las cajas se pisan')
    if m.get('desborda'):
        out.append('%d caja(s) se desbordan' % m['desborda'])
    if m.get('tira_n') and m.get('platos_hasta', 0) > m.get('tira_desde', 999) - 8:
        out.append('la tira toca el podio')
    if not m.get('tira_n') and m.get('platos_hasta', 0) > 612:
        out.append('el podio baja hasta el «T1»')
    if m.get('tira_hasta', 0) > 640:
        out.append('la tira baja demasiado')
    out += m.get('sellos') or []
    return out


def imagen(ev, pg=None):
    """`(png, problemas)` de ese evento. Con `pg` (una página de Playwright de 1200×675) la reusa; si no, abre el
    navegador (`navegador.hace_falta()` lo baja sólo si falta)."""
    h = html(str(ev))
    if pg is None:
        import navegador
        navegador.hace_falta()
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            b = p.chromium.launch(args=['--no-sandbox'])
            try:
                return imagen(ev, b.new_page(viewport={'width': 1200, 'height': 675}, device_scale_factor=1))
            finally:
                b.close()
    pg.set_content(h, wait_until='load')
    pg.evaluate('document.fonts.ready.then(() => true)')
    pg.wait_for_timeout(300)
    pg.evaluate(AJUSTAR)
    png = pg.locator('#c').screenshot()
    m = pg.evaluate(MEDIR)
    try:
        m['sellos'] = (m.get('sellos') or []) + _sellos_vs_tarjetas(pg, m.get('contra_tarjeta'))
    except Exception as e:                               # noqa: BLE001
        print('      ⚠️ no pude mirar los sellos contra las tarjetas: %r' % e)
    return png, problemas(m)


# ── lo que acompaña a la imagen en Discord ───────────────────────────────────────────────────────────────────────────
def resumen(ev):
    """Lo que dice la imagen, en datos: campeón, MVP, batacazo y la nota de cada uno. Para la descripción de la imagen
    y para los botones «Tu nota» y «Perfiles» (`ficha()`)."""
    from construir_padron import norm
    D = _d()
    ev = str(ev)
    notas, por, k_mvp, bat, nombres = notas_de(ev)
    us, por_eq = unidades(ev, notas, nombres)
    elos = elo_noche(ev)
    PTS = {norm(limpio(f['n'])): f['pts'] for f in D['RES'].get(ev, [])}
    gente = []
    for u in us:
        for (nombre, cc), k, crudo, ident in zip(u['gente'], u['claves'], u['crudos'], u['ids']):
            e = elos.get(ident) if len(u['claves']) == 1 else None
            gente.append({'n': nombre, 'crudo': crudo, 'k': clave(crudo), 'cc': cc, 'pos': u['pos'], 'nota': notas.get(k, u['nota']),
                          'eq': len(u['gente']) > 1, 'mvp': bool(k_mvp) and k_mvp in u['claves'],
                          'bat': bool(bat) and bat[0] in u['claves'], 'pts': PTS.get(k, ''),
                          'elo': [round(e[0]), round(e[1])] if e else None,
                          'por': [[sin_nivel(r), d] for r, d in por.get(k, [])]})
    return {'ev': ev, 'titulo': re.sub(r'^[\s_*~|`\-]+|[\s_*~|`\-]+$', '', D['EV'][ev]['nombre']), 'sv': D['EV'][ev]['sv'],
            'gente': gente, 'bat': sin_nivel(bat[1]) if bat else '', 'por_equipos': por_eq}


def descripcion(R):
    """El texto de la imagen en Discord (lectores de pantalla y el buscador): «La noche de X: campeón Y (8,9) y MVP…»."""
    nom = lambda xs: ' + '.join(x['n'] for x in xs)       # noqa: E731
    camp = [x for x in R['gente'] if x['pos'] == 'Campeón']
    mvp = [x for x in R['gente'] if x['mvp']]
    bat = [x for x in R['gente'] if x['bat']]
    partes = []
    if camp:
        partes.append('%s %s (%s)' % ('campeones' if len(camp) > 1 else 'campeón', nom(camp), nota_txt(camp[0]['nota'])))
    if mvp and mvp != camp:
        partes.append('MVP %s (%s)' % (nom(mvp), nota_txt(mvp[0]['nota'])))
    elif mvp:
        partes[-1] += ', también MVP'
    if bat:
        partes.append('batacazo de %s: %s' % (nom(bat), re.sub(r'^🔥\s*', '', R['bat'])))
    otros = sorted([x for x in R['gente'] if x not in camp], key=lambda x: -x['nota'])[:8]
    if otros:
        partes.append('notas: ' + ', '.join('%s %s' % (x['n'], nota_txt(x['nota'])) for x in otros))
    return ('La noche de %s: ' % R['titulo'] + ' · '.join(partes))[:1000]


def ficha(R, Q):
    """🎯 Lo que leen «Tu nota» y «Perfiles» en el Worker (KV `noche:<n>`): cada uno con su Discord ID (`Q`, el de
    `drops_merito.quienes()`), su nota, por qué, su ELO, su puesto y si tiene tarjeta; y los perfiles del podio."""
    import competencias as CO
    gente = []
    for x in R['gente']:
        did = Q.get(x['crudo']) or Q.get(CO.de_hoy(x['crudo'])) or Q.get(x['n']) or ''
        gente.append({'n': x['n'], 'k': x['k'], 'd': did, 'nota': x['nota'], 'pos': x['pos'], 'eq': x['eq'],
                      'mvp': x['mvp'], 'bat': x['bat'], 'elo': x['elo'], 'pts': x['pts'], 'por': x['por'][:12],
                      'carta': tiene_carta(x['crudo'])})
    podio = [x for x in R['gente'] if x['pos'] in ('Campeón', 'Subcampeón', 'Tercero', 'Cuarto', 'Semifinal') or x['mvp'] or x['bat']]
    podio.sort(key=lambda x: (ORDEN_PUESTO.get(x['pos'], 9), -x['nota']))
    perf, vistos = [], set()
    for x in podio:
        if x['k'] not in vistos:
            vistos.add(x['k'])
            perf.append([x['n'], x['k']])
    return {'ev': R['ev'], 't': R['titulo'], 'sv': R['sv'], 'p': gente, 'perf': perf[:5]}


# ── el self-check ────────────────────────────────────────────────────────────────────────────────────────────────────
def _self_check():
    mal = 0

    def ok(c, t, extra=''):
        nonlocal mal
        print(('  ✅ ' if c else '  ❌ ') + t + ('' if c else '   ' + str(extra)[:240]))
        mal += 0 if c else 1
    ok([cuantos(n) for n in (4, 9, 16, 17, 40, 80)] == [4, 5, 8, 5, 10, 10], 'la tira: la mitad hasta 16, un cuarto con más, entre 4 y 10')
    ok([titulo_n(k) for k in (1, 2, 3, 6)] == ['primer título', '2.º título', '3.er título', '6.º título'], 'el título número tanto')
    ok(sin_nivel('ganó en Final · evento ×1.11') == 'ganó en Final', 'la razón sin el nivel')
    # un evento armado: 1v1 de 8, con un batacazo de Marcos en cuartos
    ev = [['#', 'Evento', 'Servidor', 'Fecha'], ['9001', '__ PRUEBA __', 'FFA', '15/11']]
    pos = [('Mats', 'Campeón'), ('Maji', 'Subcampeón'), ('Marcos', 'Semifinal'), ('Alfi', 'Semifinal'),
           ('Motera', 'Cuartos'), ('Under', 'Cuartos'), ('Ziar', 'Cuartos'), ('Tmax', 'Cuartos')]
    res = [['Evento #', 'Fecha', 'Servidor', 'Escala', 'Rapero', 'País', 'Posición', 'Puntos']] + \
          [['9001', '15/11', 'FFA', '8+', n, 'uy', p, str(1000 * (8 - i))] for i, (n, p) in enumerate(pos)]
    ll = {'9001': {'dia': '2026-11-15', 'tabla': [[n, p, 0] for n, p in pos], 'rondas': [
        {'r': 'Cuartos', 'b': [[['Mats', 'Tmax'], 'Mats', ''], [['Maji', 'Ziar'], 'Maji', ''], [['Marcos', 'Motera'], 'Marcos', ''],
                               [['Alfi', 'Under'], 'Alfi', '']]},
        {'r': 'Semifinales', 'b': [[['Mats', 'Marcos'], 'Mats', ''], [['Maji', 'Alfi'], 'Maji', '']]},
        {'r': 'Final', 'b': [[['Mats', 'Maji'], 'Mats', '']]}]}}
    import competencias as CO
    CO._SIN_ALIAS[0] = True                               # el self-check no lee los alias de la Liga
    cargar(eventos=ev, resultados=res, llaves=ll, gente={'9001': {'staff': {'org': [{'n': 'Rubik'}], 'host': [{'n': 'Rubik'}]},
                                                                  'ins': ['a'] * 12}}, cartas={})
    notas, _por, k_mvp, _bat, nombres = notas_de('9001')
    ok(k_mvp == 'mats' and notas['mats'] == max(notas.values()), '🏅 el MVP es la nota más alta', (k_mvp, notas))
    us, por_eq = unidades('9001', notas, nombres)
    ok(not por_eq and len(us) == 8, 'un 1v1 de 8: ocho unidades', len(us))
    fila, mvp_u = podio(us, k_mvp)
    ok([(t, x) for t, _u, x in fila] == [('Semifinal', 'o'), ('Subcampeón', 'i'), ('Campeón', 'c'), ('Semifinal', 'i')] or
       [x for _t, _u, x in fila] == ['i', 'c', 'i'], '🪞 el podio en espejo, el campeón en el medio', [(t, x) for t, _u, x in fila])
    ok(mvp_u is not None and mvp_u['pos'] == 'Campeón', 'el MVP es el campeón en este caso')
    cab = cabecera('9001')
    ok(cab['papeles'] == [('Organiza · Host', ['Rubik'])] and cab['ins'] == 12, '👥 una persona, todos sus papeles en una línea', cab)
    ok(titulos('9001', 'mats') == 1, '🏆 su primer título')
    ok(debuta('9001') == {CO.norm(n) for n, _p in pos}, '🆕 en su primer evento, todos debutan')
    h = html('9001')
    ok('La noche de' in h and '⭐ MVP' in h and 'primer título' in h and 'Debut' in h, 'la imagen: título, MVP, título y debut')
    ok('<div class="cami">' in h or 'class="fondo"' in h, 'con el fondo del servidor')
    ok(h.count('class="ct sinc"') == len(fila), 'sin tarjeta, la silueta del VS (una por lugar del podio)', h.count('class="ct sinc"'))
    R = resumen('9001')
    d = descripcion(R)
    ok(d.startswith('La noche de PRUEBA: campeón Mats') and 'también MVP' in d, 'la descripción de la imagen', d)
    f = ficha(R, {'Mats': '111', 'Marcos': '222'})
    yo = next((x for x in f['p'] if x['d'] == '111'), None)
    ok(yo and yo['pos'] == 'Campeón' and yo['mvp'] and yo['por'] and yo['elo'], '🎯 «Tu nota»: lo de cada uno por su Discord', yo)
    ok([x[0] for x in f['perf']][:2] == ['Mats', 'Maji'] and len(f['perf']) <= 5, '👤 «Perfiles»: el podio, en orden', f['perf'])
    ok(len(json.dumps(f, ensure_ascii=False)) < 20000, 'la ficha entra holgada en KV')
    CO._SIN_ALIAS[0] = False
    _D.clear()
    print('\n%s' % ('todo bien' if not mal else '%d mal' % mal))
    return mal


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if '--auto' in sys.argv:
        sys.exit(1 if _self_check() else 0)
    evs = [a for a in sys.argv[1:] if a.isdigit()]
    if not evs:
        sys.exit(__doc__)
    out = os.path.join(BASE, '.cache', 'noche')
    os.makedirs(out, exist_ok=True)
    import navegador
    navegador.hace_falta()
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 1200, 'height': 675}, device_scale_factor=1)
        for ev in evs:
            png, mal = imagen(ev, pg)
            ruta = os.path.join(out, '%s.png' % ev)
            open(ruta, 'wb').write(png)
            print('%s %-36s %s %s' % (ev, _d()['EV'][ev]['nombre'][:36], '🔴' if mal else '✅', '; '.join(mal) or ruta))
        b.close()


if __name__ == '__main__':
    main()
