# -*- coding: utf-8 -*-
"""👥 LA GENTE DE CADA EVENTO: QUIÉN HOSTEÓ, EL STAFF, EL JURADO Y LOS INSCRITOS, GUARDADO PARA SIEMPRE.

    python bot/gente_evento.py              arma y muestra, sin escribir
    python bot/gente_evento.py --aplicar    escribe datos/gente_eventos.json (lo hace el ciclo, paso 2b8h2)
    python bot/gente_evento.py --ver 654    la gente de ese evento
    python bot/gente_evento.py --auto       self-check

Dlx, 17/11/2026: *«hay algo que guarda quiénes se inscriben para un evento, ¿no? esto debería mostrar cada llave también,
o sea quiénes se inscribieron, y alumbrar a los que finalmente participaron»*, *«mejorar eso de inscripciones… quiénes se
inscribieron, quiénes participaron realmente, para luego saber quién fue quién, a pesar de que se pongan nombres tontos»*
y *«también mostrar los staff que había, quiénes votaban y si cambiaron en qué ronda, quién hosteó, sus perfiles»*.

🔑 POR QUÉ SE GUARDA Y NO SE CALCULA CADA VEZ. Todo esto vive en lugares que se BORRAN: los organizadores vacían el canal
de inscripciones después de cada evento, y `datos/anuncios.json` guarda los últimos anuncios y las últimas 4.000
inscripciones. Medido el 17/11 sobre las 157 llaves desde el 15/10: 57 encontraban su anuncio y 33 sus inscripciones, y el
resto se había perdido. Por eso cada corrida SUMA a lo guardado y nunca saca: lo que se vio una vez queda.

👤 QUIÉN FUE QUIÉN (`_quien_jugo()`), con lo aprendido en la T1:
  1. Por la CUENTA que se anotó, si esa cuenta es de alguien de la Lista que jugó la llave — y sólo si esa cuenta se anota
     sola: una que anotó 3 nombres distintos o más es staff o alguien que anota amigos (la otra cuenta de Shadow anotó a
     Drexx; `jesuslgamer31` anotó a «Steven» y a «Player»), y su inscripción no dice quién es quién.
  2. Por el NOMBRE escrito, exacto (sin banderas ni mayúsculas).
  Cuando la cuenta dice que «Park-Ji Sung» era Oasis, la página muestra «se anotó como Park-Ji Sung»: el nombre de broma
  queda unido a la persona sin adivinar. Una pareja («A + B») no se une por la cuenta: no dice cuál de los dos la escribió.

⚠️ SIN IDS DE DISCORD EN LA PÁGINA. Acá se guardan (el mensaje y la cuenta, para no contar dos veces lo mismo y para unir),
pero `para_web()` saca sólo nombres.
"""
import datetime as dt
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

SALIDA = os.path.join(BASE, 'datos', 'gente_eventos.json')
#: desde cuántos nombres distintos anotados una cuenta deja de servir para decir quién es (`inscripcion-no-siempre-es-el-autor`)
ANOTA_A_OTROS = 3
#: los votos de #veredictos se cruzan con la llave por los lados y la fecha: de un día antes a dos después (como `notas.py`)
VOTO_ANTES, VOTO_DESPUES = 1, 2
#: un anuncio sin fecha cierra sus inscripciones al final del día del evento (hora del este)
ROLES = ('host', 'dj', 'jurado')


def _json(*ruta, defecto=None):
    try:
        with io.open(os.path.join(BASE, *ruta), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def _norm(s):
    import decidir as DEC
    return DEC.norm(re.sub('[\U0001F1E6-\U0001F1FF]', '', re.sub(r'<a?:\w+:\d+>', '', str(s or ''))))


def _nombres(texto):
    import decidir as DEC
    return DEC._nombres_insc(texto)


def _snow_ms(i):
    """El instante de un id de Discord (snowflake), en ms."""
    try:
        return (int(i) >> 22) + 1420070400000
    except (TypeError, ValueError):
        return 0


def _iso_ms(s):
    try:
        t = dt.datetime.fromisoformat(str(s).replace('Z', ''))
    except ValueError:
        return 0
    return int(t.replace(tzinfo=dt.timezone.utc).timestamp() * 1000) if t.tzinfo is None else int(t.timestamp() * 1000)


class Fuentes:
    """Todo lo que se lee, una vez."""

    def __init__(self, llaves=None, anuncios=None, jurados=None, lista=None, cuentas=None, nombres_llaves=None):
        a = _json('datos', 'anuncios.json', defecto={}) if anuncios is None else anuncios
        self.llaves = _json('datos', 'llaves_t1.json', defecto={}) if llaves is None else llaves
        self.anuncios = a.get('anuncios') or []
        self.insc = a.get('inscripciones') or []
        self.por_msg = {str(x.get('msg_id')): x for x in self.anuncios if x.get('msg_id')}
        J = _json('datos', 'jurados.json', defecto={}) if jurados is None else jurados
        self.votos = list((J.get('votos') or {}).values())
        self.jnombre = J.get('nombres') or {}
        if lista is None:
            g = (_json('datos', 't1_lista.json', defecto={}) or {}).get('grilla') or []
            lista = [f for f in g if isinstance(f, list) and len(f) > 4 and f[0]]
        self.por_id = {str(f[4]): str(f[7] if len(f) > 7 and f[7] else f[0]) for f in lista if f[4]}
        # los nombres de la Lista (con y sin bandera): «Motera» escrito por la cuenta de Ortiz no es Ortiz si Motera existe
        self.en_lista = {_norm(x) for f in lista for x in (f[0], f[7] if len(f) > 7 else '') if _norm(x)}
        cu = (_json('datos', 'akas_a_mano.json', defecto={}) or {}).get('cuentas') if cuentas is None else cuentas
        for p, ids in (cu or {}).items():
            for i in ids or []:
                self.por_id.setdefault(str(i), p)
        nl = (_json('datos', 'nombres_llaves.json', defecto={}) or {}).get('llaves') if nombres_llaves is None else nombres_llaves
        self.anuncio_de_msg = {str(k): str(v.get('anuncio')) for k, v in (nl or {}).items() if isinstance(v, dict) and v.get('anuncio')}
        # cuántos nombres distintos anotó cada cuenta, en todo lo guardado
        self.nombres_de_cuenta = {}
        for x in self.insc:
            did = str(x.get('discord_id') or '')
            for n in _nombres(x.get('texto')):
                self.nombres_de_cuenta.setdefault(did, set()).add(n)


def anuncio(L, F):
    """El anuncio de la llave: por el link de su mensaje (`nombres_llaves.json`) y, si no, por el nombre y el día."""
    for link in L.get('links') or []:
        m = re.search(r'/(\d{15,22})/?$', str(link))
        if m and F.anuncio_de_msg.get(m.group(1)) in F.por_msg:
            return F.por_msg[F.anuncio_de_msg[m.group(1)]]
    import llaves_web as LW
    try:
        return LW.anuncio_de(L.get('nombre'), L.get('sv'), dt.date.fromisoformat(L.get('dia')), F.anuncios)
    except (TypeError, ValueError):
        return None


def _persona(nombre, did, F):
    """`{'n': nombre a mostrar}`: el de la Lista si esa cuenta está, si no el que escribieron."""
    n = F.por_id.get(str(did or '')) if did else None
    return {'n': n or re.sub(r'\s+', ' ', str(nombre or '')).strip()}


def staff(p, F):
    """`{'host': [...], 'dj': [...], 'jurado': [...]}` del anuncio, y los organizadores en `org`."""
    out = {}
    cu = p.get('staff_cuentas') or {}
    for rol in ROLES:
        xs = [_persona(n, cu.get(n), F) for n in (p.get('staff') or {}).get(rol) or [] if str(n).strip()]
        if xs:
            out[rol] = xs
    org = [_persona(o.get('n'), o.get('id'), F) for o in p.get('orgs') or [] if o.get('n')]
    if not org and p.get('organizador'):
        org = [_persona(p['organizador'], '', F)]
    if org:
        out['org'] = org
    return out


def jurado(L, F):
    """`[{'r': ronda, 'l': [lados], 'v': [[juez, índice del lado votado]]}]`: quién votó a quién, batalla por batalla."""
    try:
        d0 = dt.date.fromisoformat(L.get('dia'))
    except (TypeError, ValueError):
        return []
    idx = {}
    for v in F.votos:
        lados = v.get('lados') or [v.get('a') or '', v.get('b') or '']
        ns = [_norm(x) for x in lados]
        if len(ns) < 2 or not all(ns):
            continue
        try:
            dia = (dt.datetime.fromtimestamp(int(v['pub']) / 1000, dt.timezone.utc) - dt.timedelta(hours=4)).date()
        except (KeyError, TypeError, ValueError, OSError):
            continue
        if not -VOTO_ANTES <= (dia - d0).days <= VOTO_DESPUES:
            continue
        idx.setdefault(frozenset(ns), []).append((ns, v))
    out = []
    for R in L.get('rondas') or []:
        for b in R.get('b') or []:
            lados = b[0] or []
            ns = [_norm(x) for x in lados]
            cand = idx.get(frozenset(ns)) or []
            if not cand:
                continue
            vns, v = cand[-1]
            votos = []
            for jid, x in sorted((v.get('v') or {}).items()):
                k = vns[0] if x == 'a' else vns[1] if x == 'b' and len(vns) > 1 else _norm(x)
                if k in ns:
                    votos.append([F.por_id.get(str(jid)) or F.jnombre.get(str(jid)) or 'jurado', ns.index(k)])
            if votos:
                out.append({'r': R.get('r') or '', 'l': list(lados), 'v': votos})
    return out


def inscritos(L, p, F):
    """`[{'id', 't', 'c', 'cuenta'}]`: las inscripciones de ese servidor entre el anuncio y el final del día del evento."""
    if not p:
        return []
    desde = _iso_ms(p.get('cuando'))
    try:
        hasta = _iso_ms(L.get('dia') + 'T23:59:59') + 5 * 3600 * 1000
    except TypeError:
        return []
    if not desde or not hasta or hasta <= desde:
        return []
    out = []
    for x in F.insc:
        if (x.get('servidor') or '') != (L.get('sv') or ''):
            continue
        t = _iso_ms(x.get('cuando'))
        if desde <= t <= hasta and str(x.get('texto') or '').strip():
            out.append({'id': str(x.get('msg_id') or ''), 't': str(x['texto']).strip()[:80], 'c': str(x.get('cuando') or '')[:16],
                        'cuenta': str(x.get('discord_id') or '')})
    return out


def _quien_jugo(ins, L, F):
    """A cada inscripción le pone `es` (el nombre en la llave de quien jugó, si se sabe) y `por` (cuenta / nombre)."""
    gente = {}
    for r in L.get('tabla') or []:
        for m in re.split(r'[,+&]', str(r[0])):
            if _norm(m):
                gente.setdefault(_norm(m), m.strip())
    for x in ins:
        x.pop('es', None)
        x.pop('por', None)
        ns = _nombres(x['t'])
        sola = len(ns) == 1
        dueno = F.por_id.get(x.get('cuenta') or '')
        otros = len(F.nombres_de_cuenta.get(x.get('cuenta') or '', ())) >= ANOTA_A_OTROS
        # ⚠️ y lo escrito no es OTRA persona de la Lista: entonces anotó a un amigo, no se disfrazó (17/11/2026, «Motera»)
        otra = bool(ns) and ns[0] != _norm(dueno or '') and ns[0] in F.en_lista
        if sola and dueno and not otros and not otra and _norm(dueno) in gente:
            x['es'], x['por'] = gente[_norm(dueno)], 'cuenta'
            continue
        hit = [gente[n] for n in ns if n in gente]
        if hit:
            x['es'], x['por'] = ', '.join(hit), 'nombre'
    return ins


def armar(F, viejo=None):
    """`{n: {...}}` de todas las llaves, SUMANDO a lo guardado (`viejo`): lo que ya se vio no se pierde."""
    viejo = viejo or {}
    out = {}
    for n, L in F.llaves.items():
        L = dict(L, n=n)
        g = dict(viejo.get(str(n)) or {})
        p = anuncio(L, F)
        if p:
            g['an'] = str(p.get('msg_id') or g.get('an') or '')
            st = staff(p, F)
            if st:
                g['staff'] = st
        jr = jurado(L, F)
        if jr:
            g['jur'] = jr
        nuevos = inscritos(L, p, F)
        if nuevos or g.get('ins'):
            vistos = {x['id']: x for x in g.get('ins') or [] if x.get('id')}
            for x in nuevos:
                vistos.setdefault(x['id'] or ('%s|%s' % (x['c'], x['t'])), x)
            g['ins'] = _quien_jugo(sorted(vistos.values(), key=lambda x: x.get('c') or ''), L, F)
        if g:
            out[str(n)] = g
    # lo guardado de llaves que ya no están (sacadas o renumeradas) también queda: es historia
    for n, g in viejo.items():
        out.setdefault(n, g)
    return out


def para_web(g):
    """Lo de un evento para la página: sin ids de Discord. `None` si no hay nada que mostrar."""
    if not g:
        return None
    w = {}
    if g.get('staff'):
        w['staff'] = {r: [x['n'] for x in xs] for r, xs in g['staff'].items()}
    if g.get('jur'):
        w['jur'] = g['jur']
    if g.get('ins'):
        w['ins'] = [[x['t'], x.get('es') or '', x.get('por') or ''] for x in g['ins']]
    return w or None


def _self_check():
    mal = [0]

    def ok(c, t):
        mal[0] += not c
        print('   %s %s' % ('✅' if c else '🔴', t))

    print('\n══ LA GENTE DE CADA EVENTO ══\n')
    L = {'n': '9', 'nombre': 'PRUEBA VOL 1', 'sv': 'FFA', 'dia': '2026-11-10', 'links': ['https://discord.com/channels/1/2/500'],
         'tabla': [['Oasis', 'Campeón', 0], ['Tam', 'Subcampeón', 0], ['Ana, Bea', 'Cuartos', 0]],
         'rondas': [{'r': 'Final', 'b': [[['Oasis', 'Tam'], 'Oasis', '']]}]}
    an = {'msg_id': '400', 'servidor': 'FFA', 'nombre': 'PRUEBA VOL 1', 'cuando': '2026-11-10T15:00:00',
          'staff': {'host': ['Hirex'], 'jurado': ['J1']}, 'staff_cuentas': {'Hirex': '77'}, 'orgs': [{'n': 'DRAKO', 'id': ''}]}
    ins = [{'servidor': 'FFA', 'texto': 'Park-Ji Sung 🇰🇷', 'discord_id': '11', 'msg_id': 'm1', 'cuando': '2026-11-10T16:00:00'},
           {'servidor': 'FFA', 'texto': 'tam', 'discord_id': '22', 'msg_id': 'm2', 'cuando': '2026-11-10T16:01:00'},
           {'servidor': 'FFA', 'texto': 'Nadie', 'discord_id': '33', 'msg_id': 'm3', 'cuando': '2026-11-10T16:02:00'},
           {'servidor': 'FFA', 'texto': 'Oasis + Ana', 'discord_id': '44', 'msg_id': 'm4', 'cuando': '2026-11-10T16:03:00'},
           {'servidor': 'FFA', 'texto': 'X1', 'discord_id': '44', 'msg_id': 'm5', 'cuando': '2026-11-09T10:00:00'},
           {'servidor': 'FFA', 'texto': 'Bea', 'discord_id': '55', 'msg_id': 'm6', 'cuando': '2026-11-10T16:04:00'},
           {'servidor': 'FFA', 'texto': 'Otra', 'discord_id': '55', 'msg_id': 'm7', 'cuando': '2026-11-01T16:04:00'},
           {'servidor': 'FFA', 'texto': 'Otra2', 'discord_id': '55', 'msg_id': 'm8', 'cuando': '2026-11-01T16:05:00'},
           {'servidor': 'URBF', 'texto': 'Oasis', 'discord_id': '11', 'msg_id': 'm9', 'cuando': '2026-11-10T16:00:00'},
           {'servidor': 'FFA', 'texto': 'Nadie 🇨🇱', 'discord_id': '22', 'msg_id': 'm10', 'cuando': '2026-11-10T16:05:00'}]
    J = {'nombres': {'j1': 'Juez Uno'}, 'votos': {'v': {'a': 'OASIS', 'b': 'Tam 🇻🇪', 'pub': 1794330000000, 'v': {'j1': 'a', '88': 'b'}}}}
    lista = [['Oasis 🇨🇱', 'Chile', '', '✅', '11', '', '', 'Oasis'], ['Tam 🇻🇪', '', '', '', '22', '', '', 'Tam'],
             ['Hirex', '', '', '', '77', '', '', 'Hirex'], ['Bea', '', '', '', '55', '', '', 'Bea'], ['Juez Dos', '', '', '', '88', '', '', 'Juez Dos'],
             ['Nadie', '', '', '', '', '', '', 'Nadie']]
    F = Fuentes(llaves={'9': L}, anuncios={'anuncios': [an], 'inscripciones': ins}, jurados=J, lista=lista, cuentas={},
                nombres_llaves={'500': {'anuncio': '400'}})
    g = armar(F)['9']
    es = {x['t']: (x.get('es'), x.get('por')) for x in g['ins']}
    ok(g['an'] == '400' and g['staff']['host'] == [{'n': 'Hirex'}] and g['staff']['org'] == [{'n': 'DRAKO'}],
       'el anuncio por el link de la llave, con su host (el de la Lista por su cuenta) y quien organiza')
    ok(es.get('Park-Ji Sung 🇰🇷') == ('Oasis', 'cuenta') and es.get('tam') == ('Tam', 'cuenta') and es.get('Nadie') == (None, None),
       'la cuenta de Oasis se anotó «Park-Ji Sung»: es Oasis; «tam», por su cuenta; «Nadie» se anotó y no jugó')
    ok(es.get('Oasis + Ana') == ('Oasis, Ana', 'nombre'), 'una pareja no se une por la cuenta, sólo por los nombres que escribe')
    ok(es.get('Nadie 🇨🇱') == (None, None), 'la cuenta de Tam anotó a «Nadie», que está en la Lista: es un amigo, no Tam disfrazado')
    ok(es.get('Bea') == ('Bea', 'nombre'), 'una cuenta que anotó 3 nombres distintos no dice quién es: va por el nombre')
    ok('X1' not in es and 'Oasis' not in [x['t'] for x in g['ins']],
       'sólo las inscripciones entre el anuncio y el final del día, y del mismo servidor')
    ok(g.get('jur') == [{'r': 'Final', 'l': ['Oasis', 'Tam'], 'v': [['Juez Dos', 1], ['Juez Uno', 0]]}],
       'el jurado: quién votó a quién en la final (el de la Lista por su cuenta, si no el nombre de #veredictos)  %s' % g.get('jur'))
    F2 = Fuentes(llaves={'9': L}, anuncios={'anuncios': [], 'inscripciones': []}, jurados={}, lista=lista, cuentas={},
                 nombres_llaves={})
    g2 = armar(F2, {'9': g})['9']
    ok(g2.get('ins') == g['ins'] and g2.get('staff') == g['staff'] and g2.get('jur') == g['jur'],
       'con el canal vaciado y el anuncio olvidado, lo guardado queda')
    w = para_web(g)
    _s = json.dumps(w)
    ok(not any(x in _s for x in ('"11"', '"22"', 'm1', '"77"', '400')) and w['ins'][0] == ['Park-Ji Sung 🇰🇷', 'Oasis', 'cuenta'],
       'para la página, sin ids de Discord')
    print('\n   %s' % ('todo bien' if not mal[0] else '🔴 %d mal' % mal[0]))
    return 1 if mal[0] else 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass
    if '--auto' in sys.argv:
        return _self_check()
    viejo = _json('datos', 'gente_eventos.json', defecto={}) or {}
    res = armar(Fuentes(), viejo)
    if '--ver' in sys.argv:
        n = sys.argv[sys.argv.index('--ver') + 1]
        print(json.dumps(res.get(n) or {}, ensure_ascii=False, indent=1))
        return 0
    c = lambda k: sum(1 for g in res.values() if g.get(k))  # noqa: E731
    print('👥 la gente de %d evento(s): anuncio %d · staff %d · jurado %d · inscritos %d (de %d llaves)'
          % (len(res), c('an'), c('staff'), c('jur'), c('ins'), len(Fuentes().llaves)))
    if '--aplicar' in sys.argv and res != viejo:
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(res, f, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
        print('   escrito en %s' % os.path.relpath(SALIDA, BASE))
    return 0


if __name__ == '__main__':
    sys.exit(main())
